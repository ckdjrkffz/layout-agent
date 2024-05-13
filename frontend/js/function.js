import config from "../../config/config.json" assert { type: 'json' };

export async function connect_demo_api() {

    var backend_ip = config.backend.ip
    var backend_port = config.backend.port
    var url = backend_ip + ":" + backend_port + "/demo_api"

    var formData = new FormData();
    formData.append("demo", "demo");

    var response = await fetch(`${url}`,
        {
            method: "POST",
            body: formData,
        }
    );
}

// Generate the 3D object by using backend API
// It returns the 3D object glb file path
export async function get_object(obj_name) {

    var url = "http://rdcksv-1.crl.hitachi.co.jp:25032/text_to_3d";
    var params = {prompt : obj_name};
    var query = new URLSearchParams(params);

    var result = await fetch(`${url}?${query}`);
    var data = await result.json();
    var obj_path = await data.obj_path;
    obj_path = "../../" + obj_path;

    return obj_path;
}

export async function get_command(text, img_front=null, img_sky=null, history=[], object_info="") {

    var url = "http://rdcksv-1.crl.hitachi.co.jp:25032/prompt_to_command";

    var formData = new FormData();
    formData.append("text", text);
    formData.append("img_front", img_front);
    formData.append("img_sky", img_sky);
    formData.append("history", JSON.stringify(history));
    formData.append("object_info", JSON.stringify(object_info));

    var response = await fetch(`${url}`,
        {
            method: "POST",
            body: formData,
        }
    );
    var response = await response.json();

    return response;
}

export function move_cursor(x_position, z_position, y_position=null, mode="relative"){

    var camera = document.getElementById("camera_wrapper");
    var cursor = document.getElementById("cursor");
    var z_position = z_position
    var x_position = -x_position
    var y_position = y_position

    if (mode == "relative"){
        if (y_position == null){
            y_position = 0;
        }

        var move_z_distance = z_position;
        var move_x_distance = x_position;
        var move_y_distance = y_position;

        var rotate = camera.object3D.rotation.y + Math.PI;

        var move_z = move_z_distance * Math.cos(rotate) - move_x_distance * Math.sin(rotate);
        var move_x = move_z_distance * Math.sin(rotate) + move_x_distance * Math.cos(rotate);
        var move_y = move_y_distance;
    }
    else if (mode == "absolute"){
        var cursor_z_position = cursor.object3D.position.z;
        var cursor_x_position = cursor.object3D.position.x;
        var cursor_y_position = cursor.object3D.position.y;

        if (y_position == null){
            y_position = cursor_y_position;
        }

        var move_z = (z_position - cursor_z_position);
        var move_x = (x_position - cursor_x_position);
        var move_y = (y_position - cursor_y_position);
    }

    // Move camera position
    camera.object3D.position.z += move_z;
    camera.object3D.position.x += move_x;
    camera.object3D.position.y += move_y;

    // Move cursor position
    cursor.object3D.position.z += move_z;
    cursor.object3D.position.x += move_x;
}

export function rotate_cursor(direction, angle){

    if (direction=="counter_clockwise"){
        angle = angle;
    }
    else if (direction=="clockwise"){
        angle = -angle;
    }

    var camera = document.getElementById("camera_wrapper");
    var cursor = document.getElementById("cursor");

    var z_pos_diff = camera.object3D.position.z - cursor.object3D.position.z
    var x_pos_diff = camera.object3D.position.x - cursor.object3D.position.x

    var z_pos_diff_rotate = z_pos_diff * Math.cos(angle) - x_pos_diff * Math.sin(angle);
    var x_pos_diff_rotate = z_pos_diff * Math.sin(angle) + x_pos_diff * Math.cos(angle);

    camera.object3D.position.z = cursor.object3D.position.z + z_pos_diff_rotate
    camera.object3D.position.x = cursor.object3D.position.x + x_pos_diff_rotate

    camera.object3D.rotation.y += angle;
}

