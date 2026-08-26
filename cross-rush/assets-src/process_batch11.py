"""
process_batch11.py

Refuerzo visual de las 5 piezas de riesgo/recompensa del BATCH 007 (ver
process_batch10.py / gameplay/GameplayZones.ts): un "chispazo" propio para
cada trigger en vez de solo particulas genericas.

  speed_pad_fx  -> estela ancha con debris horneado: empujon de velocidad.
  alt_ramp_fx   -> estela curva en S: el arco de la ruta alternativa.
  bump_gate_fx  -> marana de estelas cruzadas: el traqueteo al cruzar el bache.
  risk_gap_fx   -> rafaga radial: el impacto de aterrizar tras saltar el
                   hueco entero.
  flow_ring_hit -> el aro con una rafaga direccional ya horneada a un lado:
                   el fotograma de "acierto" al atravesarlo, distinto del
                   aro estatico (flow_ring.png) que ya se dibuja siempre.

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
    ("batch11/raw_0.png", "speed_pad_fx.png", 700),
    ("batch11/raw_1.png", "alt_ramp_fx.png", 700),
    ("batch11/raw_2.png", "bump_gate_fx.png", 650),
    ("batch11/raw_3.webp", "risk_gap_fx.png", 600),
    ("batch11/raw_4.webp", "flow_ring_hit.png", 520),
]

if __name__ == '__main__':
    for src, name, maxdim in JOBS:
        im = Image.open(src).convert('RGBA')
        im = alpha_bbox(im)
        im = downscale(im, maxdim)
        im.save(f'{OUT}/{name}')
        print(name, im.size)
