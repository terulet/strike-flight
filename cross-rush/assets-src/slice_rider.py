"""
slice_rider.py

Trocea el piloto en piezas independientes para poder articularlo.

`rider.png` es una foto de cuerpo entero en pose de conduccion. Como imagen
unica solo se puede desplazar y rotar entera, y eso tiene un techo: los brazos
no llegan al manillar cuando el cuerpo se va atras, y las botas no se quedan en
las estriberas cuando el piloto se agacha. El mandato pide brazos y piernas
reaccionando, y ademas -esto es lo importante para el ensamblaje- pide que el
piloto no flote ni se separe de la moto. Con las manos y los pies resueltos por
cinematica inversa contra el manillar y la estribera, eso deja de poder pasar:
las extremidades apuntan siempre a donde estan de verdad los agarres.

Cinco piezas, cada una en su propio archivo (regla PLAYZONE: 1 asset = 1
archivo, nada de atlas):

  rider_torso.png       cuerpo, casco y brazo del lado lejano
  rider_arm_upper.png   hombro -> codo
  rider_arm_fore.png    codo -> puno, con el guante
  rider_thigh.png       cadera -> rodilla
  rider_shin.png        rodilla -> bota

La PIERNA del lado lejano tambien se recorta del torso, aunque no se guarda
como pieza aparte: el render vuelve a dibujar el muslo y la pierna cercanos,
oscurecidos y ligeramente desplazados, para hacer de pierna lejana. Es el truco
clasico de personaje 2D y sale mucho mejor que dejarla horneada: horneada se
queda quieta y cuelga en el aire en cuanto el piloto se mueve.

El BRAZO lejano si se queda en el torso: de el solo asoma un guante detras del
manillar, y recortarlo anadiria una costura mas para no ganar nada.

Dos detalles que evitan que se vean las juntas:

  - Las piezas se recortan con un poligono MAS GRANDE que el hueco que se abre
    en el torso, asi que siempre hay solape: por mucho que se mueva un brazo,
    debajo hay torso y nunca aparece un agujero.
  - Todos los bordes van difuminados un pixel y medio. Un corte duro sobre una
    foto canta muchisimo mas que un borde suave.

Uso:  python3 assets-src/slice_rider.py
"""

import json
import os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SPRITES = os.path.join(ROOT, "src", "sprites")
SOURCE = os.path.join(HERE, "rider_raw", "raw_rider.png")

# Articulaciones medidas sobre rider.png (262 x 420), en pixeles de imagen.
JOINTS = {
    "shoulder": (158, 122),
    "elbow": (208, 152),
    "fist": (241, 174),
    "hip": (105, 226),
    "knee": (170, 282),
    "ankle": (190, 350),
    "toe": (243, 392),
    "helmetTop": (168, 8),
}

# Poligonos de recorte de cada pieza. Generosos a proposito: mas vale que
# sobre torso debajo de un brazo que que falte.
PIECES = {
    "rider_arm_upper": {
        "pivot": "shoulder",
        "cut": [(130, 96), (188, 92), (232, 134), (218, 180), (168, 158), (124, 130)],
        # El hueco que se abre en el torso es mas pequeno que la pieza.
        "erase": [(142, 108), (182, 104), (222, 140), (208, 172), (170, 152), (138, 130)],
    },
    "rider_arm_fore": {
        "pivot": "elbow",
        "cut": [(182, 118), (224, 120), (262, 144), (262, 214), (206, 202), (172, 168)],
        "erase": [(196, 130), (224, 132), (258, 152), (258, 206), (208, 194), (186, 166)],
    },
    "rider_thigh": {
        "pivot": "hip",
        "cut": [(82, 190), (152, 186), (222, 258), (206, 306), (138, 312), (72, 264)],
        "erase": [(96, 202), (150, 198), (212, 262), (198, 298), (142, 302), (88, 258)],
    },
    "rider_shin": {
        "pivot": "knee",
        "cut": [(132, 244), (216, 246), (246, 322), (262, 364), (262, 418), (140, 418), (112, 342)],
        "erase": [(144, 258), (212, 258), (240, 328), (256, 368), (256, 412), (148, 412), (124, 344)],
    },
}

# Region de la pierna del lado lejano. Solo se BORRA del torso; el render la
# reconstruye con las piezas de la pierna cercana, oscurecidas.
FAR_LEG_ERASE = [(12, 198), (118, 198), (168, 300), (156, 414), (16, 414)]

FEATHER = 1.5


