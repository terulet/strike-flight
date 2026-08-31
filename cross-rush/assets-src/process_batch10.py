"""
process_batch10.py

Preprocesado de la tanda "RISK / REWARD GAMEPLAY": 5 piezas, cada una
ligada a una mecanica real (no solo decorativa):

  speed_pad  -> panel de suelo que da boost de velocidad al pisarlo
  risk_gap   -> hueco real en el terreno con linea segura vs. linea de riesgo
  alt_ramp   -> rampa alternativa de gran salto (ruta de riesgo/recompensa)
  bump_gate  -> bache fisico en el terreno, en una zona tecnica
  flow_ring  -> aro que hay que atravesar en la trayectoria correcta para
                ganar FLOW extra

Mismo pipeline que las tandas anteriores: recorte al alpha real +
reescalado. La logica de gameplay (deteccion de paso, boost, terreno) se
implementa aparte en TrackBuilder/RaceManager/Renderer; este script solo
prepara el arte.

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
    ("batch10/raw_0.webp", "speed_pad.png", 520),
    ("batch10/raw_1.webp", "risk_gap.png", 900),
    ("batch10/raw_2.webp", "alt_ramp.png", 560),
    ("batch10/raw_3.webp", "flow_ring.png", 420),
    ("batch10/raw_4.webp", "bump_gate.png", 620),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
