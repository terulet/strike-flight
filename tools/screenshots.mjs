/**
 * Capturas del build en viewport de iPhone (393x852, DPR 2) mas landscape y
 * escritorio. Cada captura sale de jugar de verdad, no de maquetas.
 *
 *   node tools/screenshots.mjs
 */
import { chromium } from 'playwright';
import { launchGame, playCurrent, playDrift, playPulse, playSnap } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('../shots/', import.meta.url).pathname;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-ES',
});
const page = await context.newPage();
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('·', name);
};

await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
await page.waitForSelector('.card');

// 1. Portada tal cual la ve alguien que abre la app por primera vez.
await shot('01-portada');

// 2. Cuenta atras con las reglas del juego.
await page.locator('.card .btn--accent').first().click();
await page.waitForSelector('.countdown');
await page.waitForTimeout(700);
await shot('02-cuenta-atras');
await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });

// 3. Gameplay del reto 1 con el fantasma del rival.
await page.waitForTimeout(400);
await playCurrent(page, 6000);
await shot('03-gameplay-reto1');
await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
await page.waitForSelector('.result');
await page.waitForTimeout(700);
await shot('04-resultado');
await page.locator('.result .btn--ghost').click();
await page.waitForSelector('.card');

// 4. Los otros dos juegos.
for (const [game, bot, name, ms] of [
  ['pulse', playPulse, '05-pulse', 5200],
  // SNAP se acaba al gastar el cargador, asi que el bot juega menos rato para
  // que la captura salga en plena partida y no en el resultado.
  ['snap', playSnap, '06-snap', 1500],
  ['drift', playDrift, '07-drift', 5200],
]) {
  await launchGame(page, game);
  await page.waitForTimeout(300);
  await bot(page, ms);
  await shot(name);
  await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await page.waitForSelector('.result');
  await page.locator('.result .btn--ghost').click();
  await page.waitForSelector('.card');
}

// 5. Resultado de pique: adelantar a alguien.
await page.evaluate(() => {
  const app = window.__PZ.app;
  app.save.update(() => {
    const day = app.save.day(app.dayKey);
    day.rivalBoosts = {};
    for (const spec of app.plan.challenges) {
      const progress = app.save.challenge(app.dayKey, spec.id);
      progress.bestScore = 0;
      progress.plays = 0;
    }
  });
  const board = app.leaderboard();
  app.save.update(() => {
    const day = app.save.day(app.dayKey);
    for (const entry of board.standings) {
      if (!entry.isMe) day.rivalBoosts[entry.id] = Math.round((4600 - entry.total) / 3);
    }
  });
  app.refresh();
  app.startChallenge(app.plan.challenges[0], { ignoreAttempts: true });
});
await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
await playCurrent(page, 60000);
await page.waitForSelector('.result', { timeout: 60000 });
await page.waitForTimeout(800);
await shot('08-resultado-adelantamiento');
await page.locator('.result .btn--ghost').click();
await page.waitForSelector('.card');
await shot('09-portada-lider');

// 6. Reto secreto abierto y evento CHAOS.
await page.evaluate(() => {
  const app = window.__PZ.app;
  app.save.update(() => {
    for (const spec of app.plan.challenges) {
      const progress = app.save.challenge(app.dayKey, spec.id);
      if (progress.plays === 0) progress.plays = 1;
    }
    app.save.day(app.dayKey).rivalsPlayed = ['marc', 'kali', 'yoli', 'silvia'];
    app.save.day(app.dayKey).secretUnlocked = true;
    app.save.day(app.dayKey).chaosEnabled = true;
  });
  app.refresh();
});
await page.locator('.scroller').evaluate((node) => node.scrollTo({ top: node.scrollHeight * 0.42 }));
await page.waitForTimeout(300);
await shot('10-secreto-y-chaos');

await page.evaluate(() => {
  const app = window.__PZ.app;
  app.startChallenge(app.plan.chaos, { ignoreAttempts: true, quick: true });
});
await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 });
await playCurrent(page, 4500);
await shot('11-chaos');
await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
await page.waitForSelector('.result');
await page.locator('.result .btn--ghost').click();
await page.waitForSelector('.card');

// 7. Marcas personales y panel de debug.
await page.locator('.scroller').evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
await page.waitForTimeout(300);
await shot('12-clasificacion-y-marcas');

await page.locator('.debug-toggle').click();
await page.waitForSelector('.debug-panel');
await shot('13-debug-dia');
await page.locator('.debug-tab', { hasText: 'RIVALES' }).click();
await shot('14-debug-rivales');
await page.locator('.debug-tab', { hasText: 'ESTADO' }).click();
await shot('15-debug-estado');
await page.locator('.debug-panel__close').click();

// 8. Landscape y escritorio.
await page.setViewportSize({ width: 852, height: 393 });
await page.waitForTimeout(500);
await shot('16-landscape');
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(500);
await shot('17-escritorio');

await browser.close();
console.log('\nCapturas en shots/');
