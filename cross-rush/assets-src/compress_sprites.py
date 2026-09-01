"""
compress_sprites.py

Convierte los sprites del juego de PNG a WebP.

Motivo: la build pesaba 18 MB, casi toda en PNG. Son imagenes fotograficas con
canal alfa -canones, publico, la propia moto-, que es exactamente el caso en el
que PNG es el peor formato posible: comprime sin perdida pixel a pixel y no
aprovecha que el ojo no distingue los ultimos pasos de un degradado de roca.
WebP con perdida deja los mismos pixeles a la vista y ocupa una cuarta parte.

Las piezas que se dibujan GRANDES en pantalla -moto, ruedas, piloto- van a
calidad mas alta: son las unicas que el jugador mira de cerca, y ademas pesan
poco, asi que subirles la calidad no cuesta casi nada.

Uso: python3 assets-src/compress_sprites.py [--dry-run]
"""

import os
import sys
from PIL import Image

SPRITES = os.path.join(os.path.dirname(__file__), '..', 'src', 'sprites')

# Sprites que se dibujan a tamano grande o que el jugador tiene siempre en el
# centro de la pantalla: mas calidad.
HERO = {
    'bike_body', 'wheel_front', 'wheel_rear',
    'rider', 'rider_crash', 'rider_torso', 'rider_arm_upper', 'rider_arm_fore',
    'rider_thigh', 'rider_shin',
}
HERO_QUALITY = 93
DEFAULT_QUALITY = 86


def main() -> int:
    dry = '--dry-run' in sys.argv
    before = after = 0
    rows = []
    for name in sorted(os.listdir(SPRITES)):
        if not name.endswith('.png'):
            continue
        stem = name[:-4]
        src = os.path.join(SPRITES, name)
        dst = os.path.join(SPRITES, f'{stem}.webp')
        quality = HERO_QUALITY if stem in HERO else DEFAULT_QUALITY
        image = Image.open(src)
        if image.mode not in ('RGBA', 'RGB'):
            image = image.convert('RGBA')
        png_bytes = os.path.getsize(src)
        if not dry:
            image.save(dst, 'WEBP', quality=quality, method=6)
            os.remove(src)
            webp_bytes = os.path.getsize(dst)
        else:
            image.save('/tmp/_probe.webp', 'WEBP', quality=quality, method=6)
            webp_bytes = os.path.getsize('/tmp/_probe.webp')
        before += png_bytes
        after += webp_bytes
        rows.append((stem, image.size, png_bytes, webp_bytes, quality))

    for stem, size, png_bytes, webp_bytes, quality in rows:
        print(f'{stem:24s} {str(size):12s} q{quality} {png_bytes // 1024:5d}K -> {webp_bytes // 1024:5d}K')
    print(f'\nTOTAL {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB ({after / before:.0%})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
