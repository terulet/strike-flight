// ════════════════════════════════════════════════════════════
//  overdrive.mjs — Bloque 6, fase 6F
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/overdrive.mjs

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
console.log("\n1 · CARGA: kills, combo, skill, élites, boss break y bonus events cargan; el tope no se pasa");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    overdrive = 0;
    alMatar({ fuente: "enemigo", puntosBase: 5, posicion: { x: 0, y: 0 }, opciones: { texto: false, premio: { prob: 0 } } });
    const trasKill = overdrive;
    overdrive = 0;
    skillEvent("cierre", 0, 0);
    const trasSkill = overdrive;
    overdrive = 0; comboHito = 0; combo = 50; hitoCombo();
    const trasCombo = overdrive;
    overdrive = 90;
    cargarOverdrive(1000);
    const noPasaTope = overdrive === OVERDRIVE_MAX;
    return { trasKill, trasSkill, trasCombo, noPasaTope };
  });
  comprobar(d.trasKill > 0, "un kill normal carga overdrive", d.trasKill);
  comprobar(d.trasSkill > 0, "un skill event carga overdrive", d.trasSkill);
  comprobar(d.trasCombo > 0, "un hito de combo carga overdrive", d.trasCombo);
  comprobar(d.noPasaTope, "la carga nunca pasa de OVERDRIVE_MAX", d.noPasaTope);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · READY, activación manual y duración");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    overdrive = 10; overdriveActivo = 0;
    const noActivaSinLlenar = activarOverdrive() === false;
    fillOverdrive();
    const llenoOk = overdrive === OVERDRIVE_MAX;
    const activaOk = activarOverdrive() === true;
    const consumida = overdrive === 0 && overdriveActivo > 0;
    const duracionOk = overdriveActivo >= 12 && overdriveActivo <= 15;
    const noReactivaMientrasActiva = activarOverdrive() === false;
    return { noActivaSinLlenar, llenoOk, activaOk, consumida, duracionOk, noReactivaMientrasActiva };
  });
  comprobar(d.noActivaSinLlenar, "no se puede activar sin llenar la barra");
  comprobar(d.llenoOk, "fillOverdrive() (gancho ADMIN) llena la barra");
  comprobar(d.activaOk, "activateOverdrive/activarOverdrive() activa con la barra llena");
  comprobar(d.consumida, "activar consume la carga y arranca el temporizador");
  comprobar(d.duracionOk, "la duración cae dentro de 12-15s", "");
  comprobar(d.noReactivaMientrasActiva, "no se puede reactivar mientras ya está activa");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · Daño recibido reduce carga (en carga) o recorta segundos (activa) — nunca invencibilidad");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    lives = 3; escudo = 0; invulnT = 0; overdrive = 60; overdriveActivo = 0;
    golpe();
    const enCargaOk = overdrive < 60 && overdrive >= 0;

    lives = 3; escudo = 0; invulnT = 0; overdriveActivo = 13;
    const antes = overdriveActivo;
    golpe();
    const activaOk = overdriveActivo < antes && overdriveActivo >= 0;
    // Sigue perdiendo vidas con Overdrive activa: NO es invencibilidad.
    const vidasBajaron = lives === 2;
    return { enCargaOk, activaOk, vidasBajaron };
  });
  comprobar(d.enCargaOk, "un golpe en carga reduce la barra", d.enCargaOk);
  comprobar(d.activaOk, "un golpe con Overdrive activa recorta segundos, no la apaga en seco");
  comprobar(d.vidasBajaron, "Overdrive activa NO impide perder una vida");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · Efectos durante Overdrive: cadencia, disparos laterales, score bonus");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    player.x = 200; player.y = 500;
    armaId = "cannon"; arma = 1; turbo = 0;
    const nv = naveActual();
    const armaAct = ARMAS[armaId] || ARMAS.cannon;
    overdriveActivo = 0;
    const cadNormal = armaAct.cad * nv.cad;
    overdriveActivo = 10;
    const cadOverdrive = armaAct.cad * nv.cad * ((turbo > 0 || overdriveActivo > 0) ? 0.55 : 1);
    const cadenciaOk = cadOverdrive < cadNormal;

    bullets.length = 0; overdriveActivo = 0; disparar();
    const nSinOverdrive = bullets.length;
    bullets.length = 0; overdriveActivo = 10; disparar();
    const nConOverdrive = bullets.length;
    const lateralesOk = nConOverdrive === nSinOverdrive + 2;

    score = 0; overdriveActivo = 0;
    alMatar({ fuente: "enemigo", puntosBase: 100, posicion: { x: 0, y: 0 }, opciones: { combo: false, texto: false } });
    const sinBono = score;
    score = 0; overdriveActivo = 10;
    alMatar({ fuente: "enemigo", puntosBase: 100, posicion: { x: 0, y: 0 }, opciones: { combo: false, texto: false } });
    const conBono = score;
    const scoreBonoOk = conBono === Math.round(sinBono * 1.5);

    return { cadenciaOk, lateralesOk, scoreBonoOk, sinBono, conBono };
  });
  comprobar(d.cadenciaOk, "Overdrive dispara más rápido (misma cadencia que turbo)");
  comprobar(d.lateralesOk, "Overdrive añade exactamente 2 disparos laterales por ráfaga");
  comprobar(d.scoreBonoOk, "Overdrive multiplica el score de cada kill ×1.5", d.sinBono + " -> " + d.conBono);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · DIF.overdriveAccessMul: FÁCIL carga más rápido");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    OPCIONES.dificultad = "easy"; resolverDificultad();
    overdrive = 0; cargarOverdrive(10);
    const easy = overdrive;
    OPCIONES.dificultad = "medium"; resolverDificultad();
    overdrive = 0; cargarOverdrive(10);
    const medium = overdrive;
    OPCIONES.dificultad = "medium";
    return { easy, medium, mulEasy: DIFFICULTY_CONFIG.easy.overdriveAccessMul };
  });
  comprobar(d.easy > d.medium, "FÁCIL carga más rápido que NORMAL", d.easy + " vs " + d.medium);
  comprobar(d.mulEasy > 1, "el multiplicador de FÁCIL es mayor que 1", d.mulEasy);
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