def polygon_mask(size, points, feather=FEATHER, supersample=4):
    """Mascara de un poligono, suavizada y con antialias por supermuestreo."""
    big = Image.new("L", (size[0] * supersample, size[1] * supersample), 0)
    draw = ImageDraw.Draw(big)
    draw.polygon([(x * supersample, y * supersample) for x, y in points], fill=255)
    mask = big.resize(size, Image.LANCZOS)
    if feather > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return mask


def trim(image):
    """Recorta a la caja util y devuelve tambien cuanto se ha recortado."""
    bbox = image.getbbox()
    if bbox is None:
        return image, (0, 0)
    return image.crop(bbox), (bbox[0], bbox[1])


def main():
    source = Image.open(SOURCE).convert("RGBA")
    size = source.size
    print(f"origen: {os.path.relpath(SOURCE, ROOT)}  {size[0]}x{size[1]}")

    calibration = {"joints": {}, "pieces": {}}

    # 1) Piezas de extremidad.
    for name, spec in PIECES.items():
        mask = polygon_mask(size, spec["cut"])
        piece = Image.new("RGBA", size, (0, 0, 0, 0))
        piece.paste(source, (0, 0), mask)
        trimmed, offset = trim(piece)

        pivot_source = JOINTS[spec["pivot"]]
        pivot = (pivot_source[0] - offset[0], pivot_source[1] - offset[1])
        trimmed.save(os.path.join(SPRITES, f"{name}.png"))
        calibration["pieces"][name] = {
            "size": list(trimmed.size),
            "pivotPx": [round(pivot[0], 1), round(pivot[1], 1)],
            "pivotJoint": spec["pivot"],
        }
        print(f"  {name}.png  {trimmed.size}  pivote({spec['pivot']}) = {pivot[0]}, {pivot[1]}")

    # 2) Torso: el original menos los huecos (mas pequenos que las piezas).
    torso = source.copy()
    hole = Image.new("L", size, 0)
    for spec in PIECES.values():
        hole = Image.composite(Image.new("L", size, 255), hole, polygon_mask(size, spec["erase"]))
    hole = Image.composite(Image.new("L", size, 255), hole, polygon_mask(size, FAR_LEG_ERASE))
    keep = hole.point(lambda v: 255 - v)
    alpha = torso.getchannel("A")
    torso.putalpha(Image.eval(Image.merge("L", [alpha]).point(lambda v: v), lambda v: v))
    torso_out = Image.new("RGBA", size, (0, 0, 0, 0))
    torso_out.paste(torso, (0, 0), keep)
    trimmed_torso, torso_offset = trim(torso_out)
    trimmed_torso.save(os.path.join(SPRITES, "rider_torso.png"))

    hip = JOINTS["hip"]
    shoulder = JOINTS["shoulder"]
    calibration["pieces"]["rider_torso"] = {
        "size": list(trimmed_torso.size),
        "pivotPx": [round(hip[0] - torso_offset[0], 1), round(hip[1] - torso_offset[1], 1)],
        "pivotJoint": "hip",
        "shoulderPx": [round(shoulder[0] - torso_offset[0], 1), round(shoulder[1] - torso_offset[1], 1)],
    }
    print(
        f"  rider_torso.png  {trimmed_torso.size}  pivote(hip) = "
        f"{hip[0] - torso_offset[0]}, {hip[1] - torso_offset[1]}"
    )

    # 3) Longitudes de hueso, en pixeles de la imagen original.
    def distance(a, b):
        return round(((JOINTS[a][0] - JOINTS[b][0]) ** 2 + (JOINTS[a][1] - JOINTS[b][1]) ** 2) ** 0.5, 1)

    calibration["joints"] = {k: list(v) for k, v in JOINTS.items()}
    calibration["bonesPx"] = {
        "upperArm": distance("shoulder", "elbow"),
        "forearm": distance("elbow", "fist"),
        "thigh": distance("hip", "knee"),
        "shin": distance("knee", "ankle"),
        "hipToShoulder": distance("hip", "shoulder"),
        "hipToHelmetTop": distance("hip", "helmetTop"),
    }
    print("\nlongitudes de hueso (px):", json.dumps(calibration["bonesPx"]))

    with open(os.path.join(HERE, "rider_rig.json"), "w", encoding="utf-8") as handle:
        json.dump(calibration, handle, indent=2)
    print(f"calibracion -> {os.path.relpath(os.path.join(HERE, 'rider_rig.json'), ROOT)}")


if __name__ == "__main__":
    main()
