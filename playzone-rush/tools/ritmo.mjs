/**
 * RITMO en un navegador de verdad.
 *
 * Lo que se comprueba aqui no se puede comprobar con un test de unidad: que la
 * musica arranque, que las notas nazcan del compas, y sobre todo que el juicio
 * contra el reloj de audio distinga de verdad entre clavar el compas y tocar a
 * destiempo. Un bot toca en el instante exacto y otro toca fuera; si el juego
 * esta bien, el primero saca mucha mas puntuacion que el segundo.
 *
 *   npm run dev   (en otra terminal)
 *   node tools/ritmo.mjs
 */
import { launchBrowser } from './browser.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';

const ok = [];
const fail = [];
const check = (name, condition, detail = '') => {
  (condition ? ok : fail).push(name);
  console.log(`${condition ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await launchBrowser();

async function abrir() {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-ES',
  });
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(`${BASE}/?debug`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__PZ?.app));
  await page.evaluate(() => {
    if (window.__PZ.app.mode === 'none') window.__PZ.app.playSolo();
  });
  // El audio necesita un gesto del usuario: iOS y Chrome lo exigen igual.
  await page.mouse.click(196, 400);
  await page.waitForTimeout(150);
  return { page, context, errores };
}

/**
 * Juega una partida. `desfase` en segundos: 0 = clavar el compas,
 * 0.14 = tocar sistematicamente tarde (fuera de la ventana de acierto).
 */
async function jugar(page, desfase) {
  await page.evaluate(() => window.__PZ.app.startDebugRun('ritmo'));
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10_000 }).catch(() => {});

  const t0 = Date.now();
  while (Date.now() - t0 < 20_000) {
    const s = await page.evaluate(() => window.__PZ.state());
    if (!s || !s.notas) break;
    if (await page.evaluate(() => Boolean(document.querySelector('.result')))) break;

    const siguiente = s.notas[0];
    if (siguiente) {
      const esperar = (siguiente.tiempo + desfase - s.relojAudio) * 1000;
      if (esperar > 0 && esperar < 1600) {
        await page.waitForTimeout(esperar);
        await page.mouse.click(siguiente.x, s.lineaY);
        continue;
      }
    }
    await page.waitForTimeout(20);
  }

  await page.waitForSelector('.result', { timeout: 15_000 }).catch(() => {});
  return page.evaluate(() => {
    const juego = window.__PZ.game();
    return { score: juego?.score ?? 0, info: juego?.debugInfo?.() ?? null };
  });
}

/* ------------------------------------------------------------------ */
console.log('\n── RITMO: compas, juicio y musica ──────────────────────');

const preciso = await abrir();
await preciso.page.evaluate(() => window.__PZ.app.startDebugRun('ritmo'));
await preciso.page.waitForTimeout(1200);

const arranque = await preciso.page.evaluate(() => window.__PZ.state());
check('la musica arranca con la partida', arranque?.compasSonando === true);
check('el reloj de audio avanza', (arranque?.relojAudio ?? -1) > 0, `t=${arranque?.relojAudio}`);
await preciso.page.waitForTimeout(1500);
const conNotas = await preciso.page.evaluate(() => window.__PZ.state());
check('nacen notas del compas', (conNotas?.notasVivas ?? 0) > 0, `${conNotas?.notasVivas} en pantalla`);
check(
  'las notas se reparten en dos carriles',
  new Set((conNotas?.notas ?? []).map((n) => n.carril)).size >= 1,
);
await preciso.page.evaluate(() => window.__PZ.app.exitToHome());
await preciso.page.waitForTimeout(300);

// Clavando el compas.
const bueno = await jugar(preciso.page, 0);
check('tocando al compas se puntua', bueno.score > 0, `${bueno.score} pts`);
check('y salen PERFECTOS', (bueno.info?.perfectos ?? 0) > 0, `${bueno.info?.perfectos} perfectos`);
await preciso.context.close();

// A destiempo, con el mismo juego y la misma semilla.
const tarde = await abrir();
const malo = await jugar(tarde.page, 0.14);
check(
  'tocar a destiempo puntua mucho menos',
  malo.score < bueno.score * 0.6,
  `${malo.score} pts frente a ${bueno.score}`,
);
check(
  'y casi no saca perfectos',
  (malo.info?.perfectos ?? 0) < Math.max(1, (bueno.info?.perfectos ?? 0) * 0.4),
  `${malo.info?.perfectos} frente a ${bueno.info?.perfectos}`,
);
check('sin errores de JavaScript', preciso.errores.length === 0 && tarde.errores.length === 0,
  [...preciso.errores, ...tarde.errores].join(' | ') || 'ninguno');
await tarde.context.close();

await browser.close();
console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length > 0) {
  console.log('\nFallan:');
  for (const f of fail) console.log(`  · ${f}`);
}
process.exit(fail.length > 0 ? 1 : 0);
