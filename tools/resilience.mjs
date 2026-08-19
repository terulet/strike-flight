/**
 * Pruebas de resiliencia: lo que pasa cuando la red se porta mal.
 *
 * Cubre: jugar sin conexion, cola de envios, recuperacion automatica,
 * servidor caido, recarga a media sincronizacion, dos moviles mejorando a la
 * vez, ghost real y fallback del ghost.
 *
 * Necesita el servidor y el front levantados (npm run dev:all).
 *   node tools/resilience.mjs
 */
import { launchBrowser } from './browser.mjs';
import { fetchWithTimeout as fetch } from './fetch.mjs';
import { playCurrent, playDrift } from './bot.mjs';

// Por defecto contra la build de produccion servida por vite preview: es la
// unica forma de probar de verdad el service worker (abrir sin conexion).
const BASE = process.env.BASE ?? 'http://localhost:4173';
const API = process.env.API ?? 'http://127.0.0.1:8787';

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
  page.on('pageerror', (error) => console.log('   [pageerror]', error.message));
  page.on('requestfailed', (request) => console.log('   [requestfailed]', request.url().slice(-40), request.failure()?.errorText));
  await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
  // Antes de cortar la red hay que darle al service worker tiempo real de
  // guardar la app: si no, la prueba mediria una instalacion a medias.
  await page
    .waitForFunction(
      async () => {
        if (!navigator.serviceWorker?.controller) return false;
        const cache = await caches.open('playzone-rush-v2');
        const keys = await cache.keys();
        return keys.length >= 3;
      },
      { timeout: 15000 },
    )
    .catch(() => undefined);
  return { context, page };
}

const state = (page) => page.evaluate(() => {
  const app = window.__PZ.app;
  return {
    mode: app.mode,
    status: app.netStatus,
    pending: app.sync.pendingCount,
    day: app.dayKey,
    total: app.leaderboard().me.total,
    members: app.snapshot?.members?.length ?? 0,
  };
});

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

async function playChallenge(page, index, playMs) {
  await page.locator('.card .btn--accent').nth(index).click();
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playCurrent(page, playMs, 1);
  await page.waitForSelector('.result', { timeout: 60000 });
  const score = Number.parseInt(
    (await page.locator('.result__score').innerText()).replace(/\D/g, ''),
    10,
  );
  await page.getByText('CONTINUAR', { exact: true }).click();
  await page.waitForSelector('.play', { state: 'detached', timeout: 10000 });
  await page.waitForSelector('.card');
  return score;
}

/* ------------------------------------------------------------------ */
/* 1. Jugar sin conexion y sincronizar al volver                       */
/* ------------------------------------------------------------------ */
const eloi = await openPhone();
const code = await createGroup(eloi.page, 'Eloi');
check('grupo creado para la prueba', /^[A-Z0-9]{4}$/.test(code), code);

await eloi.context.setOffline(true);
await eloi.page.waitForTimeout(500);
const offlineScore = await playChallenge(eloi.page, 0, 6000);
check('sin conexion se puede jugar igual', offlineScore > 0, `${offlineScore} pts`);

const afterOffline = await state(eloi.page);
check('la marca queda en la cola de envio', afterOffline.pending >= 1, `${afterOffline.pending} pendiente(s)`);
check('la portada avisa de que hay algo pendiente', (await eloi.page.locator('.net').innerText()).includes('PENDIENTE'));
check('la puntuacion local se ve igual', afterOffline.total >= offlineScore, `${afterOffline.total}`);
await eloi.page.screenshot({ path: new URL('../shots/r01-offline.png', import.meta.url).pathname });

await eloi.context.setOffline(false);
await eloi.page.evaluate(() => window.dispatchEvent(new Event('online')));
await eloi.page.waitForFunction(() => window.__PZ.app.sync.pendingCount === 0, { timeout: 25000 });
const afterOnline = await state(eloi.page);
check('al volver la conexion se sube sola', afterOnline.pending === 0, `estado ${afterOnline.status}`);

const serverHasIt = await fetch(`${API}/api/health`).then((r) => r.json());
check('el servidor sigue vivo', serverHasIt.ok === true, `dia ${serverHasIt.day}`);

/* ------------------------------------------------------------------ */
/* 2. Recargar a media sincronizacion no pierde nada                   */
/* ------------------------------------------------------------------ */
await eloi.context.setOffline(true);
const pendingScore = await playChallenge(eloi.page, 1, 5000);
check('segunda marca sin conexion', pendingScore > 0, `${pendingScore} pts`);
await eloi.page.reload({ waitUntil: 'domcontentloaded' });
try {
  await eloi.page.waitForSelector('.card', { timeout: 20000 });
} catch {
  const dump = await eloi.page.evaluate(() => ({
    body: document.body.innerHTML.slice(0, 400),
    hasApp: Boolean(window.__PZ),
    sw: Boolean(navigator.serviceWorker?.controller),
  }));
  console.log('   diagnostico recarga offline:', JSON.stringify(dump));
  throw new Error('la app no ha arrancado tras recargar sin conexion');
}
check('la app abre sin conexion (service worker)', true);
const afterReload = await state(eloi.page);
check('la cola sobrevive a recargar', afterReload.pending >= 1, `${afterReload.pending} pendiente(s)`);

