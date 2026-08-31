/**
 * DOBLE O NADA en un navegador de verdad.
 *
 * Recorre la decision entera: ver la oferta, ver los numeros, pulsar ME LA
 * JUEGO, clavar el microdesafio mirando la aguja, y comprobar que la marca
 * cambia, que la ficha se consume y que el ranking lo ensena.
 *
 * La comprobacion mas importante es la ultima: que apostar CIERRE el reto.
 * Sin eso, con intentos de sobra bastaria volver a jugar para borrar una
 * apuesta perdida (commitResult guarda el mejor intento), y apostar seria
 * gratis. Se descubrio mirando una captura con dos intentos restantes.
 *
 *   npm run dev   (en otra terminal)
 *   node tools/apuesta.mjs
 */
import { launchBrowser } from './browser.mjs';
import { playCurrent } from './bot.mjs';
import { mkdir } from 'node:fs/promises';
const OUT = new URL('../shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const browser = await launchBrowser();
const ok = [], fail = [];
const check = (n, c, d='') => { (c?ok:fail).push(n); console.log(`${c?'  OK  ':' FALLO'} ${n}${d?' — '+d:''}`); };

const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/?debug', { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__PZ?.app));
await page.evaluate(() => { if (window.__PZ.app.mode === 'none') window.__PZ.app.playSolo(); });
await page.waitForTimeout(300);

console.log('\n── DOBLE O NADA ────────────────────────────────────────');
check('empieza con la ficha del dia', await page.evaluate(() => window.__PZ.app.tieneFicha));

// Jugar el primer reto.
await page.evaluate(() => {
  const spec = window.__PZ.app.plan.challenges[0];
  window.__PZ.app.startChallenge(spec, { quick: true });
});
await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 }).catch(()=>{});
await playCurrent(page, 40000, 0.9);
await page.waitForSelector('.result', { timeout: 20000 });
await page.waitForTimeout(500);

const puntos = await page.evaluate(() => window.__PZ.app.me().total);
check('se ofrece la apuesta al terminar', await page.locator('.apuesta').count() > 0, `${puntos} pts`);
const gana = await page.locator('.apuesta__cuenta--gana .apuesta__cuenta-valor').textContent();
const pierde = await page.locator('.apuesta__cuenta--pierde .apuesta__cuenta-valor').textContent();
check('se ven los numeros de lo que se juega', Boolean(gana && pierde), `x2=${gana}  x0.5=${pierde}`);
await page.screenshot({ path: 'shots/apuesta-decision.png' });

// ME LA JUEGO
await page.locator('.apuesta__jugar').click();
await page.waitForSelector('.reto', { timeout: 4000 });
check('se abre el microdesafio', true);
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/apuesta-reto.png' });

// Clavarlo: esperar a que la aguja este dentro de la zona.
let clavado = false;
for (let i = 0; i < 400; i++) {
  const dentro = await page.evaluate(() => Boolean(document.querySelector('.reto__aguja--dentro')));
  if (dentro) { await page.locator('.reto').click({ position: { x: 190, y: 400 } }); clavado = true; break; }
  await page.waitForTimeout(12);
}
check('se puede clavar mirando la aguja (habilidad, no azar)', clavado);
await page.waitForTimeout(1400);

const gastada = await page.evaluate(() => !window.__PZ.app.tieneFicha);
check('la ficha queda consumida', gastada);
const desenlace = await page.locator('.apuesta__desenlace-titulo').textContent().catch(() => null);
check('se ve el desenlace', Boolean(desenlace), desenlace ?? 'sin desenlace');
await page.screenshot({ path: 'shots/apuesta-desenlace.png' });

const nuevos = await page.evaluate(() => window.__PZ.app.me().total);
check('la marca cambia tras apostar', nuevos !== puntos, `${puntos} -> ${nuevos}`);

// Volver a portada: la etiqueta tiene que verse en el ranking.
await page.evaluate(() => window.__PZ.app.exitToHome());
await page.waitForTimeout(400);
const etiqueta = await page.locator('.tag--doblo, .tag--cayo').count();
check('el ranking marca a quien se la jugo', etiqueta > 0);
await page.screenshot({ path: 'shots/apuesta-ranking.png' });

// Y ya no se puede volver a apostar hoy.
await page.evaluate(() => {
  const spec = window.__PZ.app.plan.challenges[1];
  window.__PZ.app.startChallenge(spec, { quick: true });
});
await page.waitForSelector('.countdown', { state: 'detached', timeout: 10000 }).catch(()=>{});
await playCurrent(page, 40000, 0.9);
await page.waitForSelector('.result', { timeout: 20000 });
await page.waitForTimeout(400);
check('no se puede apostar dos veces el mismo dia', await page.locator('.apuesta').count() === 0);

// El agujero que casi se cuela: si tras apostar quedaran intentos, volver a
// jugar borraria una apuesta perdida (commitResult guarda el mejor). Apostar
// seria gratis.
const intentosTrasApostar = await page.evaluate(() => {
  const spec = window.__PZ.app.plan.challenges[0];
  return window.__PZ.app.attemptsLeft(spec);
});
check('apostar cierra el reto: no quedan intentos para deshacerlo', intentosTrasApostar === 0, `${intentosTrasApostar} intentos`);

check('sin errores de JavaScript', errs.length === 0, errs.join(' | ') || 'ninguno');
await browser.close();
console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
process.exit(fail.length ? 1 : 0);
