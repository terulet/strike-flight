/**
 * LA PRUEBA DEL MILESTONE DE ALFA.
 *
 * Comprueba lo que hace falta para poder soltar esto en manos de cinco
 * personas durante una semana:
 *
 *   1. Un solo proceso sirve el juego Y la API (lo que se despliega de verdad)
 *   2. Se puede instalar en la pantalla de inicio (manifest, iconos, SW)
 *   3. Una version nueva se detecta y se aplica sin romper nada
 *   4. Un error del navegador acaba registrado en el servidor
 *   5. El dashboard ensena datos reales y no puede tocar resultados
 *   6. Dos moviles en condiciones de red MUY distintas siguen compitiendo
 *
 * Sobre el punto 6, con toda la honestidad: esto emula dos redes asimetricas
 * (una rapida y otra 3G lenta con mucha latencia) desde el mismo equipo. Es
 * una buena aproximacion a "cada uno en una red distinta", pero NO sustituye
 * la prueba con dos iPhones de verdad, uno por wifi y otro por datos moviles.
 * Esa esta en docs/DESPLIEGUE.md y hay que hacerla a mano.
 *
 * Necesita la build de produccion servida por el propio servidor:
 *   npm run build && npm run server
 *   node tools/alfa.mjs
 */
import { chromium } from 'playwright';
import { playCurrent } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8787';

