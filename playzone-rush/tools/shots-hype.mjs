/**
 * Las 13 capturas del EMOTION / HYPE PASS, jugando de verdad.
 *
 * Se usa DOS VECES: una vez ANTES de tocar nada (referencia real, no de
 * memoria) y otra vez AL TERMINAR, con el mismo guion, para poder comparar
 * el mismo instante exacto del producto en las dos direcciones visuales.
 *
 *   OUT=antes  node tools/shots-hype.mjs
 *   OUT=despues node tools/shots-hype.mjs
 */
import { launchBrowser } from './browser.mjs';
import { playCurrent, salirDelResultado } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = new URL(`../shots/hype-${process.env.OUT ?? 'capturas'}/`, import.meta.url).pathname;
await (await import('node:fs/promises')).mkdir(OUT, { recursive: true });

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
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto(`${BASE}/${query}`, { waitUntil: 'networkidle' });
  return { context, page, errores };
}

const sinSorteo = (page) => page.evaluate(() => {
  const a = window.__PZ.app;
  a.save.update(() => { a.save.day(a.dayKey).revealVisto = true; });
  a.save.flush();
});

/* ================= 1. Grupo real: Eloi crea, Marc se une ================= */
const eloi = await openPhone();
await eloi.page.waitForSelector('.onboarding');
await eloi.page.getByText('CREAR GRUPO', { exact: true }).click();
await eloi.page.locator('.onboarding__input').fill('Eloi');
await eloi.page.locator('.btn--play').click();
await eloi.page.waitForSelector('.onboarding__code');
const code = (await eloi.page.locator('.onboarding__code').innerText()).trim();
await eloi.page.getByText('ENTRAR A PLAYZONE').click();
await eloi.page.waitForSelector('.card', { timeout: 15000 });

/* ================= 2. REVEAL DIARIO, a medio girar ================= */
// Cronometrado con un MutationObserver dentro de la pagina (ver la sesion que
// construyo esto): mount=0, 1a parada a los ~904ms, 2a a los ~1503ms, 3a/remate
// a los ~2164ms, empieza a salir a los ~3054ms. 1200ms cae justo entre la 1a y
// la 2a parada: una columna ya aterrizada, dos todavia girando.
const salioSorteo = await eloi.page
  .waitForSelector('.sorteo', { timeout: 6000 })
  .then(() => true)
  .catch(() => false);
if (salioSorteo) {
  await eloi.page.waitForTimeout(1200);
  await shot(eloi.page, '02-reveal-diario');
  await eloi.page.locator('.sorteo').click(); // saltar
  await eloi.page.waitForSelector('.card', { timeout: 10000 });
} else {
  console.log('  (el sorteo no aparecio a tiempo: se omite 02-reveal-diario)');
}
await sinSorteo(eloi.page);

/* ================= 3. HOME ================= */
await eloi.page.waitForTimeout(300);
await shot(eloi.page, '01-home');

/* ================= 4. GAMEPLAY (unos segundos jugando de verdad) ================= */
await eloi.page.locator('.card .btn--accent').first().click();
await eloi.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await playCurrent(eloi.page, 2200, 1);
await shot(eloi.page, '03-gameplay');
if ((await eloi.page.locator('.result').count()) === 0) {
  await eloi.page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
}
await eloi.page.waitForSelector('.result', { timeout: 15000 });
await eloi.page.waitForTimeout(600);

/* ================= 5. RESULTADO GANANDO ================= */
// Con los rivales simulados a la baja, cualquier partida decente gana.
await shot(eloi.page, '04-resultado-gana');
await salirDelResultado(eloi.page);
await eloi.page.waitForSelector('.card', { timeout: 10000 });

/* ================= 6. Marc se une y adelanta a Eloi de verdad ================= */
const marc = await openPhone();
await marc.page.waitForSelector('.onboarding');
await marc.page.getByText('UNIRME A UN GRUPO').click();
await marc.page.locator('.onboarding__input--code').fill(code);
await marc.page.locator('.onboarding__input').nth(1).fill('Marc');
await marc.page.locator('.btn--play').click();
await marc.page.waitForSelector('.card, .sorteo', { timeout: 15000 });
if ((await marc.page.locator('.sorteo').count()) > 0) await marc.page.locator('.sorteo').click();
await marc.page.waitForSelector('.card', { timeout: 10000 });

