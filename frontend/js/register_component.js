import {
    connect_demo_api,
    get_object,
    get_command,
    move_cursor,
    rotate_cursor,
    place_object,
    move_object,
    rotate_object,
    generate_screenshot,
    get_object_info
} from "./function.js";


// UI for operate; place object and instrcut to LLM
AFRAME.registerComponent('operate_ui', {
    init: function () {
        this.init_uploadtext();

        var asset_class = this.asset_class = document.createElement('asset');
        this.el.appendChild(asset_class);
    },

    // initialize
    init_uploadtext: function (evt) {

        // input textbox
        var inputEl = this.inputEl = document.createElement('input');
        var inputDefaultValue = this.inputDefaultValue = 'Instruction';
        inputEl.id = "command-form-input"
        inputEl.classList.add('command-form-input');

        inputEl.onfocus = function () {
            if (this.value !== inputDefaultValue) { return; }
            this.value = '';
        };
        inputEl.onblur = function () {
            if (this.value) { return; }
            this.value = inputDefaultValue;
        };
        inputEl.value = inputDefaultValue;

        // place object button
        var placeButtonEl = this.placeButtonEl = document.createElement('button');
        placeButtonEl.id = "command-form-button-place"
        placeButtonEl.classList.add('command-form-button');
        placeButtonEl.innerHTML = 'Place';
        placeButtonEl.addEventListener('click', this.placeButtonClicked.bind(this));

        // rotate object button
        var rotateButtonEl = this.rotateButtonEl = document.createElement('button');
        rotateButtonEl.id = "command-form-button-rotate"
        rotateButtonEl.classList.add('command-form-button');
        rotateButtonEl.innerHTML = 'Rotate';
        rotateButtonEl.addEventListener('click', this.rotateButtonClicked.bind(this));

        // AI button
        var aiButtonEl = this.aiButtonEl = document.createElement('button');
        aiButtonEl.id = "command-form-button-ai"
        aiButtonEl.classList.add('command-form-button');
        aiButtonEl.innerHTML = 'Layout';
        aiButtonEl.addEventListener('click', this.aiButtonClicked.bind(this));

        // Wrapper of above elements
        var uploadContainerEl = this.uploadContainerEl = document.createElement('div');
        uploadContainerEl.classList.add('command-form');

        uploadContainerEl.appendChild(inputEl);
        uploadContainerEl.appendChild(placeButtonEl);
        uploadContainerEl.appendChild(rotateButtonEl);
        uploadContainerEl.appendChild(aiButtonEl);
        this.el.appendChild(uploadContainerEl);

        // CSS style
        var style = document.createElement('style');
        var css = `
            .command-form  {
                box-sizing: border-box;
                display: inline-block;
                height: 34px;
                padding: 0;
                width: 50%;
                bottom: 20px;
                left: 25%;
                right: 25%;
                position: absolute;
                color: white;
                font-size: 12px;
                line-height: 12px;
                border: none;
                border-radius: 5px;
            }
            .command-form.hidden {
                display: none;
            }
            .command-form-button {
                cursor: pointer;
                padding: 0px 2px 0 2px;
                font-weight: bold;
                color: #666;
                border: 3px solid #666;
                box-sizing: border-box;
                vertical-align: middle;
                width: 25%;
                max-width: 80px;
                border-radius: 10px;
                height: 34px;
                background-color: white;
                margin: 0;
            }
            .command-form-button:hover {
                border-color: #ef2d5e;
                color: #ef2d5e;
            }
            .command-form-status {
                border-color: #ef2d5e;
                color: #ef2d5e;
            }
            .command-form-input {
                color: #666;
                vertical-align: middle;
                padding: 0px 10px 0 10px;
                border: 0;
                width: 60%;
                height: 100%;
                border-radius: 10px;
                margin-right: 10px;
            }

            @media only screen and (max-width: 800px) {
                .command-form {
                    margin: auto;
                }
                .command-form-input {
                    width: 50%;
                }
            }
            @media only screen and (max-width: 700px) {
                .command-form {
                    display: none
                }
            }
          `;

        if (style.styleSheet) {
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }
        document.getElementsByTagName('head')[0].appendChild(style);
    },

    // When the place button is clicked, a 3D object is generated and placed in the cursor position.
    placeButtonClicked: async function (e) {
        var obj_name = this.inputEl.value;
        console.log("Place button clicked.", obj_name);
        var obj_path = await get_object(obj_name);
        place_object(obj_name, obj_path);
    },

    // When the rotate button is clicked, the nearest 3D model is rotated.
    rotateButtonClicked: async function (e) {
        var obj_name = this.inputEl.value;
        console.log("Rotate button clicked.", obj_name);
        rotate_object(Math.PI / 4);
    },

    // When the submit button is clicked, LLM follows the instructions.
    aiButtonClicked: async function (e) {
        console.log("AI Button clicked");
        var history = [];
        var prompt = this.inputEl.value;

        for (var i = 0; i < 30; i++){

            await connect_demo_api();

            var [img_front, img_sky] = generate_screenshot();
            var object_info = get_object_info();

            var response = await get_command(prompt, img_front, img_sky, history, object_info);

            var command = response.command;
            var history = response.history;
            var position_mode = response.position_mode;

            if (command.function == "move_cursor"){
                console.log("move_cursor");

                var x_distance = command.parameters.x;
                var y_distance = command.parameters.y;

                move_cursor(x_distance, y_distance, null, position_mode);
            }
            else if (command.function == "place_object"){
                console.log("Command: place_object");
                var obj_name = command.parameters.object_name;

                var obj_path = await get_object(obj_name);
                place_object(obj_name, obj_path);
            }
            else if (command.function == "move_object"){
                console.log("Command: move_object");

                var x_distance = command.parameters.x;
                var y_distance = command.parameters.y;

                move_object(x_distance, y_distance, null, mode=position_mode);
            }
            else if (command.function == "rotate_object"){
                console.log("Command: rotate_object");
                var angle = command.parameters.rotate_angle;
                rotate_object(angle);
            }
            else if (command.function == "finish_action"){
                console.log("Command: finish_action");
                console.log("Action is finished");
                console.log("Reason: ", command.parameters.reason);
                break;
            }
            else if (command.function == "suspend_action"){
                console.log("The actions is suspend because OpenAI did not respond.");
                break;
            }
            else {
                console.log("Suspend due to unexpected output.");
                break;
            }
        }

        console.log("")

        console.log("AI loop was ended");

        alert("The action is finished.");
    },
});


