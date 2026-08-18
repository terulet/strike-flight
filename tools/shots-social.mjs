/**
 * Capturas del milestone social a 393x852, jugando de verdad con dos moviles.
 *
 *   node tools/shots-social.mjs
 */
import { launchBrowser } from './browser.mjs';
import { playCurrent, playDrift, playMemory } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('../shots/', import.meta.url).pathname;

const browser = await launchBrowser();

const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('·', name);
};

async function openPhone(query = '') {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/${query}`, { waitUntil: 'networkidle' });
  return { context, page };
}

const leaveResult = async (page) => {
  await page.getByText('CONTINUAR', { exact: true }).click();
  await page.waitForSelector('.play', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('.card');
};

/** Jugar un rato de verdad y cortar: la puntuacion sale de jugar. */
async function quickPlay(page, index, playMs = 3500) {
  await page.locator('.card .btn--accent').nth(index).click();
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playCurrent(page, playMs, 1);
  if ((await page.locator('.result').count()) === 0) {
    await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  }
  await page.waitForSelector('.result', { timeout: 30000 });
  await leaveResult(page);
}

/* ---------------- 1. Onboarding ---------------- */
const eloi = await openPhone();
await eloi.page.waitForSelector('.onboarding');
await shot(eloi.page, 's01-onboarding');

await eloi.page.getByText('CREAR GRUPO', { exact: true }).click();
await eloi.page.locator('.onboarding__input').fill('Eloi');
await shot(eloi.page, 's02-crear-grupo');
await eloi.page.locator('.btn--play').click();
await eloi.page.waitForSelector('.onboarding__code');
const code = (await eloi.page.locator('.onboarding__code').innerText()).trim();
await shot(eloi.page, 's03-codigo-grupo');
await eloi.page.getByText('ENTRAR A PLAYZONE').click();
await eloi.page.waitForSelector('.card');

/* ---------------- 2. Unirse ---------------- */
const marc = await openPhone();
await marc.page.waitForSelector('.onboarding');
await marc.page.getByText('UNIRME A UN GRUPO').click();
await marc.page.locator('.onboarding__input--code').fill(code);
await marc.page.locator('.onboarding__input').nth(1).fill('Marc');
await shot(marc.page, 's04-unirse');
await marc.page.locator('.btn--play').click();
await marc.page.waitForSelector('.card', { timeout: 15000 });

/* ---------------- 3. MEMORY en marcha ---------------- */
const memoryIndex = await marc.page.evaluate(() =>
  window.__PZ.app.plan.challenges.findIndex((spec) => spec.gameId === 'memory'),
);
if (memoryIndex >= 0) {
  await marc.page.locator('.card .btn--accent').nth(memoryIndex).click();
  await marc.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playMemory(marc.page, 5200, 1);
  await shot(marc.page, 's05-memory');
  await marc.page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await marc.page.waitForSelector('.result');
  await leaveResult(marc.page);
} else {
  // Si hoy no toca en la rotacion, se lanza suelto para la captura.
  await marc.page.evaluate(() => window.__PZ.app.startDebugRun('memory'));
  await marc.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playMemory(marc.page, 5200, 1);
  await shot(marc.page, 's05-memory');
  await marc.page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await marc.page.waitForSelector('.result');
  await leaveResult(marc.page);
}

/* ---------------- 4. Ranking real + grupo ---------------- */
const driftIndex = await eloi.page.evaluate(() =>
  window.__PZ.app.plan.challenges.findIndex((spec) => spec.gameId === 'drift'),
);
await quickPlay(eloi.page, 0, 4000);
await eloi.page.waitForTimeout(800);
await shot(eloi.page, 's06-ranking-real');

/* ---------------- 5. Marc adelanta a Eloi ---------------- */
await marc.page.locator('.card .btn--accent').nth(0).click();
await marc.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await playCurrent(marc.page, 16000, 1);
if ((await marc.page.locator('.result').count()) === 0) {
  await marc.page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
}
await marc.page.waitForSelector('.result', { timeout: 30000 });
await shot(marc.page, 's07-resultado-gana');
await leaveResult(marc.page);

await eloi.page.waitForSelector('.overtake', { timeout: 25000 });
await shot(eloi.page, 's08-te-han-superado');

/* ---------------- 6. Revancha con objetivo ---------------- */
await eloi.page.locator('.overtake .btn--play').click();
await eloi.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await playCurrent(eloi.page, 4000, 1);
await shot(eloi.page, 's09-revancha-objetivo');
await playCurrent(eloi.page, 60000, 1);
await eloi.page.waitForSelector('.result', { timeout: 60000 });
await eloi.page.waitForTimeout(600);
await shot(eloi.page, 's10-resultado-superado');
await leaveResult(eloi.page);

/* ---------------- 7. Ghost real ---------------- */
if (driftIndex >= 0) {
  await marc.page.locator('.card .btn--accent').nth(driftIndex).click();
  await marc.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playDrift(marc.page, 8000, 1);
  await marc.page.waitForSelector('.result', { timeout: 60000 });
  await leaveResult(marc.page);

  await eloi.page.locator('.card .btn--accent').nth(driftIndex).click();
  await eloi.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playDrift(eloi.page, 5000, 1);
  await shot(eloi.page, 's11-ghost-real');
  await playDrift(eloi.page, 60000, 1);
  await eloi.page.waitForSelector('.result', { timeout: 60000 });
  await leaveResult(eloi.page);
}

/* ---------------- 8. Reto secreto con datos reales ---------------- */
for (const page of [eloi.page, marc.page]) {
  for (let index = 0; index < 3; index++) {
    const left = await page.evaluate(
      (i) => window.__PZ.app.attemptsLeft(window.__PZ.app.plan.challenges[i]),
      index,
    );
    if (left > 0) await quickPlay(page, index, 3000);
  }
}
await eloi.page.evaluate(() => window.__PZ.app.sync.refresh());
await eloi.page.waitForTimeout(1200);
await eloi.page.locator('.scroller').evaluate((node) => node.scrollTo({ top: node.scrollHeight * 0.45 }));
await eloi.page.waitForTimeout(400);
await shot(eloi.page, 's12-reto-secreto');

/* ---------------- 9. Clasificacion completa ---------------- */
await eloi.page.locator('.scroller').evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
await eloi.page.waitForTimeout(400);
await shot(eloi.page, 's13-clasificacion');

/* ---------------- 10. Debug: grupo y metricas ---------------- */
const debugPhone = eloi;
await debugPhone.page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
await debugPhone.page.waitForSelector('.card');
await debugPhone.page.locator('.debug-toggle').click();
await debugPhone.page.locator('.debug-tab', { hasText: 'GRUPO' }).click();
await shot(debugPhone.page, 's14-debug-grupo');
await debugPhone.page.locator('.debug-tab', { hasText: 'METRICAS' }).click();
await shot(debugPhone.page, 's15-debug-metricas');

await browser.close();
console.log('\nCapturas del milestone social en shots/');