await marc.page.locator('.card .btn--accent').first().click();
await marc.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await playCurrent(marc.page, 16000, 1);
if ((await marc.page.locator('.result').count()) === 0) {
  await marc.page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
}
await marc.page.waitForSelector('.result', { timeout: 30000 });
await salirDelResultado(marc.page);

/* ================= 7. BANNER "Marc te ha quitado el #1" ================= */
await eloi.page.waitForSelector('.overtake', { timeout: 25000 });
await eloi.page.waitForTimeout(500); // que se note el rebote de entrada
await shot(eloi.page, '06-banner-superado');

/* ================= 8. RESULTADO PERDIENDO POR POCO ================= */
// Revancha con objetivo: se juega un poco flojo a proposito para quedarse cerca sin pasar.
await eloi.page.locator('.overtake .btn--play').click();
await eloi.page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await playCurrent(eloi.page, 60000, 0.55);
await eloi.page.waitForSelector('.result', { timeout: 60000 });
await eloi.page.waitForTimeout(600);
await shot(eloi.page, '05-resultado-por-poco');
await salirDelResultado(eloi.page);
await eloi.page.waitForSelector('.card', { timeout: 10000 });

/* ================= 9-10. DOBLE O NADA: dia 1 gana (Eloi) ================= */
async function jugarYApostar(page, ganar) {
  const diag = await page.evaluate(() => ({
    tieneFicha: window.__PZ.app.tieneFicha,
    challenges: window.__PZ.app.plan.challenges.map((c) => ({
      id: c.id,
      left: window.__PZ.app.attemptsLeft(c),
    })),
  }));
  console.log('  diagnostico apuesta:', JSON.stringify(diag));
  if (!diag.tieneFicha) {
    console.log('  (sin ficha del dia: se omite este DOBLE O NADA)');
    return false;
  }
  const spec = await page.evaluate(() => {
    const s = window.__PZ.app.plan.challenges.find(
      (c) => window.__PZ.app.attemptsLeft(c) > 0,
    );
    return s ? { id: s.id } : null;
  });
  if (!spec) {
    console.log('  (sin intentos en ningun reto: se omite este DOBLE O NADA)');
    return false;
  }
  await page.evaluate((s) => {
    window.__PZ.app.startChallenge(window.__PZ.app.plan.challenges.find((c) => c.id === s.id), { quick: true });
  }, spec);
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await playCurrent(page, 40000, 0.9);
  await page.waitForSelector('.result', { timeout: 30000 });
  await page.waitForTimeout(500);
  if ((await page.locator('.apuesta').count()) === 0) {
    console.log('  (no se ofrecio la apuesta tras jugar: se omite este DOBLE O NADA)');
    return false;
  }

  await shot(page, '07-doble-o-nada-decision');
  await page.locator('.apuesta__jugar').click();
  await page.waitForSelector('.reto', { timeout: 4000 });
  await page.waitForTimeout(500);
  await shot(page, '08-doble-o-nada-microdesafio');

  if (ganar) {
    let clavado = false;
    for (let i = 0; i < 400; i++) {
      const dentro = await page.evaluate(() => Boolean(document.querySelector('.reto__aguja--dentro')));
      if (dentro) { await page.locator('.reto').click({ position: { x: 190, y: 400 } }); clavado = true; break; }
      await page.waitForTimeout(12);
    }
    if (!clavado) return false;
  } else {
    // No tocar: se agotan los 5 s y cuenta como fallo, a proposito. Se espera
    // pasado el ultimo tramo "apura" (los ultimos 1.5 s) para que se vea en
    // la propia captura del microdesafio si se toma antes.
    await page.waitForTimeout(5300);
  }
  // terminar() en apuesta.ts espera 900ms desde el acierto/fallo antes de
  // quitar el .reto y pintar el desenlace (para que se vea donde paro la
  // aguja): 650ms se quedaba corto y la captura pillaba el panel a medio
  // repintar. 1200ms deja margen de sobra.
  await page.waitForTimeout(1200);
  await shot(page, ganar ? '09-doble-o-nada-x2' : '10-doble-o-nada-x05');
  await page.waitForTimeout(900);
  return true;
}

const ganoEloi = await jugarYApostar(eloi.page, true);

