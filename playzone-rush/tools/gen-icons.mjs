/**
 * Genera los iconos PWA a partir de la misma marca que ya usa el favicon
 * (rayo rosa sobre fondo casi negro). No hay ImageMagick ni Pillow en este
 * entorno, pero si Chromium (Playwright ya lo trae para los tests), asi que
 * se rasteriza con eso: nada nuevo que instalar.
 *
 *   node tools/gen-icons.mjs
 */
import { launchBrowser } from './browser.mjs';
import { svgIcon } from './brand.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

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
