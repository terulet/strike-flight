"""Preprocesa tabletop, step-up y drop-off como sprites transparentes."""

from PIL import Image
import numpy as np

OUT = "../src/sprites"


def alpha_bbox(im, pad=4):
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] > 8)
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return im.crop((x0, y0, x1, y1))


def downscale(im, max_width):
    scale = min(1.0, max_width / im.width)
    if scale < 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im


JOBS = [
    ("batch12/raw_0_tabletop.png", "terrain_tabletop.png", 1200),
    ("batch12/raw_1_stepup.png", "terrain_stepup.png", 1200),
    ("batch12/raw_2_dropoff.png", "terrain_dropoff.png", 1200),
]


if __name__ == "__main__":
    for src, name, max_width in JOBS:
        im = downscale(alpha_bbox(Image.open(src).convert("RGBA")), max_width)
        im.save(f"{OUT}/{name}", optimize=True)
        print(name, im.size)
