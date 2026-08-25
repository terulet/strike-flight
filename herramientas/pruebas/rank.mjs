// ════════════════════════════════════════════════════════════
//  rank.mjs — Bloque 6, fase 6I
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/rank.mjs

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

// Estado base "impecable" para partir de una situación conocida.
const base = `
  modo = "supervivencia"; state = "play"; paused = false;
  elapsed = 120; score = 0; maxCombo = 0; vidasPerdidas = 0;
  elitesMuertos = 0; sinDanioBoss = true;
  skillEventos = { cierre: 0, ola_perfecta: 0, cadena: 0, fulminante: 0, sin_golpe: 0 };
  OPCIONES.dificultad = "medium"; resolverDificultad();
`;

// ════════════════════════════════════════════════════════════
console.log("\n1 · No es solo score: dos partidas con el MISMO score pueden sacar rank distinto");
{
  const p = await abrir();
  const d = await p.evaluate((base) => {
    eval(base);
    score = 3000;
    const pobre = calcularRank();   // sin combo, sin limpieza, sin skills

    eval(base);
    score = 3000;
    maxCombo = 60; vidasPerdidas = 0; elitesMuertos = 4;
    skillEventos = { cierre: 2, ola_perfecta: 1, cadena: 1, fulminante: 1, sin_golpe: 1 };
    const rico = calcularRank();

    return { pobre, rico };
  }, base);
  comprobar(d.rico.puntos > d.pobre.puntos, "mismo score, más combo/skills/élites/limpieza da más puntos",
    d.pobre.puntos + " vs " + d.rico.puntos);
  comprobar(d.rico.numero > d.pobre.numero, "y eso puede subir de letra", d.pobre.letra + " vs " + d.rico.letra);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · Cada factor mueve el rank en la dirección correcta");
{
  const p = await abrir();
  const d = await p.evaluate((base) => {
    eval(base); score = 5000; maxCombo = 30; elitesMuertos = 2;
    skillEventos.cierre = 1;
    const referencia = calcularRank();

    eval(base); score = 5000; maxCombo = 30; elitesMuertos = 2; skillEventos.cierre = 1;
    vidasPerdidas = 3;   // se ha comido todo el daño posible
    const conDanio = calcularRank();

    eval(base); score = 5000; maxCombo = 30; elitesMuertos = 2; skillEventos.cierre = 1;
    sinDanioBoss = false;
    const sinBossLimpio = calcularRank();

    eval(base); score = 5000; maxCombo = 30; elitesMuertos = 2; skillEventos.cierre = 1;
    OPCIONES.dificultad = "high"; resolverDificultad();
    const difícil = calcularRank();

    eval(base); score = 5000; maxCombo = 30; elitesMuertos = 2; skillEventos.cierre = 1;
    OPCIONES.dificultad = "easy"; resolverDificultad();
    const fácil = calcularRank();

    return { referencia, conDanio, sinBossLimpio, difícil, fácil };
  }, base);
  comprobar(d.conDanio.puntos < d.referencia.puntos, "perder vidas baja los puntos", d.conDanio.puntos + " < " + d.referencia.puntos);
  comprobar(d.sinBossLimpio.puntos < d.referencia.puntos, "recibir un golpe del jefe baja los puntos");
  comprobar(d.difícil.puntos > d.referencia.puntos, "DIFÍCIL da más puntos que NORMAL en igualdad de condiciones");
  comprobar(d.fácil.puntos < d.referencia.puntos, "FÁCIL da menos puntos que NORMAL en igualdad de condiciones");
  comprobar(d.fácil.puntos < d.difícil.puntos, "FÁCIL < NORMAL < DIFÍCIL, en ese orden", d.fácil.puntos + " < " + d.referencia.puntos + " < " + d.difícil.puntos);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · Los umbrales van de C a S+, nunca por debajo de C ni por encima de S+");
{
  const p = await abrir();
  const d = await p.evaluate((base) => {
    eval(base); score = 0; const vacio = calcularRank();
    eval(base); score = 999999; maxCombo = 999; elitesMuertos = 999; vidasPerdidas = 0;
    skillEventos = { cierre: 99, ola_perfecta: 99, cadena: 99, fulminante: 99, sin_golpe: 99 };
    OPCIONES.dificultad = "high"; resolverDificultad();
    const maximo = calcularRank();
    return { vacio, maximo, letras: RANK_UMBRALES.map(u => u[0]) };
  }, base);
  comprobar(d.vacio.letra === "C", "una partida sin nada saca C, nunca menos", d.vacio.letra);
  comprobar(d.maximo.letra === "S+", "una partida perfecta en DIFÍCIL saca S+", d.maximo.letra);
  comprobar(JSON.stringify(d.letras.sort()) === JSON.stringify(["A", "B", "C", "S", "S+"].sort()), "las letras son exactamente C/B/A/S/S+");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · cerrarMision() rellena resultado con todo lo que pide el resumen");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; iniciarMision ? null : null;
    modo = "campana"; misionIdx = 0; iniciarMision(0);
    elapsed = 100; score = 500; maxCombo = 12; sinDanio = true; lives = 3;
    elitesMuertos = 2; overdrivesActivados = 1; jackpotsCount = 3; evolucionesTotal = 1;
    skillEventos = { cierre: 2, ola_perfecta: 0, cadena: 1, fulminante: 0, sin_golpe: 0 };
    bulletsFiredo = 10; bulletsHit = 8;
    cerrarMision();
    return {
      tieneRank: !!(resultado.rank && resultado.rank.letra),
      maxCombo: resultado.maxCombo, skillEventos: resultado.skillEventos,
      elites: resultado.elites, overdrives: resultado.overdrives,
      jackpots: resultado.jackpots, evoluciones: resultado.evoluciones,
      dificultad: resultado.dificultad,
    };
  });
  comprobar(d.tieneRank, "resultado.rank existe y tiene letra");
  comprobar(d.maxCombo === 12, "resultado.maxCombo", d.maxCombo);
  comprobar(d.skillEventos === 3, "resultado.skillEventos suma los 5 tipos", d.skillEventos);
  comprobar(d.elites === 2, "resultado.elites", d.elites);
  comprobar(d.overdrives === 1, "resultado.overdrives", d.overdrives);
  comprobar(d.jackpots === 3, "resultado.jackpots", d.jackpots);
  comprobar(d.evoluciones === 1, "resultado.evoluciones", d.evoluciones);
  comprobar(d.dificultad === "NORMAL", "resultado.dificultad en español", d.dificultad);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · bestScore y bestRank por MISIÓN Y DIFICULTAD, independientes entre sí y entre misiones");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "campana"; misionIdx = 0; iniciarMision(0);
    OPCIONES.dificultad = "medium"; resolverDificultad();
    const r1 = SAVE.subirRecordDif(0, "medium", 1000);
    const r2 = SAVE.subirRecordDif(0, "medium", 500);   // más bajo: no debe subir
    const scoreM0Medium = SAVE.recordDif(0, "medium");
    const scoreM0High = SAVE.recordDif(0, "high");       // otra dificultad: independiente
    const scoreM1Medium = SAVE.recordDif(1, "medium");    // otra misión: independiente

    const rk1 = SAVE.subirRankDif(0, "medium", 2);   // "A"
    const rk2 = SAVE.subirRankDif(0, "medium", 1);   // "B": no debe bajar el guardado
    const rankM0Medium = SAVE.rankDif(0, "medium");

    // Score puede subir sin que el rank suba, y viceversa: son independientes.
    const rk3 = SAVE.subirRankDif(0, "medium", 4);   // "S+", ahora sí sube
    const rankTrasSubida = SAVE.rankDif(0, "medium");

    return { r1, r2, scoreM0Medium, scoreM0High, scoreM1Medium, rk1, rk2, rankM0Medium, rk3, rankTrasSubida };
  });
  comprobar(d.r1 === true, "el primer récord de la misión/dificultad se guarda");
  comprobar(d.r2 === false, "un score más bajo no reemplaza el récord");
  comprobar(d.scoreM0Medium === 1000, "el récord guardado es el más alto visto", d.scoreM0Medium);
  comprobar(d.scoreM0High === 0, "otra dificultad de la MISMA misión no se ve afectada", d.scoreM0High);
  comprobar(d.scoreM1Medium === 0, "otra misión con la MISMA dificultad no se ve afectada", d.scoreM1Medium);
  comprobar(d.rk1 === true && d.rankM0Medium === 2, "el rank sube la primera vez");
  comprobar(d.rk2 === false, "un rank más bajo no reemplaza el guardado");
  comprobar(d.rk3 === true && d.rankTrasSubida === 4, "un rank más alto sí lo reemplaza");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · Las estadísticas de por vida se acumulan misión a misión, no se pisan");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "campana"; misionIdx = 0; iniciarMision(0);
    const antes = SAVE.get("perfil.elitesDerrotados", 0);
    elapsed = 60; score = 100; elitesMuertos = 3; jackpotsCount = 1;
    overdrivesActivados = 0; evolucionesTotal = 0;
    skillEventos = { cierre: 0, ola_perfecta: 0, cadena: 0, fulminante: 0, sin_golpe: 0 };
    bulletsFiredo = 1; bulletsHit = 1;
    cerrarMision();
    const tras1 = SAVE.get("perfil.elitesDerrotados", 0);

    misionIdx = 1; iniciarMision(1);
    elapsed = 60; score = 100; elitesMuertos = 2; jackpotsCount = 0;
    bulletsFiredo = 1; bulletsHit = 1;
    cerrarMision();
    const tras2 = SAVE.get("perfil.elitesDerrotados", 0);

    return { antes, tras1, tras2 };
  });
  comprobar(d.tras1 === d.antes + 3, "primera misión suma sus 3 élites al total de por vida", d.antes + " -> " + d.tras1);
  comprobar(d.tras2 === d.antes + 5, "segunda misión SUMA (no reemplaza) sus 2 élites más", d.tras1 + " -> " + d.tras2);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n7 · reset() limpia los contadores de la sesión de RANK");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia";
    vidasPerdidas = 2; elitesMuertos = 3; jackpotsCount = 1; overdrivesActivados = 1;
    reset();
    return { vidasPerdidas, elitesMuertos, jackpotsCount, overdrivesActivados };
  });
  comprobar(d.vidasPerdidas === 0 && d.elitesMuertos === 0 && d.jackpotsCount === 0 && d.overdrivesActivados === 0,
    "reset() vacía los cuatro contadores de la partida", JSON.stringify(d));
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
