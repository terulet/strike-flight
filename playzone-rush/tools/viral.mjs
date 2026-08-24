/**
 * Recorridos del bloque viral, comprobados en navegador de verdad.
 *
 *   portada -> juego -> resultado -> compartir
 *   portada -> juego -> resultado -> siguiente reto
 *
 * Comprueba ademas los tres caminos de compartir (fichero, solo texto, sin
 * menu) sustituyendo navigator.share, que es la unica forma de probarlos sin
 * un telefono delante.
 *
 *   BASE=http://localhost:5173 node tools/viral.mjs
 */
import { launchBrowser } from './browser.mjs';
import { playCurrent } from './bot.mjs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const ok = [];
const fail = [];
const check = (name, cond, detalle = '') => {
  (cond ? ok : fail).push(name);
  console.log(`${cond ? '  OK  ' : ' FALLO'} ${name}${detalle ? ` — ${detalle}` : ''}`);
};

const browser = await launchBrowser();
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

await page.goto(`${BASE}/?debug`);
if ((await page.locator('.onboarding').count()) > 0) await page.locator('.onboarding__solo').click();
await page.waitForSelector('.card', { timeout: 15000 });
const sinSorteo = () => page.evaluate(() => {
  const a = window.__PZ.app;
  a.save.update(() => { a.save.day(a.dayKey).revealVisto = true; });
  a.save.flush();
});
await sinSorteo();

/* ------------------------------------------------------------------ */
console.log('\n1. PORTADA -> JUEGO: la tarjeta se convierte en el juego');
/* ------------------------------------------------------------------ */
await page.waitForTimeout(500);
// El cronometro va DENTRO de la pagina. Midiendolo desde Node, cada
// waitForSelector es un viaje por el protocolo de depuracion y suma 300-400 ms
// que no son de la animacion: la medida saldria inflada y no diria la verdad.
const crono = page.evaluate(() => new Promise((r) => {
  const t0 = performance.now();
  const marcas = {};
  const mirar = () => {
    if (!marcas.capa && document.querySelector('.morph')) marcas.capa = performance.now() - t0;
    if (!marcas.juego && document.querySelector('.pz-canvas')) marcas.juego = performance.now() - t0;
    if (!marcas.sinToques && document.querySelector('.morph')) {
      marcas.sinToques = getComputedStyle(document.querySelector('.morph')).pointerEvents === 'none';
    }
    if (marcas.capa && !document.querySelector('.morph')) {
      marcas.fin = performance.now() - t0;
      r(marcas);
      return;
    }
    requestAnimationFrame(mirar);
  };
  requestAnimationFrame(mirar);
}));
await page.locator('.card .btn--accent').first().click();
const t = await crono;
check('la capa de transicion aparece', t.capa !== undefined);
check('el juego arranca sin esperar a la animacion', t.juego < 250, `${t.juego.toFixed(0)} ms`);
check('la capa no captura toques', t.sinToques === true);
check('la transicion dura entre 350 y 600 ms', t.fin > 300 && t.fin < 650, `${t.fin.toFixed(0)} ms`);

/* ------------------------------------------------------------------ */
console.log('\n2. JUEGO -> RESULTADO: continuidad');
/* ------------------------------------------------------------------ */
await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
await page.waitForTimeout(400);
await playCurrent(page, 5000);
await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
await page.waitForSelector('.result', { timeout: 5000 });
await page.waitForTimeout(600);
check('la arena sigue detras del resultado', (await page.locator('.play--resultado .stage').count()) > 0);
check('el lienzo no se ha desmontado', (await page.locator('.pz-canvas').count()) > 0);

/* ------------------------------------------------------------------ */
console.log('\n3. RESULTADO -> SIGUIENTE RETO, sin pasar por la portada');
/* ------------------------------------------------------------------ */
const siguiente = page.getByText(/^SIGUIENTE/);
const haySiguiente = (await siguiente.count()) > 0;
check('se ofrece el siguiente reto', haySiguiente);
if (haySiguiente) {
  // La portada vive DEBAJO de la partida, que es una capa fija: .scroller
  // sigue en el DOM aunque no se vea. Lo que demuestra que se ha encadenado es
  // que la pantalla de partida NUNCA se desmonto.
  const mismaPantalla = await page.evaluate(() => {
    const antes = window.__PZ.app.playScreen;
    window.__pantallaAntes = antes;
    return Boolean(antes);
  });
  await siguiente.first().click();
  await page.waitForSelector('.result', { state: 'detached', timeout: 5000 });
  check(
    'no se remonta la pantalla: se reconfigura',
    mismaPantalla && (await page.evaluate(() => window.__PZ.app.playScreen === window.__pantallaAntes)),
  );
  check('sigue habiendo lienzo (pantalla reaprovechada)', (await page.locator('.pz-canvas').count()) > 0);
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(300);
  await playCurrent(page, 4000);
  await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await page.waitForSelector('.result', { timeout: 5000 });
  check('el segundo reto tambien termina en resultado', true);
}

