"""
process_batch8.py

Preprocesado del bloque "FOREGROUND + SPEED": dos piezas de primer plano
con motion blur horneado en el propio PNG (para una capa que pasa mas
rapido que la pista, no decoracion normal), un efecto de estela de polvo y
otro de restos volando (para la sensacion de velocidad real, no solo
FLOW/REDLINE), y una valla de cuerda con neumaticos.

Mismo pipeline que las tandas anteriores: recorte al alpha real +
reescalado.

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
    ("batch8/raw_0_foreground_a.webp", "foreground_a.png", 700),
    ("batch8/raw_1_speed_debris.webp", "speed_debris.png", 600),
    ("batch8/raw_2_speed_streak.webp", "speed_streak.png", 600),
    ("batch8/raw_3_rope_tire_barrier.webp", "rope_tire_barrier.png", 600),
    ("batch8/raw_4_foreground_b.webp", "foreground_b.png", 700),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
