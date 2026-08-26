"""
process.py

Pipeline de preprocesado de los 5 assets de referencia (moto, piloto, dirt
spray, landing impact, finish gate) hacia los PNG que consume el juego en
src/sprites/. Documenta y reproduce lo que se hizo a mano/interactivo para
llegar a la calibracion final en src/rendering/SpriteAssets.ts.

Ojo: la deteccion de las ruedas por vision no es bit-a-bit determinista entre
ejecuciones -los rangos de busqueda son proporcionales al tamano del lienzo
nivelado y el redondeo de esquinas del contorno puede variar un par de
pixeles-. Si se vuelve a correr, hay que RE-COPIAR los numeros que imprime a
SpriteCalibration (y volver a verificar en el juego que la moto/rueda/piloto
siguen encajando) en vez de asumir que coinciden con los ya guardados.

Requisitos: pip install pillow numpy opencv-python-headless scipy

Que hace:
1. Nivela la foto de la moto (gira una fraccion de grado para que la linea
   de ejes de rueda quede horizontal) y detecta el centro/radio de cada
   rueda por vision (contornos sobre una mascara de "pixel oscuro").
2. Recorta cada rueda en un circulo propio (para poder animarla por
   separado segun la compresion de la suspension) y "borra" esas mismas
   ruedas de la foto de la moto para dejar solo el chasis.
3. Recorta el piloto y los efectos a su bounding box de alpha real.
4. Reescala todo a un tamano razonable para el juego (las fotos de origen
   son mucho mas grandes de lo que hace falta a la escala de la camara).
5. Imprime los numeros de calibracion (posicion de ejes en pixeles, pivote
   de cada rueda, pivote de cadera del piloto) que hay que copiar a mano en
   SpriteCalibration (src/rendering/SpriteAssets.ts) si se vuelve a correr
   con una foto de origen distinta.

No se ejecuta automaticamente en build/test: es una herramienta de autoria,
no parte del juego.
"""

import json
import math

import cv2
import numpy as np
from PIL import Image, ImageFilter

OUT = "../src/sprites"


def find_wheel_circle(dark, x0, x1, y0, y1):
    crop = dark[y0:y1, x0:x1]
    contours, _ = cv2.findContours(crop, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(best)
    cx, cy = x + w / 2 + x0, y + h / 2 + y0
    r = (w + h) / 4
    return cx, cy, r


def alpha_bbox(im, pad=0):
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] > 8)
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + 1 + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + 1 + pad)
    return x0, y0, x1, y1


def keep_largest_component(rgba_arr):
    alpha = rgba_arr[:, :, 3]
    mask = (alpha > 40).astype(np.uint8)
    n, labels = cv2.connectedComponents(mask)
    if n <= 2:
        return rgba_arr
    sizes = [(labels == i).sum() for i in range(1, n)]
    biggest = 1 + int(np.argmax(sizes))
    out = rgba_arr.copy()
    out[:, :, 3] = np.where(labels == biggest, alpha, 0)
    return out


def circular_crop(im, cx, cy, r, pad_frac=0.06):
    rr = r * (1 + pad_frac)
    x0, y0 = int(cx - rr), int(cy - rr)
    x1, y1 = int(cx + rr), int(cy + rr)
    crop = im.crop((x0, y0, x1, y1)).convert('RGBA')
    w, h = crop.size
    yy, xx = np.ogrid[:h, :w]
    ccx, ccy = w / 2, h / 2
    dist = np.sqrt((xx - ccx) ** 2 + (yy - ccy) ** 2)
    mdraw = np.where(dist <= r, 255, 0).astype(np.uint8)
    mask = Image.fromarray(mdraw, mode='L').filter(ImageFilter.GaussianBlur(1.0))
    arr = np.array(crop)
    arr[:, :, 3] = np.minimum(arr[:, :, 3], np.array(mask))
    arr = keep_largest_component(arr)
    return Image.fromarray(arr, 'RGBA'), (ccx, ccy)


def downscale(im, max_dim):
    scale = min(1.0, max_dim / max(im.size))
    if scale < 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    return im, scale


