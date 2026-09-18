/**
 * La marca en una sola pieza: el rayo rosa sobre fondo casi negro.
 *
 * Lo usan los iconos de la PWA (`gen-icons.mjs`) y los de la app de iOS
 * (`gen-ios-assets.mjs`), para que sean el mismo dibujo y no dos parecidos.
 */

export const BG = '#07070d';
export const BOLT = '#ff2f6d';

/** El mismo rayo del favicon (viewBox 64x64), reescalado. */
export function boltPath(scale, offsetX, offsetY) {
  const points = [
    [36, 8],
    [16, 36],
    [28, 36],
    [24, 56],
    [44, 28],
    [32, 28],
  ];
  return (
    points
      .map(
        ([x, y], i) =>
          `${i === 0 ? 'M' : 'L'}${(x * scale + offsetX).toFixed(2)} ${(y * scale + offsetY).toFixed(2)}`,
      )
      .join(' ') + ' Z'
  );
}

/** Un cuadrado con el rayo centrado. `radius` 0 deja el fondo a sangre. */
export function svgIcon({ size, radius, boltScale }) {
  const scale = (size / 64) * boltScale;
  const path = boltPath(scale, (size - 64 * scale) / 2, (size - 64 * scale) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
    <path d="${path}" fill="${BOLT}"/>
  </svg>`;
}
