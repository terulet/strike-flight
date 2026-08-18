/**
 * Genera los iconos PWA a partir de la misma marca que ya usa el favicon
 * (rayo rosa sobre fondo casi negro). No hay ImageMagick ni Pillow en este
 * entorno, pero si Chromium (Playwright ya lo trae para los tests), asi que
 * se rasteriza con eso: nada nuevo que instalar.
 *
 *   node tools/gen-icons.mjs
 */
import { launchBrowser } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = '#07070d';
const BOLT = '#ff2f6d';

/** El mismo rayo del favicon (viewBox 64x64), reescalado. */
function boltPath(scale, offsetX, offsetY) {
  const points = [
    [36, 8],
    [16, 36],
    [28, 36],
    [24, 56],
    [44, 28],
    [32, 28],
  ];
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * scale + offsetX).toFixed(2)} ${(y * scale + offsetY).toFixed(2)}`)
    .join(' ') + ' Z';
}

function svgIcon({ size, radius, boltScale }) {
  const scale = (size / 64) * boltScale;
  const boltSize = 64 * (size / 64) * boltScale; // tamano aproximado del rayo ya escalado
  const offset = (size - boltSize) / 2 - 8 * scale * 0; // centrado simple
  const path = boltPath(scale, (size - 64 * scale) / 2, (size - 64 * scale) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
    <path d="${path}" fill="${BOLT}"/>
  </svg>`;
}

const TARGETS = [
  { name: 'icon-192.png', size: 192, radius: 192 * 0.22, boltScale: 1 },
  { name: 'icon-512.png', size: 512, radius: 512 * 0.22, boltScale: 1 },
  // Maskable: el sistema recorta a la forma que quiera (circulo, squircle...),
  // asi que el contenido tiene que caber en la "safe zone" central (~80%).
  { name: 'icon-512-maskable.png', size: 512, radius: 0, boltScale: 0.62 },
  // Apple aplica su propio redondeado: fondo a sangre, sin esquinas propias.
  { name: 'apple-touch-icon.png', size: 180, radius: 0, boltScale: 1 },
];

const browser = await launchBrowser({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const target of TARGETS) {
  const svg = svgIcon(target);
  await page.setViewportSize({ width: target.size, height: target.size });
  await page.setContent(
    `<style>*{margin:0;padding:0}html,body{width:${target.size}px;height:${target.size}px}</style>${svg}`,
  );
  await page.screenshot({ path: join(outDir, target.name), omitBackground: false });
  console.log('·', target.name, `${target.size}x${target.size}`);
}

await browser.close();
console.log('\nIconos en', outDir);
