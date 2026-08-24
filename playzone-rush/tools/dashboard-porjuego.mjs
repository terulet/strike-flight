/**
 * El panel POR JUEGO del dashboard, contra un servidor de verdad.
 *
 * server/test/dashboard.test.mjs ya prueba la aritmetica de perGame() en
 * aislamiento. Esto prueba lo que ESO no puede probar solo: que view (dashboard.ts)
 * pinta lo que manda el servidor, con HTTP real y DOM real -no una llamada
 * directa a metrics()-. Sembrar dos juegos con comportamiento deliberadamente
 * distinto y comprobar que el orden que se VE en pantalla es el que toca.
 *
 *   PZ_API=http://localhost:8788 BASE=http://localhost:5173 node tools/dashboard-porjuego.mjs
 */
import { launchBrowser } from './browser.mjs';

const API = process.env.PZ_API ?? 'http://localhost:8788';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const ok = [];
const fail = [];
const check = (name, cond, detalle = '') => {
  (cond ? ok : fail).push(name);
  console.log(`${cond ? '  OK  ' : ' FALLO'} ${name}${detalle ? ` — ${detalle}` : ''}`);
};

async function api(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

function tokenOf(player) {
  return `${player.id}.${player.secret}`;
}

/** N finishes de un gameId para un jugador, con revancha y compartir. */
async function jugarVarias(token, gameId, n, { revancha = 0, comparte = 0 } = {}) {
  const eventos = [];
  const day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < n; i++) {
    eventos.push({ type: 'game_start', day, ts: Date.now(), gameId });
    eventos.push({ type: 'game_finish', day, ts: Date.now(), gameId, value: 1000 + i });
  }
  for (let i = 0; i < revancha; i++) {
    eventos.push({ type: 'revenge_available', day, ts: Date.now(), gameId, value: 200 });
    eventos.push({ type: 'revenge_clicked', day, ts: Date.now(), gameId, value: 200 });
  }
  for (let i = 0; i < comparte; i++) {
    eventos.push({ type: 'share_completed', day, ts: Date.now(), gameId, meta: { resultado: 'imagen' } });
  }
  await api('/api/events', { events: eventos }, token);
}

/** n filas de scores agotadas (3/3) para gameId, cada una con un jugador nuevo del grupo. */
async function agotarIntentos(code, gameId, n) {
  for (let i = 0; i < n; i++) {
    const joined = await api('/api/groups/join', { code, name: `AI-${gameId}-${i}` });
    await api(
      '/api/scores',
      {
        attemptId: `seed-${gameId}-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        gameId,
        challengeId: 'c1',
        day: new Date().toISOString().slice(0, 10),
        score: 1500,
        durationMs: 20_000,
        attemptsUsed: 3,
      },
      tokenOf(joined.player),
    );
  }
}

console.log('Sembrando un grupo real: CARGA enganchando de verdad, FRENO a medias...');
const creado = await api('/api/groups', { name: 'Eloi' });
const code = creado.group.code;
const token = tokenOf(creado.player);

await jugarVarias(token, 'carga', 10, { revancha: 9, comparte: 6 });
await agotarIntentos(code, 'carga', 10);
await jugarVarias(token, 'freno', 9, { revancha: 1, comparte: 0 });
await agotarIntentos(code, 'freno', 2); // pocas: que se note tambien en "agota 3/3"
await jugarVarias(token, 'torre', 3, {}); // por debajo de la muestra minima a proposito

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
const page = await context.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));

await page.goto(`${BASE}/?debug`);
if ((await page.locator('.onboarding').count()) > 0) {
  // Entra en el MISMO grupo que se acaba de sembrar por API: sin esto el
  // dashboard cargaria con un token sin grupo y no ensenaria nada.
  await page.evaluate(
    async ([codigoGrupo]) => {
      await window.__PZ.app.joinGroup(codigoGrupo, 'Observador');
    },
    [code],
  );
}
await page.waitForSelector('.card', { timeout: 15000 });

await page.goto(`${BASE}/?dashboard`);
await page.waitForSelector('.dash-games, .dash-empty', { timeout: 10000 });

const filas = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.dash-game')).map((row) => ({
    nombre: row.querySelector('.dash-game__head span')?.textContent ?? '',
    valor: row.querySelector('.dash-game__value')?.textContent ?? '',
    pendiente: row.querySelector('.dash-game__fill--pendiente') !== null,
    detalle: row.querySelector('.dash-game__detail')?.textContent ?? '',
    esTop: row.classList.contains('dash-game--top'),
  })),
);
console.log('  filas vistas en pantalla:', filas.map((f) => `${f.nombre}:${f.valor}`).join(' '));

// El sorteo diario se programa con un setTimeout durante boot() y, sin que la
// app sepa que ?dashboard se ha hecho cargo de la pantalla, la pisaria al
// cabo de un rato -no en el primer fotograma, por eso hay que esperar a
// proposito y no fiarse de la lectura de mas arriba, que es demasiado rapida
// para pillarlo-.
await page.waitForTimeout(2500);
const siguePuesto = await page.evaluate(() => ({
  juegos: document.querySelectorAll('.dash-game').length,
  sorteo: document.querySelector('.sorteo, .reveal') !== null,
}));
check(
  'el sorteo diario no pisa el dashboard pasado un rato',
  siguePuesto.juegos >= 3 && !siguePuesto.sorteo,
  JSON.stringify(siguePuesto),
);

const carga = filas.find((f) => f.nombre === 'CARGA');
const freno = filas.find((f) => f.nombre === 'FRENO');
const torre = filas.find((f) => f.nombre === 'TORRE');

check('el panel POR JUEGO pinta filas de verdad, no esta vacio', filas.length >= 3, `${filas.length} filas`);
check('CARGA (el juego que engancha) sale en pantalla con un numero', Boolean(carga) && carga.valor !== '—', carga?.valor);
check('FRENO tambien tiene indice: cruzo la muestra minima', Boolean(freno) && freno.valor !== '—', freno?.valor);
check(
  'CARGA queda por delante de FRENO en la pantalla, no solo en la API',
  filas.indexOf(carga) < filas.indexOf(freno),
);
check('CARGA es el que se marca como el mejor (borde dorado)', carga?.esTop === true);
check(
  'TORRE, con solo 3 partidas, sale sin indice (raya) y con la barra a rayas',
  Boolean(torre) && torre.valor === '—' && torre.pendiente === true,
);
check('el detalle de CARGA ensena los numeros crudos, no solo el compuesto', /revancha|comparte/.test(carga?.detalle ?? ''), carga?.detalle);

await page.waitForSelector('.boot', { state: 'detached', timeout: 5000 }).catch(() => {});
await page.locator('.dash-games').scrollIntoViewIfNeeded();
await page
  .locator('.dash-games')
  .screenshot({ path: '/tmp/claude-0/-home-user-strike-flight/23ac4d6f-5b3e-5de4-9ed6-06319859e4c9/scratchpad/dashboard-porjuego-filas.png' });
await page.screenshot({ path: '/tmp/claude-0/-home-user-strike-flight/23ac4d6f-5b3e-5de4-9ed6-06319859e4c9/scratchpad/dashboard-porjuego.png', fullPage: true });
console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n  ' + fail.join('\n  '));
console.log(errores.length ? `\nERRORES DE PAGINA:\n  ${errores.join('\n  ')}` : '\nSin errores de pagina.');
await browser.close();
process.exit(fail.length ? 1 : 0);