/* ------------------------------------------------------------------ */
console.log('\n4. COMPARTIR: los tres caminos');
/* ------------------------------------------------------------------ */
// Se fuerza un momento compartible: adelantar a alguien de verdad.
await page.getByText('VER RANKING', { exact: true }).first().click().catch(() => {});
await page.waitForSelector('.card', { timeout: 10000 });
await sinSorteo();
/**
 * Deja a todos los rivales con un total del dia bajo pero POSITIVO.
 *
 * Ni a cero -un rival con 0 nunca estuvo por delante, asi que adelantarlo no
 * cuenta y no hay nada que compartir- ni por encima de lo que saca el bot. El
 * bono se suma por reto y el ranking es del dia entero, asi que en vez de
 * calcularlo a ojo se mide, se corrige y se vuelve a medir.
 */
const bajarRivales = (objetivo) => page.evaluate((meta) => {
  const a = window.__PZ.app;
  for (let vuelta = 0; vuelta < 25; vuelta++) {
    const fuera = a.leaderboard().standings.filter((s) => !s.isMe && Math.abs(s.total - meta) > 40);
    if (fuera.length === 0) break;
    a.save.update(() => {
      const d = a.save.day(a.dayKey);
      for (const s of fuera) {
        d.rivalBoosts[s.id] = (d.rivalBoosts[s.id] ?? 0) + Math.round((meta - s.total) / 3);
      }
    });
    a.refresh();
  }
  return a.leaderboard().standings.map((s) => `${s.name}:${s.total}`);
}, objetivo);

// Se borra lo jugado hasta aqui: en el apartado 3 se han jugado dos retos y el
// total del dia ya va por los 5.000. Para que haya adelantamiento los rivales
// tienen que estar POR DELANTE antes de jugar, y con esa ventaja acumulada no
// hay forma. Se empieza el dia de cero.
await page.evaluate(() => {
  const a = window.__PZ.app;
  a.save.update(() => {
    const d = a.save.day(a.dayKey);
    d.challenges = {};
    d.rivalBoosts = {};
    d.apuestaGastada = true;
  });
  a.save.flush();
  a.refresh();
});
console.log('  rivales bajados a:', (await bajarRivales(150)).join(' '));
await page.waitForTimeout(300);

/** Sustituye navigator.share y devuelve lo que se le ha pasado. */
const prepararShare = (modo) => page.evaluate((m) => {
  window.__share = { llamadas: [] };
  if (m === 'ninguno') {
    delete navigator.share;
    delete navigator.canShare;
    return;
  }
  navigator.canShare = (d) => m === 'fichero' && Array.isArray(d?.files);
  navigator.share = async (d) => {
    window.__share.llamadas.push({ conFichero: Array.isArray(d.files), tipo: d.files?.[0]?.type, bytes: d.files?.[0]?.size, texto: d.text });
    if (m === 'cancela') throw new DOMException('cancelado', 'AbortError');
  };
}, modo);

