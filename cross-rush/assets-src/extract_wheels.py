"""
extract_wheels.py

Extrae ruedas GIRABLES a partir de los recortes originales.

El problema que resuelve: `raw_wheel_front.png` y `raw_wheel_rear.png` -los
recortes que se venian usando como sprite de rueda- no contienen solo la
rueda. La delantera arrastra la horquilla entera y el guardabarros; la trasera,
el basculante y la cadena. Son piezas del CHASIS, y viven ya dibujadas en
`bike_body.png`. Mientras las ruedas no giraban nadie lo notaba; en cuanto
giran de verdad, la horquilla da vueltas como una helice alrededor de la moto.

Ademas el pivote que se usaba era el centro de la IMAGEN, y el buje no esta
ahi: se desvia 18 px en la delantera y 24 px en la trasera. Un pivote fuera del
buje hace que la rueda ORBITE al girar en vez de rodar sobre su eje.

Que hace este script:

  1. Localiza el neumatico ajustando un circulo al borde exterior del caucho
     -solo pixeles OSCUROS, para que la horquilla dorada y el guardabarros
     blanco no contaminen el ajuste-, con rechazo iterativo de atipicos.
  2. Detecta los sectores angulares invadidos por piezas del chasis. El
     detector no mira colores: una rueda es simetrica de revolucion, asi que su
     perfil radial (luminancia en funcion del radio) es casi identico en todos
     los angulos. Los sectores cuyo perfil se aparta de la mediana son los que
     tienen encima la horquilla, el basculante o la cadena.
  3. Reconstruye esos sectores copiando el sector limpio mas cercano al mismo
     radio, con mezcla en los bordes. Es legitimo justamente porque la rueda es
     simetrica de revolucion: se rellena rueda con rueda.
  4. Recorta el disco y reencuadra para que el buje caiga EXACTAMENTE en el
     centro de la imagen, de modo que el pivote de render sea trivial y no
     pueda volver a desalinearse.

Uso:  python3 assets-src/extract_wheels.py
Salida: src/sprites/wheel_front.png y src/sprites/wheel_rear.png
"""

import math
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SPRITES = os.path.join(ROOT, "src", "sprites")
RAW = os.path.join(HERE, "wheels_raw")

# Umbral de luminancia por debajo del cual un pixel se considera caucho.
# La horquilla dorada (~180), el guardabarros blanco (~240) y el disco de freno
# quedan fuera; el neumatico (~30-70) queda dentro.
RUBBER_LUMA = 95
ALPHA_MIN = 140

ANGLE_BINS = 360
RADIAL_SAMPLES = 40
# Radio relativo a partir del cual se compara el perfil. Por dentro de esto
# esta el buje, que es pequeno y donde la simetria es menos fiable.
PROFILE_INNER = 0.10


def luma(pixel):
    return 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2]


def outer_rubber_points(image, seed):
    """Ultimo pixel de caucho a lo largo de 1440 rayos desde `seed`."""
    width, height = image.size
    px = image.load()
    cx, cy = seed
    points = []
    max_radius = math.hypot(width, height)
    for i in range(1440):
        angle = i * math.pi / 720
        dx, dy = math.cos(angle), math.sin(angle)
        last = None
        radius = 4.0
        while radius < max_radius:
            x = int(cx + dx * radius)
            y = int(cy + dy * radius)
            if 0 <= x < width and 0 <= y < height:
                pixel = px[x, y]
                if pixel[3] > ALPHA_MIN and luma(pixel) < RUBBER_LUMA:
                    last = (cx + dx * radius, cy + dy * radius)
            radius += 0.5
        if last is not None:
            points.append(last)
    return points