def process_bike():
    im = Image.open('raw_1_bike.webp').convert('RGBA')
    arr = np.array(im)
    dark = ((arr[:, :, :3].astype(int).sum(axis=2) < 200) & (arr[:, :, 3] > 200)).astype(np.uint8) * 255
    rear0 = find_wheel_circle(dark, 20, 480, 500, 1010)
    front0 = find_wheel_circle(dark, 990, 1435, 440, 1000)
    angle_deg = math.degrees(math.atan2(front0[1] - rear0[1], front0[0] - rear0[0]))
    leveled = im.rotate(-angle_deg, resample=Image.BICUBIC, expand=True)

    arr2 = np.array(leveled)
    dark2 = ((arr2[:, :, :3].astype(int).sum(axis=2) < 200) & (arr2[:, :, 3] > 200)).astype(np.uint8) * 255
    H2, W2 = dark2.shape
    rearC = find_wheel_circle(dark2, 0, int(W2 * 0.34), int(H2 * 0.40), H2)
    frontC = find_wheel_circle(dark2, int(W2 * 0.62), W2, int(H2 * 0.35), H2)
    axleY = (rearC[1] + frontC[1]) / 2
    rearPx, frontPx = (rearC[0], axleY), (frontC[0], axleY)

    rearWheelImg, rearPivot = circular_crop(leveled, *rearC)
    frontWheelImg, frontPivot = circular_crop(leveled, *frontC)

    body = leveled.copy()
    barr = np.array(body)
    yy, xx = np.ogrid[:body.height, :body.width]
    for (cx, cy, r) in [rearC, frontC]:
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        barr[:, :, 3][dist <= r * 1.05] = 0
        ring = (dist > r * 1.05) & (dist <= r * 1.12)
        fade = np.clip((dist - r * 1.05) / (r * 0.07), 0, 1)
        barr[:, :, 3] = np.where(ring, (barr[:, :, 3] * fade).astype(np.uint8), barr[:, :, 3])
    body = Image.fromarray(barr, 'RGBA')
    bx0, by0, bx1, by1 = alpha_bbox(body, pad=4)
    bodyTrimmed = body.crop((bx0, by0, bx1, by1))

    bodyTrimmed, bScale = downscale(bodyTrimmed, 700)
    rearWheelImg, wrScale = downscale(rearWheelImg, 320)
    frontWheelImg, wfScale = downscale(frontWheelImg, 320)

    bodyTrimmed.save(f'{OUT}/bike_body.png')
    rearWheelImg.save(f'{OUT}/wheel_rear.png')
    frontWheelImg.save(f'{OUT}/wheel_front.png')

    return {
        'bike': {
            'rearAxlePx': [(rearPx[0] - bx0) * bScale, (rearPx[1] - by0) * bScale],
            'frontAxlePx': [(frontPx[0] - bx0) * bScale, (frontPx[1] - by0) * bScale],
        },
        'wheelRear': {'pivotPx': [rearPivot[0] * wrScale, rearPivot[1] * wrScale]},
        'wheelFront': {'pivotPx': [frontPivot[0] * wfScale, frontPivot[1] * wfScale]},
    }


def process_rider():
    # Punto de cadera estimado a ojo sobre la postura en cuclillas (ver
    # preview con rejilla generado durante la autoria); ajustar aqui si se
    # cambia la imagen de origen.
    hip_orig = (620, 480)
    im = Image.open('raw_2_rider.webp').convert('RGBA')
    x0, y0, x1, y1 = alpha_bbox(im, pad=4)
    trimmed = im.crop((x0, y0, x1, y1))
    trimmed, scale = downscale(trimmed, 420)
    trimmed.save(f'{OUT}/rider.png')
    hip = ((hip_orig[0] - x0) * scale, (hip_orig[1] - y0) * scale)
    return {'rider': {'hipPivotPx': list(hip)}}


def process_effect(name_in, name_out, max_w):
    im = Image.open(name_in).convert('RGBA')
    x0, y0, x1, y1 = alpha_bbox(im, pad=6)
    trimmed = im.crop((x0, y0, x1, y1))
    trimmed, _ = downscale(trimmed, max_w)
    trimmed.save(f'{OUT}/{name_out}')


if __name__ == '__main__':
    calib = {}
    calib.update(process_bike())
    calib.update(process_rider())
    process_effect('raw_3_dirt_spray.webp', 'dirt_spray.png', 640)
    process_effect('raw_4_landing_impact.webp', 'landing_impact.png', 640)
    process_effect('raw_0_finish_gate.webp', 'finish_gate.png', 1100)
    print(json.dumps(calib, indent=2))
    print('\nCopia estos numeros a SpriteCalibration en src/rendering/SpriteAssets.ts')
