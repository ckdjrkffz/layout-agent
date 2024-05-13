import os
import time
import numpy as np
import torch

from shap_e.diffusion.sample import sample_latents
from shap_e.diffusion.gaussian_diffusion import diffusion_from_config
from shap_e.models.download import load_model, load_config
from shap_e.util.notebooks import decode_latent_mesh

import tempfile
import trimesh

# Generate 3D object from text inpurt using the Shap-E model.
# The following information was used as a reference.
# https://github.com/openai/shap-e/blob/main/shap_e/examples/sample_text_to_3d.ipynb
# https://github.com/openai/shap-e/issues/18
class GenerateObjectModel():

    def __init__(self):

        start = time.time()

        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.xm = load_model('transmitter', device=self.device)
        self.model = load_model('text300M', device=self.device)
        self.diffusion = diffusion_from_config(load_config('diffusion'))

        self.obj_dict={}
        root_path = "assets/3d_object"
        for obj_name in os.listdir(root_path):
            obj_path = f"{root_path}/{obj_name}/object.glb"
            if os.path.exists(obj_path):
                self.obj_dict[obj_name] = obj_path

    def to_glb(self, latent: torch.Tensor, mesh_path: str) -> str:

        # save ply file
        root_dir = "tmp"
        os.makedirs(root_dir, exist_ok=True)
        ply_path = tempfile.NamedTemporaryFile(suffix='.ply', dir=root_dir, delete=False, mode='w+b')
        decode_latent_mesh(self.xm, latent).tri_mesh().write_ply(ply_path)

        # convert from ply file to glb file and save it
        mesh = trimesh.load(ply_path.name)
        rot = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
        mesh = mesh.apply_transform(rot)
        rot = trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0])
        mesh = mesh.apply_transform(rot)
        mesh.export(mesh_path, file_type='glb')

        return mesh_path

    # recieve text and generate corresponding 3D object
    def generate_object(self, prompt):

        obj_name = prompt.replace(" ", "_")

        obj_path = self.obj_dict.get(obj_name)

        if obj_path is not None:
            print("Return exist object")
            return obj_path
        else:
            print("Generate new object")
            start_time = time.time()
            batch_size = 1
            guidance_scale = 15.0

            latents = sample_latents(
                batch_size=batch_size,
                model=self.model,
                diffusion=self.diffusion,
                guidance_scale=guidance_scale,
                model_kwargs=dict(texts=[prompt] * batch_size),
                progress=True,
                clip_denoised=True,
                use_fp16=True,
                use_karras=True,
                karras_steps=64,
                sigma_min=1e-3,
                sigma_max=160,
                s_churn=0,
            )

            root_path = "assets/3d_object"
            obj_path = f"{root_path}/{obj_name}/object.glb"
            os.makedirs(f"{root_path}/{obj_name}", exist_ok=True)

            self.to_glb(latents[0], obj_path)

            print(f"End generating. Object:{obj_name}. Time: {time.time() - start_time}")

            self.obj_dict[obj_name] = obj_path

            return obj_path