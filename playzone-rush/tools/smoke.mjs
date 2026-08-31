// Recorrido manual automatizado en viewport de iPhone (393x852).
import { launchBrowser } from './browser.mjs';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? new URL('../shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

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

const browser = await launchBrowser();
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

/** Estas pruebas son del modo en solitario: si sale el onboarding, lo elegimos. */
async function enterSolo(page) {
  if ((await page.locator('.onboarding').count()) > 0) {
    // Por clase, no por texto: el texto tambien aparece en la nota de abajo.
    await page.locator('.onboarding__solo').click();
    await page.waitForSelector('.card', { timeout: 10000 });
  }
}

/** Salir del resultado por su accion estable, no por una etiqueta que cambia. */
async function leaveResult(page) {
  await page.locator('.result .salir-resultado').click();
  await page.waitForSelector('.play', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('.card');
}


await enterSolo(page);
await page.waitForSelector('.card');
// Medir la portada ya estable: el boot y el sorteo diario son secuencias
// transitorias controladas por JS, no animaciones perpetuas de la home.
await page.waitForFunction(
  () => !document.querySelector('.boot') && !document.querySelector('.sorteo'),
  { timeout: 10000 },
);
await page.waitForTimeout(200);

async function infiniteAttentionAnimations(page) {
  return page.evaluate(() => document.getAnimations({ subtree: true }).filter((animation) => {
    const timing = animation.effect?.getComputedTiming();
    if (timing?.iterations !== Infinity) return false;
    // La aurora de 26 s es ambiente, no una llamada de atencion.
    return Number(timing.duration) < 25_000;
  }).map((animation) => animation.animationName ?? 'unnamed'));
}

const attention = await infiniteAttentionAnimations(page);
if (attention.length > 2) errors.push(`motion budget: ${attention.length} animaciones infinitas (${attention.join(', ')})`);
log(`motion budget: ${attention.length}/2 (1 hero + 1 secundaria)`);
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
await leaveResult(page);
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}06-home-after.png`, fullPage: true });
log('vuelta a portada');

console.log(errors.length ? `\nERRORES:\n${errors.join('\n')}` : '\nSIN ERRORES DE CONSOLA');

await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload({ waitUntil: 'networkidle' });
await enterSolo(page);
await page.waitForSelector('.card');
const reducedAttention = await infiniteAttentionAnimations(page);
if (reducedAttention.length) errors.push(`reduced motion conserva animaciones infinitas: ${reducedAttention.join(', ')}`);

console.log(errors.length ? `\nERRORES FINALES:\n${errors.join('\n')}` : '\nMOTION Y CONSOLA: OK');
await browser.close();
process.exit(errors.length ? 1 : 0);