def fit_circle(points):
    """Ajuste de circulo por minimos cuadrados (Kasa)."""
    n = len(points)
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sxx = sum(p[0] * p[0] for p in points)
    syy = sum(p[1] * p[1] for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    sxxx = sum(p[0] ** 3 for p in points)
    syyy = sum(p[1] ** 3 for p in points)
    sxyy = sum(p[0] * p[1] * p[1] for p in points)
    sxxy = sum(p[0] * p[0] * p[1] for p in points)

    a = n * sxx - sx * sx
    b = n * sxy - sx * sy
    c = n * syy - sy * sy
    d = 0.5 * (n * sxyy - sx * syy + n * sxxx - sx * sxx)
    e = 0.5 * (n * sxxy - sy * sxx + n * syyy - sy * syy)
    det = a * c - b * b
    if abs(det) < 1e-9:
        raise ValueError("circulo degenerado")
    cx = (d * c - b * e) / det
    cy = (a * e - b * d) / det
    radius = sum(math.hypot(p[0] - cx, p[1] - cy) for p in points) / n
    return cx, cy, radius


def fit_with_rejection(points, rounds=6):
    current = list(points)
    cx, cy, radius = fit_circle(current)
    for _ in range(rounds):
        residuals = [abs(math.hypot(p[0] - cx, p[1] - cy) - radius) for p in current]
        mean = sum(residuals) / len(residuals)
        spread = (sum((r - mean) ** 2 for r in residuals) / len(residuals)) ** 0.5
        limit = mean + 1.2 * spread
        kept = [p for p, r in zip(current, residuals) if r <= limit]
        if len(kept) < 200 or len(kept) == len(current):
            break
        current = kept
        cx, cy, radius = fit_circle(current)
    residuals = [abs(math.hypot(p[0] - cx, p[1] - cy) - radius) for p in current]
    return cx, cy, radius, max(residuals), len(current)


def sample(px, width, height, x, y):
    """Muestreo bilineal con transparencia fuera de la imagen."""
    if x < 0 or y < 0 or x >= width - 1 or y >= height - 1:
        return (0, 0, 0, 0)
    x0, y0 = int(x), int(y)
    fx, fy = x - x0, y - y0
    p00 = px[x0, y0]
    p10 = px[x0 + 1, y0]
    p01 = px[x0, y0 + 1]
    p11 = px[x0 + 1, y0 + 1]
    out = []
    for c in range(4):
        top = p00[c] * (1 - fx) + p10[c] * fx
        bottom = p01[c] * (1 - fx) + p11[c] * fx
        out.append(int(round(top * (1 - fy) + bottom * fy)))
    return tuple(out)


def radial_profiles(px, width, height, cx, cy, radius):
    """Perfil de luminancia por angulo. Devuelve [bin][muestra]."""
    profiles = []
    for b in range(ANGLE_BINS):
        angle = b * 2 * math.pi / ANGLE_BINS
        dx, dy = math.cos(angle), math.sin(angle)
        row = []
        for s in range(RADIAL_SAMPLES):
            t = PROFILE_INNER + (0.99 - PROFILE_INNER) * s / (RADIAL_SAMPLES - 1)
            p = sample(px, width, height, cx + dx * radius * t, cy + dy * radius * t)
            row.append(luma(p) if p[3] > ALPHA_MIN else 0.0)
        profiles.append(row)
    return profiles


def contaminated_bins(profiles):
    """Sectores cuyo perfil radial se aparta de la mediana angular."""
    median = []
    for s in range(RADIAL_SAMPLES):
        column = sorted(profiles[b][s] for b in range(ANGLE_BINS))
        median.append(column[len(column) // 2])

    scores = []
    for b in range(ANGLE_BINS):
        diff = sum(abs(profiles[b][s] - median[s]) for s in range(RADIAL_SAMPLES)) / RADIAL_SAMPLES
        scores.append(diff)

    ordered = sorted(scores)
    typical = ordered[len(ordered) // 2]
    spread = ordered[int(len(ordered) * 0.75)] - ordered[int(len(ordered) * 0.25)]
    limit = typical + max(7.0, 2.0 * spread)
    bad = [b for b in range(ANGLE_BINS) if scores[b] > limit]

    # Ensancha un poco cada sector malo: los bordes de una pieza de chasis
    # difuminan hacia fuera y dejan un halo que tambien hay que tapar.
    widened = set()
    for b in bad:
        for k in range(-5, 6):
            widened.add((b + k) % ANGLE_BINS)
    return widened, limit, scores


def cleanest_window(scores, width_bins):
    """Ventana angular contigua cuyo PEOR sector es el menos malo de todas."""
    best = None
    for start in range(ANGLE_BINS):
        worst = max(scores[(start + k) % ANGLE_BINS] for k in range(width_bins))
        if best is None or worst < best[1]:
            best = (start, worst)
    return best[0]


def rebuild_inner_by_replication(image, cx, cy, radius, scores, inner_limit=0.62):
    """
    Reconstruye el disco interior -buje, disco de freno, radios y llanta-
    replicando el cuadrante mas limpio cuatro veces.

    El parche por "sector limpio mas cercano" funciona bien en la banda del
    neumatico, donde el dibujo se repite cada pocos grados, pero cerca del buje
    los sectores buenos que quedan estan lejos y la copia se nota. Ahi conviene
    lo contrario: coger el cuadrante que mejor esta y repetirlo, que es
    exactamente lo que es una rueda -32 radios repartidos por igual-.
    """
    width, height = image.size
    px = image.load()
    out = image.copy()
    out_px = out.load()

    quarter = ANGLE_BINS // 4
    start = cleanest_window(scores, quarter)
    start_angle = start * 2 * math.pi / ANGLE_BINS

    for y in range(height):
        for x in range(width):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            r = math.hypot(dx, dy)
            if r > radius * inner_limit:
                continue
            angle = math.atan2(dy, dx) % (2 * math.pi)
            # Se pliega el angulo dentro del cuadrante limpio.
            folded = start_angle + ((angle - start_angle) % (math.pi / 2))
            sx = cx + math.cos(folded) * r
            sy = cy + math.sin(folded) * r
            source_pixel = sample(px, width, height, sx, sy)
            if r > radius * (inner_limit - 0.07):
                # Mezcla hacia fuera para que no se vea el corte con la banda
                # del neumatico, que se repara por otro camino.
                t = (r - radius * (inner_limit - 0.07)) / (radius * 0.07)
                original = px[x, y]
                source_pixel = tuple(
                    int(round(source_pixel[c] * (1 - t) + original[c] * t)) for c in range(4)
                )
            out_px[x, y] = source_pixel
    return out


def nearest_clean(bin_index, bad):
    """Sector limpio mas cercano, mirando a los dos lados."""
    for distance in range(1, ANGLE_BINS // 2 + 1):
        for candidate in ((bin_index - distance) % ANGLE_BINS, (bin_index + distance) % ANGLE_BINS):
            if candidate not in bad:
                return candidate
    return bin_index


def rebuild(source, cx, cy, radius, bad):
    """Redibuja los sectores invadidos copiando rueda de un sector limpio."""
    width, height = source.size
    px = source.load()
    out = source.copy()
    out_px = out.load()

    mapping = {b: nearest_clean(b, bad) for b in bad}

    for y in range(height):
        for x in range(width):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            r = math.hypot(dx, dy)
            if r > radius + 3:
                continue
            angle = math.atan2(dy, dx) % (2 * math.pi)
            b = int(angle * ANGLE_BINS / (2 * math.pi)) % ANGLE_BINS
            if b not in bad:
                continue
            source_bin = mapping[b]
            # Se conserva la posicion dentro del sector para que el dibujo del
            # neumatico no se corte a mitad de taco.
            offset = angle - b * 2 * math.pi / ANGLE_BINS
            new_angle = source_bin * 2 * math.pi / ANGLE_BINS + offset
            sx = cx + math.cos(new_angle) * r
            sy = cy + math.sin(new_angle) * r
            out_px[x, y] = sample(px, width, height, sx, sy)
    return out


def extract(name, margin_px=3):
    source = Image.open(os.path.join(RAW, f"{name}.png")).convert("RGBA")
    width, height = source.size

    points = outer_rubber_points(source, (width / 2, height / 2))
    cx, cy, radius, _, _ = fit_with_rejection(points)
    # Segunda pasada desde el centro ya estimado: los rayos salen del buje real
    # y el borde del neumatico se muestrea mucho mejor.
    points = outer_rubber_points(source, (cx, cy))
    cx, cy, radius, worst, kept = fit_with_rejection(points)

    print(
        f"{name}: buje=({cx:.1f}, {cy:.1f})  radio={radius:.1f} px  "
        f"error_max={worst:.1f} px sobre {kept} puntos  "
        f"(el centro de imagen que se usaba era ({width / 2:.1f}, {height / 2:.1f}))"
    )

    # Dos pasadas: la primera quita el grueso de la pieza y la segunda recoge
    # el halo que queda en los bordes, que con la pieza entera delante no se
    # distinguia del propio contraste de la rueda.
    profiles = radial_profiles(source.load(), width, height, cx, cy, radius)
    bad, _, scores = contaminated_bins(profiles)
    print(
        f"   sectores invadidos por el chasis: {len(bad)} de {ANGLE_BINS} "
        f"({len(bad) * 100 // ANGLE_BINS}%)"
    )

    # Banda del neumatico: parche por sector limpio mas cercano.
    repaired = rebuild(source, cx, cy, radius, bad)
    # Disco interior: replicacion del cuadrante mas limpio.
    repaired = rebuild_inner_by_replication(repaired, cx, cy, radius, scores)
    # Segunda pasada en la banda exterior, para el halo que quede en los bordes.
    profiles = radial_profiles(repaired.load(), width, height, cx, cy, radius)
    bad2, _, _ = contaminated_bins(profiles)
    if bad2:
        print(f"   repaso de la banda exterior: {len(bad2)} sectores")
        repaired = rebuild(repaired, cx, cy, radius, bad2)

    # Mascara circular con borde suave.
    supersample = 4
    big = Image.new("L", (width * supersample, height * supersample), 0)
    draw = ImageDraw.Draw(big)
    r = (radius + margin_px) * supersample
    draw.ellipse(
        [cx * supersample - r, cy * supersample - r, cx * supersample + r, cy * supersample + r],
        fill=255,
    )
    mask = big.resize((width, height), Image.LANCZOS)

    disc = Image.new("RGBA", repaired.size, (0, 0, 0, 0))
    disc.paste(repaired, (0, 0), mask)

    # Reencuadre: el buje al centro exacto de una imagen cuadrada.
    side = int(math.ceil((radius + margin_px + 2) * 2))
    if side % 2 == 1:
        side += 1
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(disc, (int(round(side / 2 - cx)), int(round(side / 2 - cy))), disc)

    destination = os.path.join(SPRITES, f"{name.replace('raw_', '')}.png")
    out.save(destination)
    print(
        f"   -> {os.path.relpath(destination, ROOT)}  {out.size}  "
        f"pivote = centro exacto ({side / 2:.1f}, {side / 2:.1f})  radio del neumatico = {radius + margin_px:.1f} px"
    )
    return radius + margin_px, side


if __name__ == "__main__":
    results = {}
    for wheel in ("raw_wheel_front", "raw_wheel_rear"):
        results[wheel] = extract(wheel)
    print("\nCalibracion para SpriteAssets.ts:")
    for wheel, (tyre_radius, side) in results.items():
        short = wheel.replace("raw_wheel_", "")
        print(f"  {short}: pivotPx = ({side / 2:.1f}, {side / 2:.1f}), tyreRadiusPx = {tyre_radius:.1f}")