/* ================= 10c. SHARE MOMENT (poster real, bytes exactos) =================
 * Se captura AQUI, con el "DOBLADO" todavia en pantalla: .compartir solo
 * existe en una pantalla de resultado con un momento que merezca contarse
 * (ver meta/compartir.ts), y en cuanto se vuelve a home ya no hay nada que
 * pulsar.
 */
if (ganoEloi) {
  await eloi.page.evaluate(() => {
    window.__PZ_posterBytes = null;
    const nav = navigator;
    nav.canShare = (d) => Array.isArray(d?.files);
    nav.share = async (d) => {
      const buf = await d.files[0].arrayBuffer();
      window.__PZ_posterBytes = Array.from(new Uint8Array(buf));
      throw new DOMException('solo capturamos el fichero', 'AbortError');
    };
  });
  const botonCompartir = eloi.page.locator('.compartir');
  if ((await botonCompartir.count()) > 0) {
    await shot(eloi.page, '13b-share-pantalla');
    await botonCompartir.first().click();
    await eloi.page.waitForTimeout(1500);
    const bytes = await eloi.page.evaluate(() => window.__PZ_posterBytes);
    if (bytes) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(`${OUT}13-share-poster.jpg`, Buffer.from(bytes));
      console.log('· 13-share-poster (imagen real 1080x1350)');
    }
  } else {
    console.log('  (sin .compartir tras doblar: se omite el share moment)');
  }
}

if (ganoEloi) {
  // .salir-resultado y no .btn--play: con "SIN INTENTOS" el boton principal
  // sale deshabilitado (sigue teniendo la clase btn--play), y pulsar un
  // boton deshabilitado no hace nada -se quedaba en el resultado anterior-.
  await eloi.page.locator('.salir-resultado').first().click().catch(() => {});
  await eloi.page.waitForSelector('.card', { timeout: 10000 }).catch(() => {});
}

/* ================= 10b. DOBLE O NADA perdido, en una sesion solo aparte =================
 * "Una sola por dia": para ensenar el fallo (x0,5) sin pelearse con el reloj
 * de un dia de grupo (el dia ahi lo manda el servidor a proposito, ver
 * App.shiftDay), lo mas simple y lo mas fiel es una partida solo nueva y de
 * verdad, no forzar un segundo dia en la sesion de Eloi.
 */
const solo = await openPhone('?debug');
await solo.page.waitForSelector('.onboarding');
await solo.page.locator('.onboarding__solo').click();
await solo.page.waitForSelector('.card', { timeout: 10000 });
await sinSorteo(solo.page);
await solo.page.evaluate(() => window.__PZ.app.renderHome());
await solo.page.waitForTimeout(300);
const perdio = await jugarYApostar(solo.page, false);
if (!perdio) console.log('  (no se pudo capturar el fallo x0,5: revisar el guion)');
console.log('Errores de pagina (solo/x0,5):', solo.errores.join(' | ') || 'ninguno');
await solo.context.close();

/* ================= 13. RETO SECRETO ================= */
await eloi.page.evaluate(() => {
  const a = window.__PZ.app;
  a.save.update((d) => { d.days[a.dayKey].secretUnlocked = true; });
  a.refresh();
});
await eloi.page.waitForTimeout(400);
await eloi.page.locator('.scroller').evaluate((n) => n.scrollTo({ top: n.scrollHeight * 0.5 })).catch(() => {});
await eloi.page.waitForTimeout(300);
await shot(eloi.page, '11-reto-secreto');

/* ================= 14. CHAOS ================= */
await eloi.page.evaluate(() => {
  const a = window.__PZ.app;
  a.save.update((d) => { d.days[a.dayKey].chaosEnabled = true; });
  a.refresh();
});
await eloi.page.waitForTimeout(400);
// CHAOS es la ULTIMA tarjeta (retos -> secreto -> chaos): al fondo, no arriba.
await eloi.page.locator('.card--chaos').scrollIntoViewIfNeeded().catch(() => {});
await eloi.page.waitForTimeout(1200); // que se note el respira-acento (mas rapido en CHAOS)
await shot(eloi.page, '12-chaos');

console.log(`\nCapturas en ${OUT}`);
console.log('Errores de pagina (Eloi):', eloi.errores.join(' | ') || 'ninguno');
console.log('Errores de pagina (Marc):', marc.errores.join(' | ') || 'ninguno');
await browser.close();
