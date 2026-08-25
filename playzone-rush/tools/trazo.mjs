/**
 * TRAZO en un navegador de verdad.
 *
 * Un bot recorre la figura con el raton pegado a la linea y otro va dando
 * bandazos entre punto y punto. Los dos completan las figuras; la diferencia
 * tiene que estar en la PRECISION, que es lo que este juego premia. Si el
 * torpe puntuara igual, el juego no estaria midiendo nada.
 *
 *   npm run dev   (en otra terminal)
 *   node tools/trazo.mjs
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
  return { page, context, errores };
}

/**
 * Traza las figuras que vayan saliendo. `bandazo` en pixeles: 0 = pulso
 * perfecto, alto = llega a los puntos pero por fuera de la linea.
 */
async function jugar(page, bandazo) {
  await page.evaluate(() => window.__PZ.app.startDebugRun('trazo'));
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 10_000 }).catch(() => {});

  const t0 = Date.now();
  let figurasVistas = 0;
  while (Date.now() - t0 < 25_000) {
    if (await page.evaluate(() => Boolean(document.querySelector('.result')))) break;
    const s = await page.evaluate(() => window.__PZ.state());
    if (!s?.puntos?.length) break;
    figurasVistas++;

    const puntos = s.puntos;
    await page.mouse.move(puntos[0].x, puntos[0].y);
    await page.mouse.down();
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1];
      const b = puntos[i];
      // Se interpola el tramo: arrastrar de golpe se saltaria la medida de
      // precision, que se toma frame a frame mientras el dedo esta abajo.
      const pasos = 7;
      for (let k = 1; k <= pasos; k++) {
        const t = k / pasos;
        // El desvio es perpendicular al tramo, y maximo en mitad del camino.
        const nx = -(b.y - a.y);
        const ny = b.x - a.x;
        const largo = Math.hypot(nx, ny) || 1;
        const curva = Math.sin(t * Math.PI) * bandazo;
        await page.mouse.move(
          a.x + (b.x - a.x) * t + (nx / largo) * curva,
          a.y + (b.y - a.y) * t + (ny / largo) * curva,
        );
        await page.waitForTimeout(12);
      }
    }
    await page.mouse.up();
    await page.waitForTimeout(120);
  }

  await page.waitForSelector('.result', { timeout: 15_000 }).catch(() => {});
  const datos = await page.evaluate(() => {
    const juego = window.__PZ.game();
    return { score: juego?.score ?? 0, info: juego?.debugInfo?.() ?? null, resultado: juego?.getResult?.() ?? null };
  });
  return { ...datos, figurasVistas };
}

/* ------------------------------------------------------------------ */
console.log('\n── TRAZO: figuras, pulso y precision ───────────────────');

const bueno = await abrir();
const limpio = await jugar(bueno.page, 0);
check('el bot completa figuras', (limpio.info?.figurasHechas ?? 0) > 0, `${limpio.info?.figurasHechas} figuras`);
check('y puntua', limpio.score > 0, `${limpio.score} pts`);
check(
  'la figura tiene nombre reconocible',
  typeof limpio.info?.figura === 'string' && limpio.info.figura.length > 2,
  limpio.info?.figura ?? 'sin nombre',
);
check(
  'se registra precision en el resultado',
  typeof limpio.resultado?.accuracy === 'number',
  `${Math.round((limpio.resultado?.accuracy ?? 0) * 100)}%`,
);
await bueno.context.close();

const torpe = await abrir();
const sucio = await jugar(torpe.page, 26);
check(
  'con mal pulso tambien se completan figuras',
  (sucio.info?.figurasHechas ?? 0) > 0,
  `${sucio.info?.figurasHechas} figuras`,
);
check(
  'pero se puntua menos que con buen pulso',
  sucio.score < limpio.score,
  `${sucio.score} pts frente a ${limpio.score}`,
);
check(
  'y la precision registrada es peor',
  (sucio.resultado?.accuracy ?? 1) < (limpio.resultado?.accuracy ?? 0),
  `${Math.round((sucio.resultado?.accuracy ?? 0) * 100)}% frente a ${Math.round((limpio.resultado?.accuracy ?? 0) * 100)}%`,
);
check(
  'sin errores de JavaScript',
  bueno.errores.length === 0 && torpe.errores.length === 0,
  [...bueno.errores, ...torpe.errores].join(' | ') || 'ninguno',
);
await torpe.context.close();

await browser.close();
console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length > 0) {
  console.log('\nFallan:');
  for (const f of fail) console.log(`  · ${f}`);
}
process.exit(fail.length > 0 ? 1 : 0);
