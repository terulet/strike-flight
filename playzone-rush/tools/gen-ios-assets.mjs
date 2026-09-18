/**
 * Icono y pantalla de arranque de la app de iOS, con la misma marca que la web.
 *
 * Capacitor deja unos marcadores genericos (un cuadro blanco con su logo). Esto
 * los sustituye por el rayo de PLAYZONE, para que la app que llega por
 * TestFlight se reconozca en la pantalla de inicio.
 *
 *   node tools/gen-ios-assets.mjs
 */
import { launchBrowser } from './browser.mjs';
import { BG, svgIcon } from './brand.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'ios', 'App', 'App', 'Assets.xcassets');
const iconDir = join(assets, 'AppIcon.appiconset');
const splashDir = join(assets, 'Splash.imageset');
mkdirSync(iconDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

const TARGETS = [
  // Icono: 1024x1024, a sangre y sin transparencia. El redondeado lo pone iOS,
  // y un PNG con alpha aqui hace que App Store Connect rechace la subida.
  { dir: iconDir, name: 'AppIcon-512@2x.png', size: 1024, radius: 0, boltScale: 0.66 },
  // Arranque: un lienzo cuadrado que se recorta a cualquier pantalla, asi que
  // el rayo va pequeno y centrado para que no lo parta ningun recorte.
  { dir: splashDir, name: 'splash-2732x2732.png', size: 2732, radius: 0, boltScale: 0.16 },
  { dir: splashDir, name: 'splash-2732x2732-1.png', size: 2732, radius: 0, boltScale: 0.16 },
  { dir: splashDir, name: 'splash-2732x2732-2.png', size: 2732, radius: 0, boltScale: 0.16 },
];

const browser = await launchBrowser({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const target of TARGETS) {
  // Se dibuja a 1024 como mucho y se escala: un viewport de 2732x2732 no cabe.
  const draw = Math.min(target.size, 1024);
  await page.setViewportSize({ width: draw, height: draw });
  await page.setContent(
    `<style>*{margin:0;padding:0}html,body{width:${draw}px;height:${draw}px;background:${BG}}</style>` +
      svgIcon({ size: draw, radius: target.radius, boltScale: target.boltScale }),
  );
  await page.screenshot({
    path: join(target.dir, target.name),
    omitBackground: false,
    scale: 'css',
    clip: { x: 0, y: 0, width: draw, height: draw },
  });
  console.log('·', target.name, `${draw}x${draw}`);
}

await browser.close();
console.log('\nAssets de iOS actualizados.');