await eloi.context.setOffline(false);
await eloi.page.evaluate(() => window.dispatchEvent(new Event('online')));
await eloi.page.waitForFunction(() => window.__PZ.app.sync.pendingCount === 0, { timeout: 25000 });
check('y se sube en cuanto hay red', (await state(eloi.page)).pending === 0);

/* ------------------------------------------------------------------ */
/* 3. Dos moviles mejorando la misma marca a la vez                    */
/* ------------------------------------------------------------------ */
const marc = await openPhone();
await joinGroup(marc.page, code, 'Marc');

const [scoreA, scoreB] = await Promise.all([
  playChallenge(eloi.page, 2, 9000),
  playChallenge(marc.page, 2, 9000),
]);
check('los dos juegan a la vez sin pisarse', scoreA > 0 && scoreB > 0, `${scoreA} / ${scoreB}`);

await eloi.page.waitForTimeout(1500);
const boards = await Promise.all([
  eloi.page.evaluate(() => window.__PZ.app.leaderboard().standings.map((s) => [s.name, s.total])),
  marc.page.evaluate(() => window.__PZ.app.leaderboard().standings.map((s) => [s.name, s.total])),
]);
const sameBoard =
  JSON.stringify(boards[0].map((r) => r[1]).sort()) === JSON.stringify(boards[1].map((r) => r[1]).sort());
check('los dos ven el mismo ranking', sameBoard, JSON.stringify(boards[0]));

/* ------------------------------------------------------------------ */
/* 4. El mejor resultado nunca baja                                    */
/* ------------------------------------------------------------------ */
const bestBefore = await eloi.page.evaluate(() => window.__PZ.app.leaderboard().me.total);
const worse = await playChallenge(eloi.page, 2, 1200); // partida cortisima
const bestAfter = await eloi.page.evaluate(() => window.__PZ.app.leaderboard().me.total);
check('una partida peor no baja el total', bestAfter >= bestBefore, `${bestBefore} -> ${bestAfter} (peor: ${worse})`);

/* ------------------------------------------------------------------ */
/* 5. Ghost real de DRIFT                                              */
/* ------------------------------------------------------------------ */
const ghostInfo = await marc.page.evaluate(async () => {
  const app = window.__PZ.app;
  const snapshot = await app.sync.refresh();
  return snapshot?.ghosts ?? [];
});
const driftGhost = ghostInfo.find((g) => g.gameId === 'drift');
if (driftGhost) {
  check('se guarda la traza del ghost', driftGhost.bytes > 0, `${driftGhost.bytes} bytes en base64`);
  const fetched = await marc.page.evaluate(async (playerId) => {
    const ghost = await window.__PZ.app.sync.fetchGhost(playerId, 'drift');
    return ghost ? { score: ghost.score, len: ghost.trace.length, name: ghost.playerName } : null;
  }, driftGhost.playerId);
  check('el rival puede descargar la traza', fetched !== null, JSON.stringify(fetched));
} else {
  check('se guarda la traza del ghost (no ha tocado DRIFT hoy)', true, 'omitido: hoy no sale DRIFT');
}

const fallback = await marc.page.evaluate(async () => {
  const ghost = await window.__PZ.app.sync.fetchGhost('no-existe-este-jugador', 'drift');
  return ghost;
});
check('pedir el ghost de alguien que no existe no rompe nada', fallback === null);

/* ------------------------------------------------------------------ */
/* 6. Servidor caido: la app aguanta                                   */
/* ------------------------------------------------------------------ */
await eloi.page.route('**/api/**', (route) => route.abort());
await eloi.page.evaluate(() => window.__PZ.app.sync.refresh());
await eloi.page.waitForTimeout(1200);
const downState = await state(eloi.page);
check('con el servidor caido la app sigue en pie', downState.mode === 'group', `estado ${downState.status}`);
check('y se puede seguir jugando', (await playChallenge(eloi.page, 0, 3000)) >= 0);
await eloi.page.unroute('**/api/**');
await eloi.page.evaluate(() => window.dispatchEvent(new Event('online')));
await eloi.page.waitForFunction(() => window.__PZ.app.sync.pendingCount === 0, { timeout: 25000 });
check('y al volver el servidor, se pone al dia', (await state(eloi.page)).pending === 0);

console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n' + fail.map((f) => ` - ${f}`).join('\n'));
await browser.close();
process.exit(fail.length ? 1 : 0);
