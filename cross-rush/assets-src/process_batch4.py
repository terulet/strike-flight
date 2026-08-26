"""
process_batch4.py

Preprocesado de la cuarta tanda (dos capas de fondo del canon, pose de
caida del piloto, llama de REDLINE) hacia los PNG en src/sprites/. Mismo
pipeline simple que batch2/3: recorte al alpha real + reescalado.

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
    ("batch4/raw_0_bg_far.webp", "bg_far.png", 1800),
    ("batch4/raw_1_bg_mid.webp", "bg_mid.png", 1800),
    ("batch4/raw_2_rider_crash.webp", "rider_crash.png", 420),
    ("batch4/raw_3_redline_fx.webp", "redline_fx.png", 500),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
