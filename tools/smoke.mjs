// Recorrido manual automatizado en viewport de iPhone (393x852).
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? new URL('../shots/', import.meta.url).pathname;

const log = (...a) => console.log('·', ...a);

/** Click con diagnostico: si el hit-test falla, dice QUE hay en ese punto. */
async function safeClick(page, locator, label) {
  try {
    await locator.click({ timeout: 4000 });
    return true;
  } catch (err) {
    const info = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        box: `x${Math.round(r.x)} y${Math.round(r.y)} w${Math.round(r.width)} h${Math.round(r.height)}`,
        hit: hit ? `${hit.tagName}.${hit.className}` : 'nada',
        vw: `${innerWidth}x${innerHeight}`,
      };
    });
    log(`AVISO: click normal fallido en ${label}:`, JSON.stringify(info));
    await locator.evaluate((el) => el.click());
    return false;
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
await page.waitForSelector('.card');
log('portada cargada');
await page.screenshot({ path: `${OUT}01-home.png` });

// --- Reto 1: jugar una partida completa ---
const firstPlay = page.locator('.card .btn--accent').first();
await firstPlay.click();
await page.waitForSelector('.countdown');
log('cuenta atras visible');
await page.screenshot({ path: `${OUT}02-countdown.png` });

await page.waitForSelector('.countdown', { state: 'detached', timeout: 8000 });
log('partida arrancada');

// Jugar: toques por toda la pantalla + teclas del mapeo de PULSE.
const keys = ['KeyQ', 'KeyW', 'KeyE', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC'];
const t0 = Date.now();
let shot = false;
while (Date.now() - t0 < 12000) {
  if (await page.locator('.result').count()) break;
  for (const k of keys) await page.keyboard.press(k);
  await page.mouse.click(120 + Math.random() * 150, 300 + Math.random() * 300);
  if (!shot && Date.now() - t0 > 3000) {
    await page.screenshot({ path: `${OUT}03-gameplay.png` });
    shot = true;
    log('captura de gameplay');
  }
  await page.waitForTimeout(120);
}

await page.waitForSelector('.result', { timeout: 40000 });
log('resultado visible');
await page.screenshot({ path: `${OUT}04-result.png` });
const resultText = await page.locator('.result__inner').innerText();
log('resultado:', resultText.replace(/\n+/g, ' | ').slice(0, 220));

// --- Revancha: debe volver directo al juego ---
const rematch = page.locator('.result .btn--play');
if (await rematch.isEnabled()) {
  await rematch.click();
  await page.waitForSelector('.result', { state: 'detached', timeout: 5000 });
  log('revancha: resultado cerrado');
  await page.waitForSelector('.countdown', { timeout: 3000 });
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 5000 });
  log('revancha: en juego otra vez sin pasar por menu');
  await page.screenshot({ path: `${OUT}05-rematch.png` });
  // Terminar rapido desde debug (si la partida sigue viva)
  await page.waitForTimeout(400);
  if (!(await page.locator('.result').count())) {
    await page.locator('.debug-toggle').click();
    await page.locator('.debug-tab', { hasText: 'JUEGOS' }).click();
    await safeClick(page, page.locator('button.dbg-btn', { hasText: 'TERMINAR PARTIDA' }), 'TERMINAR PARTIDA');
    await page.waitForSelector('.result', { timeout: 8000 });
    log('debug: partida terminada a mano');
    await page.locator('.debug-panel__close').click();
  } else {
    log('la revancha ya habia terminado sola');
  }
}

// Volver a la portada
await page.locator('.result .btn--ghost').click();
await page.waitForSelector('.card');
await page.screenshot({ path: `${OUT}06-home-after.png`, fullPage: true });
log('vuelta a portada');

console.log(errors.length ? `\nERRORES:\n${errors.join('\n')}` : '\nSIN ERRORES DE CONSOLA');
await browser.close();
