// ════════════════════════════════════════════════════════════
//  evoluciones.mjs — Bloque 6, fase 6H
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/evoluciones.mjs

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
console.log("\n1 · Se funde SOLO con las dos mitades a nivel II, nunca con una sola");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    upgradesJugador = {}; evoluciones = {};
    upgradesJugador.triple_shot = 2;   // solo la mitad
    comprobarEvolucion();
    const soloUnaNoFunde = !evoluciones.supernova_cannon;
    upgradesJugador.plasma_burst = 1;  // la otra mitad, pero a nivel 1
    comprobarEvolucion();
    const nivel1NoBasta = !evoluciones.supernova_cannon;
    upgradesJugador.plasma_burst = 2;  // ahora sí, las dos a nivel II
    comprobarEvolucion();
    const lasDosFunde = !!evoluciones.supernova_cannon;
    const totalTrasFundir = evolucionesTotal;
    comprobarEvolucion();   // repetir no debe volver a fundir ni sumar
    const noSeRefunde = evolucionesTotal === totalTrasFundir;
    return { soloUnaNoFunde, nivel1NoBasta, lasDosFunde, noSeRefunde };
  });
  comprobar(d.soloUnaNoFunde, "con solo la mitad de la pareja, no funde");
  comprobar(d.nivel1NoBasta, "con la pareja completa pero una en nivel I, no funde");
  comprobar(d.lasDosFunde, "con las dos en nivel II, funde");
  comprobar(d.noSeRefunde, "una evolución ya fundida no se vuelve a fundir ni a contar");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · Las 4 parejas declaradas funden, cada una con su propio par");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    const resultado = {};
    for (const ev of EVOLUCIONES) {
      upgradesJugador = {}; evoluciones = {};
      for (const id of ev.requiere) upgradesJugador[id] = 2;
      comprobarEvolucion();
      resultado[ev.id] = !!evoluciones[ev.id];
    }
    return resultado;
  });
  for (const ev of ["supernova_cannon", "thunderstorm", "strike_fleet", "gravity_aegis"]) {
    comprobar(d[ev] === true, ev + ": funde con su pareja completa a nivel II");
  }
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · Efectos: cada evolución hace más que sus dos mitades sueltas");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    player.x = 300; player.y = 500;

    // SUPERNOVA CANNON: nova periódica de área.
    upgradesJugador = { triple_shot: 2, plasma_burst: 2 }; evoluciones = { supernova_cannon: true };
    enemies.length = 0;
    enemies.push({ tipo: "normal", x: player.x + 40, y: player.y - 60, r: 16, hp: 999, hpMax: 999,
      vy: 0, fase: 0, giro: 0, cd: 0, flash: 0, recoil: 0, lentoT: 0, avisado: 0, escFlash: 0, onda: 0 });
    evoNovaT = 0; actualizarEvoluciones(2.6);
    const novaOk = enemies[0].hp < 999;
    const danoNova = 999 - enemies[0].hp;

    // THUNDERSTORM: cadena de rayos periódica.
    evoluciones = { thunderstorm: true };
    enemies.length = 0;
    // Espaciado desigual A PROPÓSITO: tres a la misma distancia entre sí
    // empataban en enemigoMasCerca() (gana el primero del array) y el
    // salto final podía repetir uno en vez de llegar al tercero -no es
    // un fallo del juego, es un empate que este set de datos evita-.
    const offsets = [0, 35, 95];
    for (const dx of offsets) enemies.push({ tipo: "normal", x: player.x + dx, y: player.y - 50, r: 16,
      hp: 999, hpMax: 999, vy: 0, fase: 0, giro: 0, cd: 0, flash: 0, recoil: 0, lentoT: 0, avisado: 0, escFlash: 0, onda: 0 });
    evoRayoT = 0; actualizarEvoluciones(1.7);
    const rayoOk = enemies.every(e => e.hp < 999);

    // STRIKE FLEET: enjambre más grande.
    upgradesJugador = { missile_swarm: 1, heavy_core: 2 };
    evoluciones = {};
    bullets.length = 0; dispararMissileSwarm();
    const nSinEvo = bullets.length;
    evoluciones = { strike_fleet: true };
    bullets.length = 0; dispararMissileSwarm();
    const nConEvo = bullets.length;
    const swarmMasGrande = nConEvo > nSinEvo;

    // GRAVITY AEGIS: escudo más rápido + pulso.
    upgradesJugador = { shield_reactor: 1, magnet_field: 2 };
    evoluciones = {}; escudo = 0; shieldReactorT = 0;
    actualizarUpgradesPasivos(14);   // nivel 1 sin evo: umbral 19-4=15s, 14 no llega
    const sinEvoNoRegenera = escudo === 0;
    evoluciones = { gravity_aegis: true }; escudo = 0; shieldReactorT = 0;
    actualizarUpgradesPasivos(15);   // con la evo, el umbral se parte por la mitad: sí llega
    const conEvoRegeneraAntes = escudo === 1;

    return { novaOk, danoNova, rayoOk, swarmMasGrande, sinEvoNoRegenera, conEvoRegeneraAntes };
  });
  comprobar(d.novaOk, "SUPERNOVA CANNON: la nova periódica hace daño de área", d.danoNova);
  comprobar(d.rayoOk, "THUNDERSTORM: la cadena golpea a los tres enemigos cercanos");
  comprobar(d.swarmMasGrande, "STRIKE FLEET: el enjambre evolucionado es más grande");
  comprobar(d.sinEvoNoRegenera, "sin GRAVITY AEGIS, SHIELD REACTOR nivel 1 no llega a 15s de umbral");
  comprobar(d.conEvoRegeneraAntes, "con GRAVITY AEGIS, el mismo tiempo SÍ regenera (umbral partido por la mitad)");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · Ninguna evolución borra un jefe sola (daño modesto por aplicación)");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia"; state = "play"; paused = false;
    player.x = 300; player.y = 500;
    // HP típico de un jefe temprano (Guardián, M1): 560.
    const HP_JEFE_TIPICO = 560;
    spawnMiniboss("guardian");
    miniboss.hp = miniboss.hpMax; miniboss.invul = false;
    miniboss.x = player.x; miniboss.y = player.y - 80;

    evoluciones = { supernova_cannon: true }; evoNovaT = 0;
    const antesNova = miniboss.hp;
    actualizarEvoluciones(2.6);
    const danoNovaPct = (antesNova - miniboss.hp) / HP_JEFE_TIPICO;

    miniboss.hp = miniboss.hpMax;
    evoluciones = { gravity_aegis: true }; evoPulsoT = 0;
    const antesPulso = miniboss.hp;
    actualizarEvoluciones(6.1);
    const danoPulsoPct = (antesPulso - miniboss.hp) / HP_JEFE_TIPICO;

    return { danoNovaPct, danoPulsoPct };
  });
  comprobar(d.danoNovaPct < 0.05, "una nova sola quita menos del 5% del HP de un jefe típico", (d.danoNovaPct * 100).toFixed(1) + "%");
  comprobar(d.danoPulsoPct < 0.05, "un pulso de gravedad solo quita menos del 5%", (d.danoPulsoPct * 100).toFixed(1) + "%");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · reset() limpia las evoluciones entre misiones");
{
  const p = await abrir();
  const d = await p.evaluate(() => {
    modo = "supervivencia";
    evoluciones = { supernova_cannon: true, thunderstorm: true };
    evoNovaT = 5; evoRayoT = 5; evoPulsoT = 5;
    reset();
    return { vacio: Object.keys(evoluciones).length === 0, novaT: evoNovaT };
  });
  comprobar(d.vacio, "reset() vacía las evoluciones fundidas");
  comprobar(d.novaT === 0, "reset() reinicia los relojes de efecto");
  comprobar(p.errs.length === 0, "sin errores", p.errs.slice(0, 3).join(" | "));
  await p.cerrar();
}

// ════════════════════════════════════════════════════════════
console.log("\n" + (fallos.length ? fallos.length + " FALLO(S):\n  - " + fallos.join("\n  - ") : "TODO OK") + "\n");
await nav.close();
srv.cerrar();
process.exit(fallos.length ? 1 : 0);
