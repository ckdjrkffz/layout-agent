import requests
import json
import textwrap
import copy
from pprint import pprint
import traceback
import re

class GenerateCommandModel():

    def __init__(self, args):

        with open(args.config_path) as f:
            config = json.load(f)

        self.api_key = config["openai_api_key"]
        self.model_name = "gpt-4-vision-preview"

        self.use_history = (args.disable_history is False)
        self.use_cot = (args.disable_cot is False)
        self.use_image_status = (args.disable_image_status is False)
        self.use_text_status = (args.disable_text_status is False)
        self.position_mode = \
            "absolute" if (args.disable_absolute_position is False) else \
            "relative"

        print("Setting:")
        print(f"Use CoT: {self.use_cot}")
        print(f"Use history: {self.use_history}")
        print(f"Use image_status: {self.use_image_status}")
        print(f"Use text_status: {self.use_text_status}")
        print(f"Position mode: {self.position_mode}")
        print()

        # The prompt text for instructions to the model is a combination of the following three
        # initial_text1: always common
        # initial_text2: depends on whether the position is absolute or relative
        # initial_text3: depends on whether CoT is used or not
        initial_text1 = textwrap.dedent("""\
            You are an excellent AI assistant.
            You are in the metaverse space.
            Your goal is to generate user-directed spatial states.

            You are given the user's instructions and information showing the current spatial state of the metaverse.
            There is a cursor (red circle) on the space, and you can place objects at this cursor position and manipulate objects at the cursor position.
            The gray line shown on the image is a virtual guideline for using the move function.
            You can choose one of functions each turn: move_cursor/place_object/finish_action.
            Each function is described below:
            """)

        if self.position_mode == "absolute":
            initial_text2 = textwrap.dedent("""\
                (1) move_cursor
                # description:
                #    Move the cursor. Specify the absolute position to move the cursor on the x-axis(horizontal) and y-axis(vertical). That is, if (x, y) = (3.0,5.0) is specified, the cursor moves to this position.
                #    A move with a larger x means a move to the right, and a move with a smaller x means a move to the left.
                #    A move with a larger y means a move forward, and a move with a smaller y means a move backward (toward the front of the screen).
                #    The unit of distance moved is one guideline shown in the image.
                #    For example, assume the current position is (x, y) = (3.0, 5.0). Moving to (x, y) = (6.0, 6.0) means moving 3 squares to the right and 1 square to the front. A move to (x,y) = (2.0, -3.0) means a move 5 squares to the left and 8 squares backward.
                # params:
                #    x: x-axis of the absolute position to be moved.
                #    y: y-axis of the absolute position to be moved.
                def move_cursor(x: float, y:float)

                (2) place_object
                # description: Place a object in the cursor.
                # params:
                #    object_name: The object name you will place. The object you indicate here is immediately generated in a 3D-generated model and placed in the position highlighted by the red circle.
                def place_object(object_name: str)

                (3) finish_action
                # description: Finish the action.
                # params:
                #    reason: Reasons why the action was deemed acceptable to finish
                def finish_action(reason: str)

                You will be given the following information per turn.
                - User instructions (fixed)
                - Current space condition (any or all of the following will be given)
                    - An image view of the ground from an oblique angle.
                    - An image view of the ground from directly above.
                    - A text indicating position & scale of objects placed in space. This includes information on the current cursor position.
                - History of actions you have taken (It may not be given.)
                """)
        else:
            initial_text2 = textwrap.dedent("""\
                (1) move_cursor
                # description:
                #    Move the cursor. Specify the position to be moved by how much to move from the current position in the x-axis (horizontal) and y-axis (vertical) directions, respectively.
                #    The unit of distance moved is one guideline shown in the image.
                #    x = 1.0 means that the cursor is to be moved 1.0 (i.e., one guideline square) to the right in the image. x = -1.0 means that the cursor is to be moved to the left on the image. x = 0.0 means to not move in the x-axis direction.
                #    y = 1.0 means that the cursor is to be moved 1.0 (i.e., one guideline square) toward the forward of the screen, i,e, the back of the image. y = -1.0 means that the cursor is to be moved toward the front of the image. y = 0.0 means to not move in the y-axis direction.
                #    For example, (x, y) = (1.0, 0.0) means move 1.0 square to the right. (x, y) = (-2.0, 1.0) means a move to the left front.
                # params:
                #    x: The distance to be moved along the x-axis (horizontal).
                #    y: The distance to be moved along the y-axis (vertical).
                def move_cursor(x: float, y:float)

                (2) place_object
                # description: Place a object in the cursor.
                # params:
                #    object_name: The object name you will place. The object you indicate here is immediately generated in a 3D-generated model and placed in the position highlighted by the red circle.
                def place_object(object_name: str)

                (3) finish_action
                # description: Finish the action.
                # params:
                #    reason: Reasons why the action was deemed acceptable to finish
                def finish_action(reason: str)

                You will be given the following information per turn.
                - User instructions (fixed)
                - Current space condition (any or all of the following will be given)
                    - An image view of the ground from an oblique angle.
                    - An image view of the ground from directly above.
                    - A text indicating position & scale of objects placed in space. This includes information on the current cursor position.
                - History of actions you have taken (It may not be given.)
                """)

        if self.use_cot:
            initial_text3 = textwrap.dedent("""\
                Note1. For each action, you need to generate a json format string with the following as keys:
                    thought: An organized list of thoughts about the current status and what to do next. The content written here does not affect the content of the action, so you may write freely.
                    function: The name of the function corresponding to the action you will perform.
                    parameters: Parameters corresponding to the function.
                Note2. Try to determine actions one at a time for a given action history and screen state. As you perform one action, the spatial state will change accordingly and an updated image will be input, after which you should select a new action.
                Note3. Do not place multiple objects in the same position. Once an object is placed, move it to another position before placing the next object.

                Finally, here is an example of a user input and your action sequence in response to it.

                Input example:
                User input: "One house stands on the street and there is a red mailbox near the house."
                Your action example:
                {"thought": "...", "function": "place_object", "parameters": {"object_name": "a house"}}
                {"thought": "...", "function": "move_cursor", "parameters": {"x": 1.0, "y": -2.0}}
                {"thought": "...", "function": "place_object", "parameters": {"object_name": "a red mailbox"}}
                {"thought": "...", "function": "finish_action", "parameters": {"reason": "..."}}
                """)

        else:
            initial_text3 = textwrap.dedent("""\
                Note1. For each action, you need to generate a json format string with the following as keys. No other extra text should be generated.
                    function: The name of the function corresponding to the action you will perform.
                    parameters: Parameters corresponding to the function.
                Note2. Try to determine actions one at a time for a given action history and screen state. As you perform one action, the spatial state will change accordingly and an updated image will be input, after which you should select a new action.
                Note3. Do not place multiple objects in the same position. Once an object is placed, move it to another position before placing the next object.

                Finally, here is an example of a user input and your action sequence in response to it.

                Input example:
                User input: "One house stands on the street and there is a red mailbox near the house."
                Your action example:
                {"function": "place_object", "parameters": {"object_name": "a house"}}
                {"function": "move_cursor", "parameters": {"x": 1.0, "y": -2.0}}
                {"function": "place_object", "parameters": {"object_name": "a red mailbox"}}
                {"function": "finish_action", "parameters": {"reason": "..."}}
                """)

        initial_text = \
            initial_text1 + "\n" + initial_text2 + "\n" + initial_text3

        self.initial_message = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": f"{initial_text}"
                    },
                ],
            }
        ]

        self.pre_history = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "Below is a history of your previous actions. [Start of Action History]"
                    }
                ]
            },
        ]

        dummy_history_text = \
            """{"thought": "This is a dummy action history, generated by the system. Please generate actions in this format.", "function": "move_cursor", "parameters": {"x": 1.0, "y": 1.0}}""" \
                if self.use_cot else \
            """(This is a dummy action history, generated by the system. Please generate actions in this format.) {"function": "move_cursor", "parameters": {"x": 1.0, "y": 1.0}}"""
        self.dummy_history = [
            {
                "role": "assistant",
                "content": [
                    {
                        "type": "text",
                        "text": dummy_history_text
                    }
                ]
            },
        ]

        self.post_history = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "[End of Action History]"
                    }
                ]
            },
        ]


        self.pre_object_info = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "Below is information about the entities present in the space (including red circle indicating current position, area available for action, and placed objects). [Start of Object Information]"
                    }
                ]
            },
        ]

        self.post_object_info = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "[End of Object Information]"
                    }
                ]
            },
        ]

        self.last_message = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "Then, select the next action to be taken according to the format provided."
                    }
                ]
            },
        ]

    def generate_command(self, user_query, image_front, image_sky, history, object_info):

        history = json.loads(history)

        if self.use_image_status is False:
            image_front = None
            image_sky = None

        # If self.use_text_status is False, only cursor information is presented.
        if self.use_text_status is False:
            object_info = json.dumps([object for object in json.loads(object_info) if object["name"] == "cursor"])

        # User Messages and Images
        user_message_content = []
        user_message_content += [
            {
                "type": "text",
                "text": f"The user's instruction:"
            },
            {
                "type": "text",
                "text": f"{user_query}"
            }
        ]
        if image_front is not None:
            user_message_content += [
                {
                    "type": "text",
                    "text": "An image view of the ground from an oblique angle:"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_front
                    }
                },
            ]
        if image_sky is not None:
            user_message_content += [
                {
                    "type": "text",
                    "text": "An image view of the ground from directly above:"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_sky
                    }
                },
            ]
        if object_info is not None:
            user_message_content += [
                {
                    "type": "text",
                    "text": "A text indicating position & scale of objects placed in space:",
                },
                {
                    "type": "text",
                    "text": f"{object_info}",
                },
            ]

        user_message = [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "Below is the user's instructions and information showing the current spatial state of the metaverse."
                    }
                ]
            },
            {
                "role": "user",
                "content": user_message_content,
            },
        ]

        # History to be given to the AI model.
        # If there is no history at all, a previously created pseudo-history is used.
        if len(history)>0 and self.use_history==True:
            history = history
        else:
            history = copy.deepcopy(self.dummy_history)

        print(f"Histroy size: {len(history)}")
        print(f"Object info: {object_info}")

        # The data (text and images) to be entered into GPT4 is a concatenation of the following
        # initial_message: prompt text
        # user_message: user instructions and an image of the virtual space
        # history: agent's history of past actions
        # pre_history, post_history: text before and after the history
        # last_message: final instruction prompt text
        messages = \
            self.initial_message + \
            user_message + \
            self.pre_history + \
            history + \
            self.post_history + \
            self.last_message

        data = {
            "model": "gpt-4-vision-preview",
            "messages": messages,
            "max_tokens": 300,
            "temperature": 0.1,
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        # If an error occurs, it is generated again. This is done up to a maximum of three times.
        try_count_max = 3
        generated_json = None
        for try_count in range(1, try_count_max+1):
            try:
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    json=data,
                    headers=headers,
                ).json()

                pprint(response)
                print()

                generated_text = response["choices"][0]["message"]["content"]
                # Extraction of the actual json part. Remove \n, \t as it cannot be extracted if present.
                generated_text = re.search(r"{.*}", generated_text.replace("\n", "").replace("\t", ""))[0]
                generated_json = json.loads(generated_text)
                break
            except:
                print(f"{try_count}/{try_count_max}: Error has occured. Try again")
                print(traceback.format_exc())

        if generated_json is None:
            generated_text = '{"function": "suspend_action"}'
            generated_json = json.loads(generated_text)

        history.append(
            {
                "role": "assistant",
                "content": [
                    {
                        "type": "text",
                        "text": generated_text
                    }
                ]
            },
        )

        response = {
            "command": generated_json,
            "history": history,
            "position_mode": self.position_mode,
        }

        return response