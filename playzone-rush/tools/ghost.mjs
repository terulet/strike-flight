/**
 * Prueba del ghost real de DRIFT.
 *
 *   Marc juega -> se guarda su traza -> Eloi lanza revancha -> ve la nave de
 *   Marc corriendo a su lado -> la adelanta -> se anuncia.
 *
 * Y el caso feo: si el rival no tiene traza, la partida tiene que funcionar
 * igual con la marca de siempre.
 *
 *   node tools/ghost.mjs
 */
import { launchBrowser } from './browser.mjs';
import { playDrift, salirDelResultado} from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL('../shots/', import.meta.url).pathname;

const ok = [];
const fail = [];
const check = (name, condition, detail = '') => {
  (condition ? ok : fail).push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${condition ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await launchBrowser();

async function openPhone() {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { context, page };
}

async function createGroup(page, name) {
  await page.getByText('CREAR GRUPO', { exact: true }).click();
  await page.locator('.onboarding__input').fill(name);
  await page.locator('.btn--play').click();
  await page.waitForSelector('.onboarding__code');
  const code = (await page.locator('.onboarding__code').innerText()).trim();
  await page.getByText('ENTRAR A PLAYZONE').click();
  await page.waitForSelector('.card');
  return code;
}

async function joinGroup(page, code, name) {
  await page.getByText('UNIRME A UN GRUPO').click();
  await page.locator('.onboarding__input--code').fill(code);
  await page.locator('.onboarding__input').nth(1).fill(name);
  await page.locator('.btn--play').click();
  await page.waitForSelector('.card', { timeout: 15000 });
}

const leaveResult = async (page) => {
  await salirDelResultado(page);
};

/* ------------------------------------------------------------------ */

const eloi = await openPhone();
const code = await createGroup(eloi.page, 'Eloi');
const marc = await openPhone();
await joinGroup(marc.page, code, 'Marc');

// Localizamos el reto de DRIFT de hoy (la rotacion elige 3 de 4 juegos).
const driftIndex = await eloi.page.evaluate(() =>
  window.__PZ.app.plan.challenges.findIndex((spec) => spec.gameId === 'drift'),
);

if (driftIndex < 0) {
  console.log('Hoy no toca DRIFT en la rotacion: prueba omitida.');
  console.log('Sugerencia: repetir manana o usar PROBAR SOLO con el dia virtual.');
  await browser.close();
  process.exit(0);
}

/* 1. Marc juega y deja su traza -------------------------------------- */
await marc.page.locator('.card .btn--accent').nth(driftIndex).click();
await marc.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await playDrift(marc.page, 9000, 1);
await marc.page.waitForSelector('.result', { timeout: 60000 });
const marcTime = await marc.page.evaluate(
  () => window.__PZ.app.playScreen?.game?.getResult?.()?.durationMs ?? 0,
);
await leaveResult(marc.page);
check('marc deja su marca en DRIFT', marcTime > 2000, `${(marcTime / 1000).toFixed(1)} s`);

const ghostMeta = await eloi.page.evaluate(async () => {
  const snapshot = await window.__PZ.app.sync.refresh();
  return snapshot?.ghosts?.find((ghost) => ghost.gameId === 'drift') ?? null;
});
check('el servidor guarda la traza', ghostMeta !== null, ghostMeta ? `${ghostMeta.bytes} bytes` : '');

/* 2. Eloi juega contra el fantasma ------------------------------------ */
await eloi.page.locator('.card .btn--accent').nth(driftIndex).click();
await eloi.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });

const ghostLoaded = await eloi.page.evaluate(() => {
  const config = window.__PZ.game()?.config;
  return {
    rival: config?.ghost?.rivalName ?? null,
    samples: config?.ghost?.samples?.length ?? 0,
    value: config?.ghost?.value ?? 0,
  };
});
check('la traza del rival llega antes de empezar', ghostLoaded.samples > 0, JSON.stringify(ghostLoaded));

// Con la partida en marcha, el fantasma tiene que estar en pantalla.
let sawGhost = false;
for (let i = 0; i < 25 && !sawGhost; i++) {
  const state = await eloi.page.evaluate(() => window.__PZ.state());
  if (state?.ghostX !== null && state?.ghostX !== undefined) sawGhost = true;
  await eloi.page.waitForTimeout(120);
}
check('se ve la nave del rival avanzando', sawGhost);
await eloi.page.screenshot({ path: `${OUT}g01-ghost-en-carrera.png` });

await playDrift(eloi.page, 60000, 1);
await eloi.page.waitForSelector('.result', { timeout: 60000 });
await eloi.page.waitForTimeout(500);
const resultText = await eloi.page.locator('.result__inner').innerText();
check('al adelantarlo se anuncia', resultText.includes('MARCA DEL RIVAL'), resultText.split('\n')[3] ?? '');
await eloi.page.screenshot({ path: `${OUT}g02-ghost-superado.png` });
await leaveResult(eloi.page);

/* 3. Sin traza del rival, la partida sigue funcionando ---------------- */
const fallback = await marc.page.evaluate(async () => {
  const app = window.__PZ.app;
  const spec = app.plan.challenges.find((challenge) => challenge.gameId !== 'drift');
  if (!spec) return null;
  app.startChallenge(spec, { ignoreAttempts: true, quick: true });
  const config = app.playScreen.game.config;
  const info = { game: spec.gameId, ghost: config.ghost ? config.ghost.rivalName : null, samples: config.ghost?.samples?.length ?? 0 };
  app.playScreen.forceFinish();
  return info;
});
check('un juego sin ghost arranca igual', fallback !== null, JSON.stringify(fallback));
await marc.page.waitForSelector('.result', { timeout: 10000 });
await leaveResult(marc.page);

console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n' + fail.map((f) => ` - ${f}`).join('\n'));
await browser.close();
process.exit(fail.length ? 1 : 0);