export function place_object(obj_name, obj_path){
    var asset_class = document.getElementById("asset");

    // Register object in asset list
    var asset_item_obj = document.createElement('a-asset-item');
    var obj_id = obj_name.replace(/ /g, '_') + "_obj";
    asset_item_obj.setAttribute("id", obj_id);
    asset_item_obj.setAttribute("src", obj_path);
    asset_class.appendChild(asset_item_obj);

    // Obtain current camera position
    var camera = document.getElementById("camera_wrapper");
    var camera_position = camera.object3D.position;
    var camera_rotation = camera.object3D.rotation;
    var rotate = camera_rotation.y + Math.PI

    // Obtain current cursor position
    var cursor = document.getElementById("cursor");
    var cursor_position = cursor.object3D.position;
    var cursor_rotation = cursor.object3D.rotation;

    var view = "third";

    // In the third-person view, place the 3d object in the cursor position
    // Default setting is this.
    if (view=="third"){
        var place_z = cursor_position.z;
        var place_y = 1.0;
        var place_x = cursor_position.x;
        var rotate_y = 360;
    // In the first-person view, place the 3d object in front of the eye of the camera position
    } else if(view=="first"){
        var move_z = 2.0 * Math.cos(rotate);
        var move_x = 2.0 * Math.sin(rotate);
        var place_z = camera_position.z + move_z;
        var place_y = camera_position.y
        var place_x = camera_position.x + move_x;
        var rotate_y = (camera_rotation.y + Math.PI) / (2 * Math.PI) * 360;
    }

    var entity3d = document.createElement('a-gltf-model');
    entity3d.setAttribute("class", "placed_object");
    entity3d.setAttribute("name", obj_name);
    entity3d.setAttribute("src", "#"+obj_id);
    entity3d.setAttribute('position', {x: place_x, y: place_y, z: place_z});
    entity3d.setAttribute('scale', {x: 1.0, y: 1.0, z: 1.0});
    entity3d.setAttribute('rotation', {x: 0, y: rotate_y, z: 0});
    var scene_obj = document.getElementById("main_scene");
    scene_obj.appendChild(entity3d);
}

// Selects the object closest and within a certain distance from the cursor.
// Then, moves the camera, cursor, and object in the specified direction.
export function move_object(x_position, z_position, y_position=null, mode="relative"){
    var placed_object_list = document.getElementsByClassName("placed_object");

    var cursor = document.getElementById("cursor");

    // Search the closest the object
    var min_distance = 2;
    var min_distance_num = -1;
    for (var i = 0; i < placed_object_list.length; i++){
        var placed_object = placed_object_list[i]

        var x_distance = placed_object.object3D.position.x - cursor.object3D.position.x;
        var y_distance = 0
        var z_distance = placed_object.object3D.position.z - cursor.object3D.position.z;

        var distance = Math.sqrt(Math.pow(x_distance, 2) + Math.pow(y_distance, 2) + Math.pow(z_distance, 2));

        if (distance < min_distance){
            min_distance = distance;
            min_distance_num = i;
        }
    }

    if (min_distance_num == -1){
        console.log("Cannot find nearest object");
    }

    else{
        var camera = document.getElementById("camera_wrapper");
        var cursor = document.getElementById("cursor");
        z_position = z_position
        x_position = -x_position
        y_position = y_position

        if (mode == "relative"){
            if (y_position == null){
                y_position = 0;
            }

            var move_z_distance = z_position;
            var move_x_distance = x_position;
            var move_y_distance = y_position;

            var rotate = camera.object3D.rotation.y + Math.PI;

            var move_z = move_z_distance * Math.cos(rotate) - move_x_distance * Math.sin(rotate);
            var move_x = move_z_distance * Math.sin(rotate) + move_x_distance * Math.cos(rotate);
            var move_y = move_y_distance;
        }
        else if (mode == "absolute"){

            var cursor_z_position = cursor.object3D.position.z;
            var cursor_x_position = cursor.object3D.position.x;
            var cursor_y_position = cursor.object3D.position.y;

            if (y_position == null){
                var y_position = cursor_y_position;
            }

            var move_z = (z_position - cursor_z_position);
            var move_x = (x_position - cursor_x_position);
            var move_y = (y_position - cursor_y_position);
        }

        // Move the camera position
        camera.object3D.position.z += move_z;
        camera.object3D.position.x += move_x;
        camera.object3D.position.y += move_y;

        // Move the cursor position
        cursor.object3D.position.z += move_z;
        cursor.object3D.position.x += move_x;

        // Move the target object position
        target_object = placed_object_list[min_distance_num];
        target_object.object3D.position.z += move_z;
        target_object.object3D.position.x += move_x;
    }
}


