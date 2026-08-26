"""
process_batch9.py

Preprocesado de la vida de evento: publico, pickup de asistencia, carpa de
boxes, comisario con bandera y fotografo. A diferencia de las tandas
anteriores, estos NO se reparten al azar por la pista (ver
Renderer.drawAtmosphere): son 1-2 apariciones fijas en puntos con sentido
narrativo, asi que no hace falta variar su escala/seed, solo recortar y
reescalar.

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
    ("batch9/raw_0_crowd.webp", "crowd.png", 800),
    ("batch9/raw_1_pickup_truck.webp", "pickup_truck.png", 700),
    ("batch9/raw_2_paddock_tent.webp", "paddock_tent.png", 700),
    ("batch9/raw_3_marshal_flag.webp", "marshal_flag.png", 420),
    ("batch9/raw_4_photographer.webp", "photographer.png", 420),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
