"""
recolor_rider.py

Cambia el mono del piloto de ROJO a AZUL.

Por que hace falta: las piezas del piloto y el carenado de la moto salen del
mismo arte, con el mismo estampado rojo y blanco y hasta el mismo dorsal. Uno
encima del otro, el ojo no puede separarlos: el pecho se disuelve en la moto.
El contorno oscuro ayuda, pero no arregla que sean del mismo color.

Como lo hace: pasa cada pixel a HSV y mueve el TONO solo de los pixeles que
son rojos de verdad -tono en la banda del rojo y saturacion suficiente-. Los
blancos, los grises y los negros tienen saturacion baja, asi que no se tocan:
el estampado, los numeros, la visera y las costuras se conservan tal cual, y
lo unico que cambia es de que color es la tela.

Es reversible y no destruye nada: se ejecuta sobre los sprites de origen y se
puede volver a correr con otro tono si el azul no convence.

Uso: python3 assets-src/recolor_rider.py [--hue N] [--dry-run]
"""

import colorsys
import os
import sys
from PIL import Image

SPRITES = os.path.join(os.path.dirname(__file__), '..', 'src', 'sprites')

# Piezas del piloto. La moto NO esta aqui a proposito: es la que se queda roja.
PIECES = [
    'rider_torso',
    'rider_arm_upper',
    'rider_arm_fore',
    'rider_thigh',
    'rider_shin',
    'rider_crash',
]

# Tono destino en grados (0-360). 212 es un azul de casco de motocross, frio
# de verdad frente al rojo de la moto y sin irse al morado.
DEFAULT_HUE = 212.0
# Debajo de esta saturacion el pixel es blanco, gris o negro: no es tela de
# color, es el estampado. Se deja intacto.
MIN_SATURATION = 0.22
# Ancho de la banda de rojo/naranja que se considera "mono", en grados a cada
# lado del 0. Mas ancho se comeria los tonos calidos de la piel del cuello.
RED_BAND = 42.0


def shift_pixel(r: int, g: int, b: int, target_hue: float) -> tuple[int, int, int]:
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if s < MIN_SATURATION:
        return r, g, b
    degrees = h * 360
    distance = min(degrees, 360 - degrees)
    if distance > RED_BAND:
        return r, g, b
    # Se conserva la desviacion respecto al rojo puro para no aplanar el
    # estampado: un naranja sigue siendo el vecino mas claro del rojo.
    signed = degrees if degrees <= 180 else degrees - 360
    new_degrees = (target_hue + signed * 0.5) % 360
    nr, ng, nb = colorsys.hsv_to_rgb(new_degrees / 360, s, v)
    return round(nr * 255), round(ng * 255), round(nb * 255)


def main() -> int:
    dry = '--dry-run' in sys.argv
    hue = DEFAULT_HUE
    if '--hue' in sys.argv:
        hue = float(sys.argv[sys.argv.index('--hue') + 1])

    for name in PIECES:
        path = os.path.join(SPRITES, f'{name}.webp')
        if not os.path.exists(path):
            print(f'  {name}: no existe, se salta')
            continue
        image = Image.open(path).convert('RGBA')
        pixels = image.load()
        changed = 0
        for y in range(image.height):
            for x in range(image.width):
                r, g, b, a = pixels[x, y]
                if a == 0:
                    continue
                nr, ng, nb = shift_pixel(r, g, b, hue)
                if (nr, ng, nb) != (r, g, b):
                    pixels[x, y] = (nr, ng, nb, a)
                    changed += 1
        percent = 100 * changed / (image.width * image.height)
        print(f'  {name}: {changed} pixeles recoloreados ({percent:.1f}%)')
        if not dry:
            image.save(path, 'WEBP', quality=93, method=6)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