const ok = [];
const fail = [];
const check = (name, condition, detail = '') => {
  (condition ? ok : fail).push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${condition ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const section = (title) => console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 56 - title.length))}`);

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=swiftshader'],
});

const errors = [];
async function openPhone(label, network = null) {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));

  if (network) {
    // CDP: emula de verdad la red a nivel de navegador, no con un sleep.
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: network.latency,
      downloadThroughput: network.download,
      uploadThroughput: network.upload,
    });
  }
  return { page, context, label };
}

const state = (page) =>
  page.evaluate(() => ({
    mode: window.__PZ.app.mode,
    status: window.__PZ.app.netStatus,
    pending: window.__PZ.app.sync.pendingCount,
    code: window.__PZ.app.snapshot?.group?.code ?? null,
    myTotal: window.__PZ.app.me().total,
    standings: window.__PZ.app.leaderboard().standings.map((s) => ({ name: s.name, total: s.total, isMe: s.isMe })),
    overtake: window.__PZ.app.pendingOvertake?.rivalName ?? null,
  }));

/**
 * Juega un reto entero. El bot puede dejar de pulsar antes, pero el reto sigue
 * hasta que se acaba su tiempo: hay que esperar a ESO, no a un numero fijo, o
 * la prueba mide una partida que nunca termino (y entonces no hay marca que
 * subir, ni cola que comprobar).
 */
async function playChallenge(page, index, quality = 1) {
  const durationMs = await page.evaluate((i) => {
    const spec = window.__PZ.app.plan.challenges[i];
    window.__PZ.app.startChallenge(spec, { quick: true });
    return spec.durationMs;
  }, index);
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 12000 }).catch(() => {});
  await playCurrent(page, durationMs, quality);
  await page.waitForSelector('.result', { timeout: durationMs + 15000 }).catch(() => {});
  const score = await page.evaluate(() => window.__PZ.app.me().total);
  await page.evaluate(() => window.__PZ.app.exitToHome());
  return score;
}

/* ------------------------------------------------------------------ */
section('1. UN SOLO PROCESO: JUEGO Y API EN EL MISMO ORIGEN');
/* ------------------------------------------------------------------ */

const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
check('/api/health responde', health.ok === true, `dia ${health.day}`);
check('el servidor dice que build sirve', typeof health.buildId === 'string' && health.buildId.length > 0, health.buildId);

const indexResponse = await fetch(`${BASE}/`);
const indexHtml = await indexResponse.text();
check('el mismo puerto sirve el juego', indexResponse.status === 200 && indexHtml.includes('PLAYZONE RUSH'));
check(
  'index.html se revalida siempre (para coger builds nuevas)',
  indexResponse.headers.get('cache-control') === 'no-cache',
  indexResponse.headers.get('cache-control') ?? 'sin cabecera',
);

const assetMatch = indexHtml.match(/src="\.\/(assets\/[^"]+\.js)"/);
if (assetMatch) {
  const asset = await fetch(`${BASE}/${assetMatch[1]}`);
  check(
    'los assets con hash se cachean un ano',
    (asset.headers.get('cache-control') ?? '').includes('immutable'),
    asset.headers.get('cache-control') ?? 'sin cabecera',
  );
} else {
  check('los assets con hash se cachean un ano', false, 'no se ha encontrado el bundle en index.html');
}

/* ------------------------------------------------------------------ */
section('2. INSTALABLE EN LA PANTALLA DE INICIO');
/* ------------------------------------------------------------------ */

const manifestResponse = await fetch(`${BASE}/manifest.webmanifest`);
const manifest = await manifestResponse.json();
check(
  'el manifest se sirve con su tipo correcto',
  (manifestResponse.headers.get('content-type') ?? '').includes('application/manifest+json'),
  manifestResponse.headers.get('content-type') ?? 'sin cabecera',
);
check('tiene nombre y modo standalone', manifest.name === 'PLAYZONE RUSH' && manifest.display === 'standalone');
check('y color de fondo de la marca', manifest.background_color === '#07070d');

for (const icon of manifest.icons) {
  const response = await fetch(`${BASE}/${icon.src}`);
  check(
    `icono ${icon.sizes} ${icon.purpose} accesible`,
    response.status === 200 && response.headers.get('content-type') === 'image/png',
    `${response.headers.get('content-length')} bytes`,
  );
}
check('hay un icono maskable (iconos redondos de Android)', manifest.icons.some((i) => i.purpose === 'maskable'));

const apple = await fetch(`${BASE}/icons/apple-touch-icon.png`);
check('apple-touch-icon accesible (iOS ignora el manifest)', apple.status === 200);
check('index.html enlaza el manifest y el icono de Apple',
  indexHtml.includes('rel="manifest"') && indexHtml.includes('rel="apple-touch-icon"'));

const sw = await fetch(`${BASE}/sw.js`);
check('el service worker se revalida siempre', sw.headers.get('cache-control') === 'no-cache');

const installable = await openPhone('instalacion');
await installable.page.goto(BASE, { waitUntil: 'networkidle' });
const swReady = await installable.page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'sin soporte';
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  return registration ? 'activo' : 'no activo';
});
check('el service worker se registra y activa', swReady === 'activo', swReady);
await installable.context.close();

/* ------------------------------------------------------------------ */
section('3. VERSION NUEVA: SE DETECTA Y SE APLICA');
/* ------------------------------------------------------------------ */

const updater = await openPhone('actualizacion');
await updater.page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
await updater.page.waitForFunction(() => Boolean(window.__PZ?.app));
await updater.page.evaluate(() => {
  if (window.__PZ.app.mode === 'none') window.__PZ.app.playSolo();
});
await updater.page.waitForTimeout(200);

check('sin version nueva no molesta con avisos', (await updater.page.locator('.update-banner').count()) === 0);

// El servidor responde con OTRO build: exactamente lo que pasa tras desplegar.
await updater.page.route('**/api/health', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, day: health.day, buildId: 'build-nuevo-de-mentira' }),
  }),
);
await updater.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await updater.page.waitForSelector('.update-banner', { timeout: 8000 }).catch(() => {});
check('al desplegar una build nueva, avisa', (await updater.page.locator('.update-banner').count()) === 1);

// Y no interrumpe: durante una partida el aviso no se ve. (Sigue en el DOM,
// debajo de la pantalla de juego; lo que importa es que no tape nada.)
await updater.page.evaluate(() => {
  const spec = window.__PZ.app.plan.challenges[0];
  window.__PZ.app.startChallenge(spec, { quick: true });
});
await updater.page.waitForTimeout(1200);

// "Tapado" no es lo mismo que "no existe": el banner sigue en el DOM, debajo
// de la pantalla de juego. Lo que hay que comprobar es que en su sitio el
// usuario toca el juego, no el aviso — o sea, que no puede pulsarlo sin querer.
const tapado = await updater.page.evaluate(() => {
  const banner = document.querySelector('.update-banner');
  if (!banner) return { existe: false };
  const box = banner.getBoundingClientRect();
  const encima = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return { existe: true, tapadoPor: encima?.closest('.play') ? 'la pantalla de juego' : (encima?.className ?? '?') };
});
check(
  'el aviso queda tapado por el juego, no se puede pulsar sin querer',
  tapado.existe && tapado.tapadoPor === 'la pantalla de juego',
  tapado.tapadoPor,
);

await updater.page.evaluate(() => window.__PZ.app.exitToHome());
await updater.page.waitForTimeout(300);
const destapado = await updater.page.evaluate(() => {
  const banner = document.querySelector('.update-banner');
  if (!banner) return false;
  const box = banner.getBoundingClientRect();
  return banner.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
});
check('y al salir a la portada vuelve a ser pulsable', destapado === true);

const reloadCalled = await updater.page.evaluate(async () => {
  let called = false;
  window.__PZ.app.applyUpdate = () => {
    called = true;
  };
  window.__PZ.app.renderHome();
  document.querySelector('.update-banner__btn').click();
  return called;
});
check('pulsar ACTUALIZAR recarga la app', reloadCalled === true);
await updater.context.close();

/* ------------------------------------------------------------------ */
section('4. LOS ERRORES QUEDAN REGISTRADOS');
/* ------------------------------------------------------------------ */

const crasher = await openPhone('errores');
await crasher.page.goto(BASE, { waitUntil: 'networkidle' });
const marca = `alfa-${Date.now().toString(36)}`;
await crasher.page.evaluate((tag) => {
  setTimeout(() => {
    throw new Error(tag);
  }, 5);
}, marca);
await crasher.page.waitForTimeout(800);
// Dentro de un setTimeout y sin devolver la promesa: si se devolviera, el
// rechazo viajaria hasta este proceso en vez de quedarse en la pagina.
await crasher.page.evaluate((tag) => {
  setTimeout(() => {
    void Promise.reject(new Error(`${tag}-promesa`));
  }, 5);
}, marca);
await crasher.page.waitForTimeout(800);
await crasher.context.close();

// Se comprueban desde el dashboard, que es donde se van a mirar de verdad.
const dueno = await fetch(`${BASE}/api/groups`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Auditor' }),
}).then((r) => r.json());
const duenoToken = `${dueno.player.id}.${dueno.player.secret}`;
const panel = await fetch(`${BASE}/api/dashboard`, {
  headers: { Authorization: `Bearer ${duenoToken}` },
}).then((r) => r.json());

const mensajes = panel.errors.recent.map((row) => row.message);
check('un error de navegador llega al servidor', mensajes.includes(marca));
check('y una promesa rechazada tambien', mensajes.includes(`${marca}-promesa`));
check('los errores se cuentan por ventana de tiempo', panel.errors.last24h >= 2, `${panel.errors.last24h} en 24 h`);

/* ------------------------------------------------------------------ */
section('5. DASHBOARD: DATOS REALES, CERO ESCRITURA');
/* ------------------------------------------------------------------ */

const sinToken = await fetch(`${BASE}/api/dashboard`);
check('sin credencial no se ven los datos', sinToken.status === 401, `HTTP ${sinToken.status}`);

check('trae las metricas de retencion', typeof panel.metrics.retention.d1.eligible === 'number');
check('trae el Revenge Rate', 'rate' in panel.metrics.revenge);
check('trae el Organic Reopen Rate', 'organicReopenRate' in panel.metrics.organicReopen);
check('trae intentos y reto diario', 'exhaustedRate' in panel.metrics.attempts && 'completionRate' in panel.metrics.dailyCompletion);

const mirador = await openPhone('dashboard');
await mirador.page.addInitScript((account) => {
  localStorage.setItem(
    'playzone.rush.save',
    JSON.stringify({
      version: 3,
      profile: { name: 'Auditor' },
      account,
      prefs: { muted: true, haptics: false },
      days: {},
      records: { bestByGame: {}, bestDailyTotal: 0, bestChaos: 0 },
      debug: { dayOffset: 0 },
      outbox: [],
      snapshot: null,
      social: { lastTotals: {}, seenOvertakes: [] },
      telemetry: { events: [], counters: {}, sent: 0 },
    }),
  );
}, { mode: 'group', playerId: dueno.player.id, secret: dueno.player.secret, groupCode: dueno.group.code, joinedAt: Date.now() });

await mirador.page.goto(`${BASE}/?dashboard`);
await mirador.page.waitForSelector('.dash', { timeout: 10000 });
check('la pantalla se abre con ?dashboard', (await mirador.page.locator('.dash').count()) === 1);
check(
  'no tiene ni un boton, input ni selector',
  (await mirador.page.locator('.dash button, .dash input, .dash select, .dash textarea').count()) === 0,
);
check('se anuncia como solo lectura', (await mirador.page.locator('.dash__readonly').textContent()) === 'SOLO LECTURA');
check(
  'no carga el panel de debug (que si puede tocar cosas)',
  (await mirador.page.locator('.debug').count()) === 0,
);
await mirador.context.close();

/* ------------------------------------------------------------------ */
section('6. DOS REDES MUY DISTINTAS (EMULADAS)');
/* ------------------------------------------------------------------ */

console.log('   ! Emulacion, no dos redes fisicas: eso se prueba con dos iPhones (docs/DESPLIEGUE.md).');

// Fibra de casa contra 3G de la calle: latencias de un orden de magnitud.
const rapido = await openPhone('wifi', { latency: 20, download: 8_000_000, upload: 2_000_000 });
const lento = await openPhone('3g', { latency: 400, download: 400_000, upload: 200_000 });

await rapido.page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
await rapido.page.waitForFunction(() => Boolean(window.__PZ?.app));
await rapido.page.evaluate(() => window.__PZ.app.createGroup('Rapido'));
await rapido.page.waitForFunction(() => window.__PZ.app.snapshot?.group?.code, { timeout: 20000 });
const codigo = (await state(rapido.page)).code;
check('el movil rapido crea grupo', Boolean(codigo), `codigo ${codigo}`);

await lento.page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
await lento.page.waitForFunction(() => Boolean(window.__PZ?.app));
await lento.page.evaluate((code) => window.__PZ.app.joinGroup(code, 'Lento'), codigo);
await lento.page.waitForFunction(() => window.__PZ.app.snapshot?.members?.length === 2, { timeout: 30000 });
check('el movil lento (3G, 400 ms) entra al mismo grupo', (await state(lento.page)).mode === 'group');

const puntosRapido = await playChallenge(rapido.page, 0);
check('el rapido juega y puntua', puntosRapido > 0, `${puntosRapido} puntos`);

// Lo importante: al lento le llega solo, sin recargar ni tocar nada.
await lento.page
  .waitForFunction(
    (nombre) => window.__PZ.app.leaderboard().standings.some((s) => s.name === nombre && s.total > 0),
    'Rapido',
    { timeout: 30000 },
  )
  .catch(() => {});
const vistoPorLento = (await state(lento.page)).standings.find((s) => s.name === 'Rapido');
check(
  'la marca cruza a la otra red sola',
  Boolean(vistoPorLento && vistoPorLento.total > 0),
  `el lento ve ${vistoPorLento?.total ?? 0} puntos del rapido`,
);

const puntosLento = await playChallenge(lento.page, 0);
check('el lento tambien juega y puntua', puntosLento > 0, `${puntosLento} puntos`);

await rapido.page
  .waitForFunction((nombre) => window.__PZ.app.leaderboard().standings.some((s) => s.name === nombre && s.total > 0), 'Lento', {
    timeout: 30000,
  })
  .catch(() => {});
const vistoPorRapido = (await state(rapido.page)).standings.find((s) => s.name === 'Lento');
check(
  'y la vuelta tambien: la red lenta no se queda descolgada',
  Boolean(vistoPorRapido && vistoPorRapido.total > 0),
  `el rapido ve ${vistoPorRapido?.total ?? 0} puntos del lento`,
);

// El lento se queda sin red a mitad: nada se pierde.
await lento.page.route('**/api/**', (route) => route.abort());
const antesDeCaer = (await state(lento.page)).myTotal;
await playChallenge(lento.page, 1);
const enCola = (await state(lento.page)).pending;
check('sin red, la partida se guarda en la cola', enCola > 0, `${enCola} pendiente(s)`);
await lento.page.unroute('**/api/**');
await lento.page.evaluate(() => window.dispatchEvent(new Event('online')));
await lento.page.waitForFunction(() => window.__PZ.app.sync.pendingCount === 0, { timeout: 40000 }).catch(() => {});
const despues = await state(lento.page);
check('y al volver la red se sube sola', despues.pending === 0 && despues.myTotal >= antesDeCaer, `cola ${despues.pending}`);

await rapido.context.close();
await lento.context.close();

/* ------------------------------------------------------------------ */

// Los de la seccion 4 son a proposito: se lanzaron para ver si se registran.
const inesperados = errors.filter((message) => !message.includes(marca));
check('ningun error de JavaScript inesperado en toda la prueba', inesperados.length === 0, inesperados.slice(0, 3).join(' | '));

console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n' + fail.map((f) => ` - ${f}`).join('\n'));
console.log('\nRecordatorio: la prueba con dos redes FISICAS (wifi vs datos moviles,');
console.log('en dos iPhones) sigue pendiente y esta en docs/DESPLIEGUE.md, paso 5.');

await browser.close();
process.exit(fail.length ? 1 : 0);