const jugarYCompartir = async (modo) => {
  await page.evaluate(() => {
    const a = window.__PZ.app;
    a.save.update(() => { delete a.save.day(a.dayKey).challenges[a.plan.challenges[0].id]; });
    a.startChallenge(a.plan.challenges[0], { ignoreAttempts: true });
  });
  await page.waitForSelector('.countdown', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(300);
  await playCurrent(page, 4500);
  await page.evaluate(() => window.__PZ.app.playScreen.forceFinish());
  await page.waitForSelector('.result', { timeout: 5000 });
  await page.waitForTimeout(500);
  await prepararShare(modo);
  const boton = page.locator('.compartir');
  if ((await boton.count()) === 0) return null;
  await boton.first().click();
  await page.waitForTimeout(1800);
  return page.evaluate(() => window.__share?.llamadas ?? []);
};

const conFichero = await jugarYCompartir('fichero');
check('se ofrece compartir tras un adelantamiento', conFichero !== null);
if (conFichero) {
  const l = conFichero[0];
  check('se manda la imagen por el menu del sistema', Boolean(l?.conFichero), l ? `${l.tipo} ${(l.bytes / 1024).toFixed(0)} kB` : '');
  check('la imagen es JPEG', l?.tipo === 'image/jpeg');
  check('la imagen pesa menos de 400 kB', (l?.bytes ?? 0) > 10_000 && (l?.bytes ?? 0) < 400_000, `${((l?.bytes ?? 0) / 1024).toFixed(0)} kB`);
  check('el texto acompana a la imagen', Boolean(l?.texto));

  // Telemetria por juego (panel POR JUEGO del dashboard): sin esto el
  // servidor no puede saber que ESTE juego produjo un compartir de verdad.
  const telemetria = await page.evaluate(() => {
    const a = window.__PZ.app;
    return { eventos: a.telemetry.events(), gameId: a.plan.challenges[0].gameId };
  });
  const atento = telemetria.eventos.filter((e) => e.type === 'share_attempted');
  const hecho = telemetria.eventos.filter((e) => e.type === 'share_completed');
  check('compartir de verdad deja share_attempted', atento.length === 1);
  check('share_attempted lleva el gameId del reto jugado', atento[0]?.gameId === telemetria.gameId, atento[0]?.gameId);
  check('compartir de verdad deja TAMBIEN share_completed', hecho.length === 1);
  check('share_completed dice como ha ido', hecho[0]?.meta?.resultado === 'imagen', JSON.stringify(hecho[0]?.meta));
}
await page.getByText('VER RANKING', { exact: true }).first().click().catch(() => {});
await page.waitForSelector('.card', { timeout: 10000 });

const soloTexto = await jugarYCompartir('solo-texto');
if (soloTexto) {
  check('sin poder mandar ficheros, se manda solo el texto', soloTexto.length === 1 && !soloTexto[0].conFichero);
}
await page.getByText('VER RANKING', { exact: true }).first().click().catch(() => {});
await page.waitForSelector('.card', { timeout: 10000 });

// Sin menu del sistema: se guarda la imagen y se copia el texto, DICIENDOLO.
// Una descarga silenciosa parece que no ha hecho nada.
const sinMenu = await jugarYCompartir('ninguno');
if (sinMenu) {
  await page.waitForTimeout(400);
  const aviso = await page.locator('.toast').first().textContent().catch(() => '');
  check('sin menu del sistema se avisa de lo que ha pasado', /GUARDADA|COPIADO/.test(aviso ?? ''), aviso ?? '(ninguno)');
}
await page.locator('.salir-resultado').first().click().catch(() => {});
await page.waitForSelector('.card', { timeout: 10000 });

const cancelado = await jugarYCompartir('cancela');
if (cancelado) {
  // Cancelar es una decision, no un fallo: no debe copiar nada por detras.
  const avisos = await page.locator('.toast').count();
  check('cancelar el menu no dispara nada por detras', avisos === 0);

  // Pero SI queda intencion de compartir: cancelar el menu del sistema no es
  // "no quiso compartir", es "quiso, y el menu no siguio". share_completed en
  // cambio no debe aparecer: no ha salido nada de verdad.
  const eventos = await page.evaluate(() => window.__PZ.app.telemetry.events());
  const atentosTotal = eventos.filter((e) => e.type === 'share_attempted').length;
  const hechoTotal = eventos.filter((e) => e.type === 'share_completed').length;
  // Antes de este paso ya hubo TRES compartidos de exito: fichero, solo
  // texto, y sin menu del sistema (descarga+copia, que tambien cuenta como
  // exito). Este cuarto intento es el que cancela.
  check('cancelar deja share_attempted igualmente', atentosTotal === 4, `${atentosTotal} (fichero+texto+descarga+cancela)`);
  check('cancelar NO deja share_completed', hechoTotal === 3, `${hechoTotal} (fichero+texto+descarga)`);
}

console.log(`\nRESULTADO: ${ok.length} OK · ${fail.length} fallos`);
if (fail.length) console.log('FALLOS:\n  ' + fail.join('\n  '));
console.log(errores.length ? `\nERRORES DE PAGINA:\n  ${errores.join('\n  ')}` : '\nSin errores de pagina.');
await browser.close();
process.exit(fail.length ? 1 : 0);
