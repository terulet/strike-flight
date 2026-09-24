/**
 * Genera las imagenes de tienda y la de vista previa de enlaces con el
 * juego real (Playwright + Chromium). Necesita `npm run build` antes.
 *
 *   node scripts/posters.mjs
 *
 * Salida: public/og.jpg (1200x630, en español, como las etiquetas de la web)
 * y store/*.jpg (en inglés, para los portales).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.env.PW_GLOBAL ?? '', 'playwright')));
}

const PORT = 4179;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const base = `http://localhost:${PORT}/`;

const shots = [
  // [archivo, ancho, alto, url, segundos]
  ['public/og.jpg', 1200, 630, '?mission=5&autoplay=1&poster=1&lang=es', 8.2],
  ['store/cover-1920x1080.jpg', 1920, 1080, '?mission=5&autoplay=1&poster=1&lang=en', 8.2],
  ['store/cover-1280x720.jpg', 1280, 720, '?mission=5&autoplay=1&poster=1&lang=en', 8.2],
  ['store/portrait-800x1200.jpg', 800, 1200, '?mission=1&autoplay=1&poster=1&lang=en', 9],
  ['store/square-800x800.jpg', 800, 800, '?mission=3&autoplay=1&poster=1&lang=en', 9.5],
  ['store/screenshot-1-final.jpg', 1920, 1080, '?mission=5&autoplay=1&lang=en', 5.5],
  ['store/screenshot-2-bosque.jpg', 1920, 1080, '?mission=3&autoplay=1&lang=en', 14],
  ['store/screenshot-3-diario.jpg', 1920, 1080, '?daily=1&autoplay=1&lang=en', 10],
  ['store/screenshot-4-tormenta.jpg', 1920, 1080, '?mission=4&autoplay=1&lang=en', 12],
];

fs.mkdirSync('store', { recursive: true });
const browser = await chromium.launch();
try {
  for (const [file, w, h, q, t] of shots) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(base + q);
    await page.waitForTimeout(t * 1000);
    await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
    await page.close();
    console.log(file);
  }
} finally {
  await browser.close();
  server.kill();
}
