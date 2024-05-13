from flask import Flask, render_template, request
from flask_cors import CORS
import argparse
import json

from backend.generate_object import GenerateObjectModel
from backend.generate_command import GenerateCommandModel

app = Flask(__name__)
CORS(app)

@app.route("/demo_api", methods=["GET", "POST"])
def demo_api():
    res = {
        "response": "None",
    }

    return res

@app.route("/text_to_3d", methods=["GET", "POST"])
def generate_object():
    if request.method=="GET":
        prompt = str(request.args.get("prompt"))
    else:
        prompt = str(request.form["prompt"])

    obj_path = generate_object_model.generate_object(prompt)

    res = {
        "obj_path": obj_path,
    }

    return res

@app.route("/prompt_to_command", methods=["GET", "POST"])
def generate_command():
    text = request.form.get("text")
    img_front = request.form.get("img_front")
    img_sky = request.form.get("img_sky")
    history = request.form.get("history")
    object_info = request.form.get("object_info")

    response = generate_command_model.generate_command(text, img_front, img_sky, history, object_info)

    return response

if __name__ == '__main__':

    parser = argparse.ArgumentParser()

    parser.add_argument("--config_path", type=str, default="config/config.json")

    parser.add_argument("--disable_history", action="store_true")
    parser.add_argument("--disable_cot", action="store_true")
    parser.add_argument("--disable_image_status", action="store_true")
    parser.add_argument("--disable_text_status", action="store_true")
    parser.add_argument("--disable_absolute_position", action="store_true")

    args = parser.parse_args()

    with open(args.config_path)as f:
        config = json.load(f)
    args.port = config["backend"]["port"]

    generate_object_model = GenerateObjectModel()
    generate_command_model = GenerateCommandModel(args)

    app.run(debug=False, host='0.0.0.0', port=args.port)
