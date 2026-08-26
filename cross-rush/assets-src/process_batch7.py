"""
process_batch7.py

Preprocesado de la septima tanda: solo 2 props (rampa pequena con bandera
de corona, monticulo de neumaticos con banderas). El resto de imagenes de
ese envio (barrera rota, roca grande, tronco) eran el mismo contenido de
batch6 reenviado con otra compresion -mismo aspecto visual, distinto hash
de archivo-, asi que no se reprocesaron para no duplicar sprites.

Requisitos: pip install pillow numpy
No se ejecuta automaticamente en build/test: herramienta de autoria.
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
    ("batch7/raw_0_ramp_small.webp", "ramp_small.png", 550),
    ("batch7/raw_4_tire_mound.webp", "tire_mound.png", 600),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
