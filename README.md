# Layout Generation Agents with Large Language Models

This is code of our paper "Layout Generation Agents with Large Language Models". When you input user instructions, a language model-driven agent places objects in the virtual space to create a layout that reflects the instructions.

[arXiv](https://arxiv.org/pdf/2405.08037)

<div align="center">
    Demo movie<br>
    <movie src="https://github.com/ckdjrkffz/layout-agent/assets/129842419/950ddfeb-2368-48f0-ad70-66d02a02f89f">
</div>
<br><br>

<div align="center">
    Task overview<br>
    <img src="https://github.com/ckdjrkffz/layout-agent/assets/129842419/c6ab0de5-bc03-42cc-b845-49038b933e2e">
</div>
<br><br>

<div align="center">
    Algorithm overview<br>
    <img src="https://github.com/ckdjrkffz/layout-agent/assets/129842419/661fd610-a750-4e41-ab24-9ee75f6bf9f0">
</div>

## Requirements

- python 3.10.5
- Instrall libraries by using requirements.txt
```
pip install -r requirements.txt
```

## How to run & use

- First, please set the `OpenAI key`, `frontend port` and `backend port` in the `config/config.json`.
- The system consists of an A-Frame based frontend and a Flask based backend. Both are contained within this repository.

### Backend

- Launch api searver by `python api.py`
    - This launch may take a few minutes.

### Frontend

- Launch HTTP server by `python run.py` and access to `<host_name>:<port>/frontend/index_house.html` from a browser.
    - Two samples of virtual environments are provided: one is `index_house.html`, in which a house is placed in the center of a meadow, and the other is `index_room.html`, which imitates a room.
- How to use:
    - Cursor move: The cursor can be moved by WASD and the camera can be rotated by QE.
    - Place object: Enter the object name or detailed description (e.g., a tree, a red flower) you want to generate in the text box, press the "Place" button, and the object will be placed at the cursor position. The object will then be placed at the cursor position.
        - Actually, the specified text is entered into the 3D object generation model and the generated object is placed. Once generated, the object is stored in the server (`assets/3d_object`) and reused when the same object is specified again.
        - Note that object generation with shap-e does not always generate the same object for the same text because of the effect of randomness.
    - Rotate object: Rotates the object at the cursor position. Click "Rotate" button.
    - Auto layout generation: Enter layout instructions (e.g., "trees standing around the house") in the text box and press the "Layout" button to create a space that reflects the layout instructions. The layout is created by the GPT-4V driven agent operating according to the instructions. For more information, please refer to our paper.
        - It should be noted that sometimes OpenAI may respond with "Your input image may contain content that is not allowed by our safety system." making it impossible to continue with layout generation. In this case, you will need to reload your browser and start over.

## Licence
Apache License 2.0