// Selects the nearest object within a certain distance from the cursor.
// Then, rotates it in the specified direction
export function rotate_object(angle){
    var placed_object_list = document.getElementsByClassName("placed_object");

    var cursor = document.getElementById("cursor");

    // Search the closest the object
    var min_distance = 2;
    var min_distance_num = -1;
    for (var i = 0; i < placed_object_list.length; i++){
        var placed_object = placed_object_list[i]

        var x_distance = placed_object.object3D.position.x - cursor.object3D.position.x;
        var y_distance = 0
        var z_distance = placed_object.object3D.position.z - cursor.object3D.position.z;

        var distance = Math.sqrt(Math.pow(x_distance, 2) + Math.pow(y_distance, 2) + Math.pow(z_distance, 2));

        if (distance < min_distance){
            min_distance = distance;
            min_distance_num = i;
        }
    }

    if (min_distance_num == -1){
        console.log("Cannot find nearest object");
    }
    else{
        var target_object = placed_object_list[min_distance_num];
        target_object.object3D.rotation.y -= angle;
    }
}

// Take a screenshot of the current space.
export function generate_screenshot(image_width=512, image_height=256, download_image=false){

    var camera = document.getElementById("camera_wrapper");
    var camera2 = document.getElementById("camera_wrapper2");
    var cursor = document.getElementById("cursor");

    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");

    // Resolution of screenshot
    var width = image_width;
    var height = image_height;
    canvas.width = width
    canvas.height = height

    // Take a screenshot from above the cursor (position_diff=(0, 9.9, 0), rotate=(Math.PI/2, Math.PI, 0))
    camera.object3D.position.y = cursor.object3D.position.y + 9.9;
    camera.object3D.position.z = cursor.object3D.position.z;
    camera2.object3D.rotation.x = -Math.PI/2;

    var screenshot = document.querySelector('a-scene').components.screenshot.getCanvas('perspective');
    context.drawImage(screenshot, 0, 0, width, height);
    var img_sky = canvas.toDataURL('image/png');

    // To download the created canvas
    if(download_image == true){
        var a = document.createElement("a");
        a.href = img_sky;
        a.download = "sky.png";
        a.click();
    }

    // Take a screenshot from diagonally above the cursor (position_diff=(0, 4.9, -5), rotate=(Math.PI/4, Math.PI, 0))
    camera.object3D.position.y = cursor.object3D.position.y + 5 - 0.1;
    camera.object3D.position.z = cursor.object3D.position.z - 5;
    camera2.object3D.rotation.x = -Math.PI/4;

    var screenshot = document.querySelector('a-scene').components.screenshot.getCanvas('perspective');
    context.drawImage(screenshot, 0, 0, width, height);
    var img_front = canvas.toDataURL('image/png');

    // To download the created canvas
    if(download_image == true){
        var a = document.createElement("a");
        a.href = img_front;
        a.download = "front.png";
        a.click();
    }

    return [img_front, img_sky];
}


// Get name, position and size of all objects (cursor, floor, placed objects)
export function get_object_info(){

    var object_info = [];

    var object_list =
        [
            document.getElementById("cursor"),
            ...document.getElementsByClassName("room"),
            ...document.getElementsByClassName("placed_object")
        ];

    // Other placed object
    for (var i = 0; i < object_list.length; i++){
        var object = object_list[i]

        // Change the value to be retrieved depending on whether it is an image or not
        var position_x = -Math.round(object.object3D.position.x * 10)/10;
        var position_y = Math.round(object.object3D.position.z * 10)/10;
        if (object.className.includes("img")){
            var scale_x = Math.round(object.object3D.scale.x * 10)/10;
            var scale_y = Math.round(object.object3D.scale.y * 10)/10;
        }
        else {
            var scale_x = Math.round(object.object3D.scale.x * 10)/10;
            var scale_y = Math.round(object.object3D.scale.z * 10)/10;
        }

        object_info.push({
            "name": object.getAttribute("name"),
            "position": {
                "x": position_x,
                "y": position_y,
            },
            "scale": {
                "x": scale_x,
                "y": scale_y,
            }
        });
    }

    return object_info;
}