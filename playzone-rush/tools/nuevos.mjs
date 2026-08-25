/**
 * Los cinco juegos nuevos, jugados de verdad y fotografiados.
 *
 * No es una prueba de que "no peta": es para MIRARLOS. Los defectos que se han
 * colado hasta ahora en este proyecto (el HUD encima de la puntuacion, la
 * palabra pegada, la doble exposicion del morphing) no los encontro ningun
 * assert, los encontro abrir la captura.
 *
 *   BASE=http://localhost:5173 node tools/nuevos.mjs
 */
import { launchBrowser } from './browser.mjs';
import { BOTS, launchGame, readState, isOver } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('../shots/nuevos/', import.meta.url).pathname;
const JUEGOS = ['caza', 'cuenta', 'torre', 'trile', 'carga'];

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
const page = await context.newPage();
const errores = [];
page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
if ((await page.locator('.onboarding').count()) > 0) {
  await page.locator('.onboarding__solo').click();
  await page.waitForSelector('.card', { timeout: 10000 });
}

for (const id of JUEGOS) {
  await launchGame(page, id);
  // Un momento de juego antes de la foto: la primera pantalla de casi todos
  // esta vacia y una foto de una pantalla vacia no ensena nada.
  const bot = BOTS[id];
  const jugar = bot(page, 9000, 1);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}${id}.png` });
  const medio = await readState(page);
  await jugar;

  // Y hasta el final, para ver la puntuacion que saca alguien que juega bien.
  if (!(await isOver(page))) await bot(page, 60000, 1);
  await page.waitForSelector('.result', { timeout: 15000 });
  const puntos = await page.locator('.result__score, .cifra-heroe').first().innerText().catch(() => '?');
  console.log(`${id.padEnd(7)} ${String(puntos).replace(/\s+/g, ' ').padStart(9)}   ${JSON.stringify(medio)}`);
  await page.screenshot({ path: `${OUT}${id}-resultado.png` });
  await page.locator('.salir-resultado').first().click();
  await page.waitForTimeout(500);
}

if (errores.length) {
  console.log('\nERRORES DE CONSOLA:');
  for (const e of [...new Set(errores)]) console.log(' ', e);
}
await browser.close();
