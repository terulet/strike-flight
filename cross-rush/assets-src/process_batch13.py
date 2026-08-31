"""Preprocesa whoops y rockgarden como sprites transparentes."""

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
    ("batch13/raw_0_whoops.png", "terrain_whoops.png", 1200),
    ("batch13/raw_1_rockgarden.png", "terrain_rockgarden.png", 1200),
]


if __name__ == "__main__":
    for src, name, max_width in JOBS:
        im = downscale(alpha_bbox(Image.open(src).convert("RGBA")), max_width)
        im.save(f"{OUT}/{name}", optimize=True)
        print(name, im.size)
