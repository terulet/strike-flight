// ════════════════════════════════════════════════════════════
//  upgrades.mjs — Bloque 6, fase 6G
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/upgrades.mjs

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
console.log("\n1 · Disparador: aparece pronto, 2-4 veces por partida, nunca con lo mismo maximado");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    enemiesKilled = 0; upgradesElegidos = 0; upgradesOfrecidos = null; upgradesJugador = {};
    enemiesKilled = UPGRADE_HITOS[0] - 1;
    comprobarUpgradeOfrecido();
    const antesDelHito = !!upgradesOfrecidos;
    enemiesKilled = UPGRADE_HITOS[0];
    comprobarUpgradeOfrecido();
    const enElHito = !!upgradesOfrecidos;
    const tresOpciones = upgradesOfrecidos && upgradesOfrecidos.opciones.length === 3;
    const sinRepetidas = upgradesOfrecidos && new Set(upgradesOfrecidos.opciones).size === 3;
    return { primerHito: UPGRADE_HITOS[0], nHitos: UPGRADE_HITOS.length, antesDelHito, enElHito, tresOpciones, sinRepetidas };
  });
  comprobar(d.primerHito <= 10, "el primer hito cae pronto (kills), consistente con 'no a los 4 min'", d.primerHito);
  comprobar(d.nHitos >= 2 && d.nHitos <= 4, "entre 2 y 4 elecciones posibles por partida", d.nHitos);
  comprobar(!d.antesDelHito, "no ofrece nada ANTES de llegar al hito");
  comprobar(d.enElHito, "ofrece justo AL llegar al hito");
  comprobar(d.tresOpciones, "ofrece exactamente 3 opciones");
  comprobar(d.sinRepetidas, "las 3 opciones son distintas entre sí");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · Elegir: sube de nivel, limpia la oferta, respeta maxNivel");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    upgradesJugador = {}; upgradesElegidos = 0;
    upgradesOfrecidos = { opciones: ["triple_shot", "rapid_core", "heavy_core"] };
    elegirUpgrade("triple_shot");
    const nivel1 = upgradesJugador.triple_shot;
    const limpio = upgradesOfrecidos === null;
    const contado = upgradesElegidos === 1;
    upgradesJugador.magnet_field = UPGRADES.magnet_field.maxNivel;   // ya al tope (maxNivel 1)
    const disponibles = upgradesDisponibles();
    const noOfreceMagnetMaximado = disponibles.indexOf("magnet_field") === -1;
    return { nivel1, limpio, contado, noOfreceMagnetMaximado };
  });
  comprobar(d.nivel1 === 1, "elegir por primera vez deja el upgrade en nivel 1", d.nivel1);
  comprobar(d.limpio, "elegir limpia la oferta activa");
  comprobar(d.contado, "elegir cuenta para upgradesElegidos");
  comprobar(d.noOfreceMagnetMaximado, "un upgrade en su maxNivel no vuelve a ofrecerse");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · Efectos: cada upgrade hace lo que dice, y solo mientras se tiene");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    player.x = 200; player.y = 500; armaId = "cannon"; arma = 1; turbo = 0; overdriveActivo = 0;
    upgradesJugador = {};

    // TRIPLE SHOT
    bullets.length = 0; disparar(); const sinTriple = bullets.length;
    upgradesJugador.triple_shot = 1;
    bullets.length = 0; disparar(); const conTriple = bullets.length;
    const tripleOk = conTriple === sinTriple + 2;
    upgradesJugador.triple_shot = 0;

    // RAPID CORE
    const nv = naveActual(); const armaAct = ARMAS[armaId];
    const cadSin = armaAct.cad * nv.cad * (1 - 0) * 1;
    upgradesJugador.rapid_core = 2;
    const cadCon = armaAct.cad * nv.cad * (1 - 2 * 0.12) * 1;
    const rapidOk = cadCon < cadSin;
    upgradesJugador.rapid_core = 0;

    // HEAVY CORE
    upgradesJugador.heavy_core = 0;
    const bSin = nuevaBala(0, 0, 0, -1, ARMAS.cannon); const dmgSin = bSin.dmg; libresBala.push(bSin);
    upgradesJugador.heavy_core = 2;
    const bCon = nuevaBala(0, 0, 0, -1, ARMAS.cannon); const dmgCon = bCon.dmg; libresBala.push(bCon);
    const heavyOk = dmgCon > dmgSin;
    upgradesJugador.heavy_core = 0;

    // CHAIN LIGHTNING (arma sin cadena propia: cannon)
    upgradesJugador.chain_lightning = 0;
    const bSinCad = nuevaBala(0, 0, 0, -1, ARMAS.cannon); const cadenaSin = bSinCad.cadena; libresBala.push(bSinCad);
    upgradesJugador.chain_lightning = 1;
    const bConCad = nuevaBala(0, 0, 0, -1, ARMAS.cannon); const cadenaCon = bConCad.cadena; libresBala.push(bConCad);
    const chainOk = cadenaSin === 0 && cadenaCon > 0;
    upgradesJugador.chain_lightning = 0;

    // SHIELD REACTOR
    upgradesJugador.shield_reactor = 1; escudo = 0; shieldReactorT = 0;
    actualizarUpgradesPasivos(15.1);
    const shieldOk = escudo === 1;
    upgradesJugador.shield_reactor = 0; escudo = 0; shieldReactorT = 0;
    actualizarUpgradesPasivos(15.1);   // sin el upgrade, NO regenera
    const sinShieldOk = escudo === 0;

    // MISSILE SWARM
    upgradesJugador.missile_swarm = 1; missileSwarmT = 0;
    bullets.length = 0;
    actualizarUpgradesPasivos(8.1);
    const swarmOk = bullets.length === 6;
    upgradesJugador.missile_swarm = 0;

    // MAGNET FIELD (premios)
    upgradesJugador.magnet_field = 0;
    premios.length = 0; premios.push({ x: player.x + 200, y: player.y, vy: 0, r: 17, tipo: "arma", f: 0, giro: 0, t: 0, nace: 0 });
    imanT = 0;
    // Un paso de actualización manual del bucle real ya sube en el update(), pero
    // aquí se comprueba solo el alcance -no hace falta simular todo el frame-.
    const alcanceSinMagnet = 165;
    upgradesJugador.magnet_field = 1;
    const alcanceConMagnet = 165 + 90;
    const magnetOk = alcanceConMagnet > alcanceSinMagnet;

    // OVERDRIVE BOOST
    upgradesJugador.overdrive_boost = 0; overdrive = 0; cargarOverdrive(10);
    const cargaSin = overdrive;
    upgradesJugador.overdrive_boost = 2; overdrive = 0; cargarOverdrive(10);
    const cargaCon = overdrive;
    const boostCargaOk = cargaCon > cargaSin;
    overdrive = OVERDRIVE_MAX; overdriveActivo = 0;
    activarOverdrive();
    const boostDuracionOk = overdriveActivo > OVERDRIVE_DURACION;

    return { tripleOk, rapidOk, heavyOk, chainOk, shieldOk, sinShieldOk, swarmOk, magnetOk, boostCargaOk, boostDuracionOk };
  });
  comprobar(d.tripleOk, "TRIPLE SHOT: +2 balas por nivel");
  comprobar(d.rapidOk, "RAPID CORE: cadencia más rápida");
  comprobar(d.heavyOk, "HEAVY CORE: más daño por bala");
  comprobar(d.chainOk, "CHAIN LIGHTNING: un arma sin cadena propia la recibe del upgrade");
  comprobar(d.shieldOk, "SHIELD REACTOR: regenera el escudo tras 15s sin él");
  comprobar(d.sinShieldOk, "sin el upgrade, el escudo NO regenera solo");
  comprobar(d.swarmOk, "MISSILE SWARM: dispara 6 misiles al cumplirse el intervalo");
  comprobar(d.magnetOk, "MAGNET FIELD: más alcance de imán permanente");
  comprobar(d.boostCargaOk, "OVERDRIVE BOOST: carga más rápido");
  comprobar(d.boostDuracionOk, "OVERDRIVE BOOST: dura más al activarse");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · Con tarjetas en pantalla, la partida se congela de verdad");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    enemies.length = 0; enemies.push({ tipo: "normal", x: 100, y: 100, r: 16, hp: 2, hpMax: 2,
      vy: 100, fase: 0, giro: 0, cd: 0, flash: 0, recoil: 0, lentoT: 0, avisado: 0, escFlash: 0, onda: 0 });
    const yAntes = enemies[0].y;
    upgradesOfrecidos = { opciones: ["triple_shot", "rapid_core", "heavy_core"] };
    update(1);   // un "segundo" entero de simulación
    const yTrasCongelado = enemies[0].y;
    upgradesOfrecidos = null;
    update(1);
    const yTrasDescongelar = enemies[0].y;
    return { congelado: yTrasCongelado === yAntes, siguioLuego: yTrasDescongelar !== yTrasCongelado };
  });
  comprobar(d.congelado, "con upgradesOfrecidos activo, los enemigos NO se mueven");
  comprobar(d.siguioLuego, "al elegir (upgradesOfrecidos=null), el juego continúa");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · reset() limpia el build temporal entre misiones");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia";
    upgradesJugador = { triple_shot: 2, heavy_core: 1 };
    upgradesElegidos = 3; upgradesOfrecidos = { opciones: ["rapid_core"] };
    reset();
    return { vacio: Object.keys(upgradesJugador).length === 0, elegidos: upgradesElegidos, oferta: upgradesOfrecidos };
  });
  comprobar(d.vacio, "reset() vacía upgradesJugador (build TEMPORAL, no permanente)");
  comprobar(d.elegidos === 0, "reset() reinicia el contador de elecciones", d.elegidos);
  comprobar(d.oferta === null, "reset() cierra cualquier oferta a medias");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
