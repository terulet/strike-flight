"""
process_batch5.py

Preprocesado de la quinta tanda (banderas de peligro, valla de cuerda,
marca de derrape) hacia los PNG en src/sprites/. Mismo pipeline simple que
las tandas anteriores: recorte al alpha real + reescalado.

De esta tanda se descartaron deliberadamente (ver decision con el usuario):
raw_0_jump_sign_dup.webp (variante repetida del cartel de JUMP ya integrado)
y raw_2_bump_texture_a.webp (franja ancha de terreno, mas textura de
terreno que decal de impacto puntual). Se quedan en batch5/ como fuente
por si se decide usarlas mas adelante, pero no tienen salida en
src/sprites/.

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
    ("batch5/raw_1_danger_flags.webp", "danger_flags.png", 550),
    ("batch5/raw_4_rope_barrier_a.webp", "rope_barrier.png", 700),
    ("batch5/raw_3_skid_texture_a.webp", "tire_skid.png", 640),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