// Function to accept WASDQE keybord input and move the camera (camera wrapper)
// A-Frame default operating functions are disabled.
AFRAME.registerComponent('camera_wrapper', {
    // Default position and rotation of camera
    init: function () {
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        this.move_distance = 1.0
        this.rotate_angle = Math.PI/90
        this.current_camera_angle = Math.PI

        // Position
        this.el.object3D.position.x = 0
        this.el.object3D.position.y = 5
        this.el.object3D.position.z = -5

        // Rotation
        // To simplify the calculation, two camera wrappers are provided to manage the x-axis and y-axis orientation for each.
        this.el.object3D.rotation.y = this.current_camera_angle
        var camera2 = document.getElementById("camera_wrapper2");
        camera2.object3D.rotation.x = -Math.PI/4
    },

    onKeyDown: function(e){
        // Don't move and rotate camera when using input UI.
        if(e.srcElement.className.includes("command-form-input")){
            return
        }

        // Move
        if (e.code=="KeyW"){
            move_cursor(0, this.move_distance)
        }
        else if (e.code=="KeyS"){
            move_cursor(0, -this.move_distance)
        }
        else if (e.code=="KeyA"){
            move_cursor(-this.move_distance, 0)
        }
        else if (e.code=="KeyD"){
            move_cursor(this.move_distance, 0)
        }
        // rotate
        else if (e.code=="KeyQ"){
            rotate_cursor("counter_clockwise", this.rotate_angle)
        }
        else if (e.code=="KeyE"){
            rotate_cursor("clockwise", this.rotate_angle)
        }
    },
});


// Initialize space
AFRAME.registerComponent('initialize_field', {
    init: function () {

        var line_area_width = 1000;
        var line_area_height = 1000;
        var line_thickness = 0.1;

        // Set a grid line (Vertical and horizontal black lines)
        for (var i = -line_area_height/2; i < line_area_height/2; i++){
            var black_bar = document.createElement('a-plane');

            black_bar.setAttribute("id", "black_bar" + i);
            black_bar.setAttribute("class", "black_bar");
            black_bar.setAttribute('color', "#444444");

            black_bar.object3D.position.x = 0.5;
            black_bar.object3D.position.y = 0.05;
            black_bar.object3D.position.z = i+0.5;

            black_bar.object3D.scale.x = 100;
            black_bar.object3D.scale.y = line_thickness;
            black_bar.object3D.scale.z = 0.2;

            black_bar.object3D.rotation.x = -Math.PI/2;
            black_bar.object3D.rotation.y = 0;
            black_bar.object3D.rotation.z = 0;

            var scene_obj = document.getElementById("main_scene");
            scene_obj.appendChild(black_bar);
        }

        for (var i = -line_area_width/2; i < line_area_width/2; i++){
            var black_bar = document.createElement('a-plane');

            black_bar.setAttribute("id", "black_bar" + i);
            black_bar.setAttribute('color', "#444444");

            black_bar.object3D.position.x = i+0.5;
            black_bar.object3D.position.y = 0.05;
            black_bar.object3D.position.z = 0.5;

            black_bar.object3D.scale.x = line_thickness;
            black_bar.object3D.scale.y = 100;
            black_bar.object3D.scale.z = 0.2;

            black_bar.object3D.rotation.x = -Math.PI/2;
            black_bar.object3D.rotation.y = 0;
            black_bar.object3D.rotation.z = 0;

            var scene_obj = document.getElementById("main_scene");
            scene_obj.appendChild(black_bar);
        }
    }
});

