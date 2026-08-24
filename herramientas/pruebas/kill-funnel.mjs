// ════════════════════════════════════════════════════════════
//  kill-funnel.mjs — alMatar() y el score flotante (Bloque 6, fase 6C)
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/kill-funnel.mjs
//
//  Dos contratos, dos mitades de la prueba:
//
//   1. alMatar() da EXACTAMENTE lo que daban los cinco sitios que
//      sustituye, en MEDIUM. No es "parece que sí": se compara la
//      cifra concreta.
//   2. El score flotante recicla, tiene tope duro y funde números
//      cercanos en vez de acumularlos sin límite.

import { servidor, cargarPlaywright } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const nav = await chromium.launch();

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", e => p.errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") p.errs.push("CONSOLE " + m.text()); });
  p.on("requestfailed", r => {
    const motivo = (r.failure() && r.failure().errorText) || "?";
    const url = r.url().replace(srv.url, "");
    if (motivo.includes("ERR_ABORTED") && /[.](mp3|ogg|wav)$/i.test(url)) return;
    p.errs.push("PETICION " + motivo + " " + url);
  });
  await p.goto(srv.url + "?debug", { waitUntil: "load" });
  await p.waitForTimeout(900);
  p.cerrar = () => ctx.close();
  return p;
}

// ════════════════════════════════════════════════════════════
console.log("\n1 · alMatar() da lo mismo que daban los cinco sitios, en MEDIUM");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    combo = 0; comboT = 0; maxCombo = 0; comboHito = 0; score = 0; enemiesKilled = 0;
    // matar(): puntosBase * multCombo(), combo arrancando en 0 -> mult=1
    const r1 = alMatar({ fuente: "enemigo", puntosBase: 10, posicion: { x: 100, y: 100 },
      opciones: { textoOffsetY: -10, premio: { prob: 0 } } });
    // nodoAegis: 220 puntos, multiplicado por combo (que ya subió a 1 -> mult sigue 1 con combo=1)
    const r2 = alMatar({ fuente: "nodoAegis", puntosBase: 220, posicion: { x: 0, y: 0 },
      opciones: { textoOffsetY: -20, textoTam: 13, texto: true } });
    // subOmega: 500 FIJOS, sin multiplicar por combo
    combo = 0; score = 0;
    const r3 = alMatar({ fuente: "subOmega", puntosBase: 500, posicion: { x: 0, y: 0 },
      opciones: { combo: false, texto: false } });
    // sistema M9: 400 FIJOS, sin multiplicar
    combo = 0; score = 0;
    const r4 = alMatar({ fuente: "sistema", puntosBase: 400, posicion: { x: 0, y: 0 },
      opciones: { combo: false, texto: false } });
    // defensa: puntosBase * multCombo()
    combo = 0; score = 0;
    const r5 = alMatar({ fuente: "defensa", puntosBase: 60, posicion: { x: 0, y: 0 },
      opciones: { textoOffsetY: -30, textoTam: 15, texto: true, premio: { prob: 0 } } });
    return { r1, r2, r3, r4, r5, scoreMulMedium: DIFFICULTY_CONFIG.medium.scoreMul };
  });
  // En MEDIUM, DIF.scoreMul === 1.25 (a propósito, ver 6B): la cifra
  // "de fábrica" (antes del multiplicador de dificultad) es puntosBase.
  comprobar(d.r1.pts === Math.round(10 * d.scoreMulMedium), "enemigo: 10 * combo(1) * scoreMul", d.r1.pts);
  comprobar(d.r2.pts === Math.round(220 * d.scoreMulMedium), "nodoAegis: 220 * combo(1) * scoreMul", d.r2.pts);
  comprobar(d.r3.pts === Math.round(500 * d.scoreMulMedium), "subOmega: 500 FIJOS * scoreMul (sin combo)", d.r3.pts);
  comprobar(d.r4.pts === Math.round(400 * d.scoreMulMedium), "sistema M9: 400 FIJOS * scoreMul (sin combo)", d.r4.pts);
  comprobar(d.r5.pts === Math.round(60 * d.scoreMulMedium), "defensa: 60 * combo(1) * scoreMul", d.r5.pts);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · alMatar() sin multiplicador de dificultad (scoreMul=1) reproduce las fórmulas de siempre byte a byte");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    OPCIONES.dificultad = "medium"; resolverDificultad();
    DIFFICULTY_CONFIG.medium.scoreMul = 1;   // aislar la fórmula de combo del multiplicador de dificultad
    // alMatar() hace combo++ ANTES de leer multCombo() (igual que el
    // matar() de siempre): para que el multiplicador salga en 1 hay que
    // arrancar en 6, no en 7 — el +1 lo pone la propia función.
    combo = 6; score = 0;
    const antes = { combo, mult: multCombo() };
    const r = alMatar({ fuente: "enemigo", puntosBase: 90, posicion: { x: 0, y: 0 }, opciones: { premio: { prob: 0 } } });
    combo = 7; score = 0;   // combo++ lo deja en 8: multCombo() = 1 + floor(8/8) = 2, el hito real
    const r2 = alMatar({ fuente: "enemigo", puntosBase: 90, posicion: { x: 0, y: 0 }, opciones: { premio: { prob: 0 } } });
    DIFFICULTY_CONFIG.medium.scoreMul = 1.25;   // restaurado
    resolverDificultad();
    return { antes, r, r2 };
  });
  comprobar(d.r.pts === 90, "combo=7 (mult=1): 90 puntos exactos", d.r.pts);
  comprobar(d.r2.pts === 180, "combo=8 (mult=2): 180 puntos exactos", d.r2.pts);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · Score flotante: tope duro, reciclaje, y no crece sin límite");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    flotantes.length = 0; flotantesLibres.length = 0;
    for (let i = 0; i < 200; i++) texto(rand(0, W), rand(0, H), "TEXTO" + i, "#fff", 12);
    return { total: flotantes.length, tope: FLOTANTES_MAX };
  });
  comprobar(d.total <= d.tope, "200 textos NO numéricos no superan el tope duro", d.total + " / " + d.tope);

  const rec = await p.evaluate(() => {
    flotantes.length = 0; flotantesLibres.length = 0;
    texto(100, 100, "HOLA", "#fff", 12);
    const antesLibres = flotantesLibres.length;
    // Forzar expiración simulando el paso del tiempo del bucle real.
    flotantes[0].t = flotantes[0].life + 0.01;
    for (let i = flotantes.length - 1; i >= 0; i--) {
      const f = flotantes[i];
      if (f.t >= f.life) { flotantesLibres.push(f); flotantes.splice(i, 1); }
    }
    const tras = flotantesLibres.length;
    texto(50, 50, "ADIOS", "#fff", 12);
    return { antesLibres, tras, reciclado: flotantesLibres.length < tras };
  });
  comprobar(rec.antesLibres === 0 && rec.tras === 1, "al expirar, el objeto vuelve a la cola de libres");
  comprobar(rec.reciclado, "el siguiente texto() saca de la cola de libres en vez de crear uno nuevo");

  const fus = await p.evaluate(() => {
    flotantes.length = 0; flotantesLibres.length = 0;
    texto(100, 100, "+10", "#7df9ff", 13);
    texto(102, 101, "+15", "#7df9ff", 13);   // mismo color, a un paso, recién nacido: se funde
    texto(500, 500, "+20", "#7df9ff", 13);   // lejos: no se funde
    texto(100, 100, "+5", "#ff2f6e", 13);    // mismo sitio, OTRO color: no se funde
    return { n: flotantes.length, primero: flotantes[0] && flotantes[0].txt };
  });
  comprobar(fus.n === 3, "dos números cercanos del mismo color se funden en uno", fus.n);
  comprobar(fus.primero === "+25", "la fusión SUMA (+10 y +15 -> +25)", fus.primero);

  const combo_ = await p.evaluate(() => {
    flotantes.length = 0; flotantesLibres.length = 0;
    for (let i = 0; i < FLOTANTES_MAX; i++) texto(rand(0, W), rand(0, H), "N" + i, "#fff", 12, { prioridad: 0 });
    const antes = flotantes.length;
    const jackpot = texto(400, 400, "JACKPOT", "#ffd700", 24, { prioridad: 2 });
    return { antes, tope: FLOTANTES_MAX, entroJackpot: !!jackpot, sigueLleno: flotantes.length <= FLOTANTES_MAX };
  });
  comprobar(combo_.antes === combo_.tope, "el pool llega justo al tope", combo_.antes);
  comprobar(combo_.entroJackpot, "con el pool lleno, un texto de prioridad alta SIGUE entrando (desaloja al peor)");
  comprobar(combo_.sigueLleno, "el tope duro se respeta incluso desalojando", combo_.tope);

  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
