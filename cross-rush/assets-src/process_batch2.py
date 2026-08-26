"""
process_batch2.py

Preprocesado de la segunda tanda de assets (arco de salida, arco de
checkpoint, barrera de neumaticos, cluster de rocas, banderola) hacia los
PNG que consume el juego en src/sprites/. A diferencia de process.py (la
moto), estos assets no necesitan deteccion de ruedas ni nivelado: son
props estaticos, asi que el pipeline es solo "recorta al alpha real +
reescala a un tamano razonable de juego".

Requisitos: pip install pillow numpy

No se ejecuta automaticamente en build/test: es una herramienta de autoria.
Ojo antes de re-ejecutar: si ya hay sprites verificados a mano en el juego
(por ejemplo un ajuste de escala/posicion hecho a ojo en Renderer.ts),
volver a correr esto los sobreescribe sin avisar. Verifica siempre en el
navegador despues de tocar esta carpeta.
"""

from PIL import Image
import numpy as np

OUT = "../src/sprites"


def alpha_bbox(im, pad=4):
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] > 8)
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1))


def downscale(im, max_dim):
    scale = min(1.0, max_dim / max(im.size))
    if scale < 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


JOBS = [
    ("batch2/raw_0_start_gate.webp", "start_gate.png", 1000),
    ("batch2/raw_1_checkpoint_gate.webp", "checkpoint_gate.png", 900),
    ("batch2/raw_2_barrier.webp", "barrier.png", 700),
    ("batch2/raw_3_rock_cluster_a.webp", "rock_cluster_a.png", 600),
    ("batch2/raw_4_banner_flag.webp", "banner_flag.png", 500),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
