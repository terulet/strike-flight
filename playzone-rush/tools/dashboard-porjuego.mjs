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
async function jugarVarias(
  token,
  gameId,
  n,
  { revancha = 0, comparte = 0, oneMore = 0, closeLoss = 0, perfMala = false } = {},
) {
  const eventos = [];
  const day = new Date().toISOString().slice(0, 10);
  let ts = Date.now();
  for (let i = 0; i < n; i++) {
    eventos.push({ type: 'game_start', day, ts: ts++, gameId });
    // Las primeras `oneMore` terminan CON intento libre y vuelven a arrancar
    // el mismo juego enseguida: asi el panel tiene algo real que ensenar en
    // "one more" y en "reintento en".
    const conIntento = i < oneMore;
    // Las cinco cifras del PERF PATCH: una tanda "sana" y otra deliberadamente
    // con microtirones, para poder ver la linea de aviso en el panel de verdad.
    const perf = perfMala
      ? { frameCount: 500, slowFrames50: 90, slowFrames100: 40, worstFrameMs: 640 }
      : { frameCount: 500, slowFrames50: 2, slowFrames100: 0, worstFrameMs: 28 };
    eventos.push({
      type: 'game_finish',
      day,
      ts: ts++,
      gameId,
      value: 1000 + i,
      meta: { challengeId: 'c1', endedBy: 'time', attemptsLeftAfter: conIntento ? 1 : 0, ...perf },
    });
    if (conIntento) eventos.push({ type: 'game_start', day, ts: ts++, gameId });
  }
  for (let i = 0; i < revancha; i++) {
    // Las primeras `closeLoss` se pierden por menos del margen de "por poco".
    const marginPct = i < closeLoss ? 5 : 40;
    eventos.push({ type: 'revenge_available', day, ts: ts++, gameId, value: 200, meta: { marginPct } });
    eventos.push({ type: 'revenge_clicked', day, ts: ts++, gameId, value: 200, meta: { marginPct } });
  }
  for (let i = 0; i < comparte; i++) {
    eventos.push({ type: 'share_completed', day, ts: ts++, gameId, meta: { resultado: 'imagen' } });
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

// 30 finishes cruza a senal PRELIMINAR (25+): con menos, el panel no marca
// a nadie como "el mejor" aunque vaya primero, y esa comprobacion es justo
// la que existe para pillar si esa regla se rompe.
await jugarVarias(token, 'carga', 30, { revancha: 27, comparte: 18, oneMore: 24, closeLoss: 20, perfMala: false });
await agotarIntentos(code, 'carga', 30);
await jugarVarias(token, 'freno', 9, { revancha: 1, comparte: 0, oneMore: 1, perfMala: true });
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
    confianza: row.querySelector('.dash-game__confianza')?.textContent ?? '',
    pendiente: row.querySelector('.dash-game__fill--pendiente') !== null,
    detalle: row.querySelector('.dash-game__detail')?.textContent ?? '',
    extra: row.querySelector('.dash-game__detail--extra')?.textContent ?? '',
    perf: row.querySelector('.dash-game__detail--perf')?.textContent ?? '',
    perfMala: row.querySelector('.dash-game__detail--perf-mala') !== null,
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
check('el detalle de CARGA incluye One More (la senal nueva)', /one more/.test(carga?.detalle ?? ''), carga?.detalle);
check(
  'CARGA (30 partidas) se marca como SENAL PRELIMINAR, no ALTA CONFIANZA de mentira',
  carga?.confianza === 'SENAL PRELIMINAR',
  carga?.confianza,
);
check(
  'FRENO (9 partidas) se marca como MUESTRA MUY BAJA: cruza el minimo pero es fragil',
  freno?.confianza === 'MUESTRA MUY BAJA',
  freno?.confianza,
);
check(
  'TORRE (3 partidas, bajo el minimo) se marca como SIN DATOS',
  torre?.confianza === 'SIN DATOS',
  torre?.confianza,
);
check(
  'la linea extra ensena las senales que NO entran en el compuesto (sigue jugando, reintento, first pick...)',
  /sigue jugando/.test(carga?.extra ?? '') && /reintento en/.test(carga?.extra ?? '') && /elegido/.test(carga?.extra ?? ''),
  carga?.extra,
);
check('el detalle de rendimiento de CARGA (sano) esta presente', /fotogramas medidos/.test(carga?.perf ?? ''), carga?.perf);
check('CARGA, con rendimiento sano, NO lleva el aviso de rendimiento malo', carga?.perfMala === false);
check('FRENO, con microtirones deliberados, SI lleva el aviso de rendimiento malo', freno?.perfMala === true, freno?.perf);
check(
  'el compuesto de CARGA y FRENO no se ve arrastrado por el rendimiento: es diagnostico, no enganche',
  carga?.valor !== '—' && freno?.valor !== '—',
  `carga:${carga?.valor} freno:${freno?.valor}`,
);

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
