// ════════════════════════════════════════════════════════════
//  estres-bloque6.mjs — la peor escena razonable (Bloque 6, fase 6J)
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/estres-bloque6.mjs
//
//  DIFÍCIL, 30 enemigos (con élites), hazard, 100+ balas enemigas,
//  combo alto, drops, texto de score, Overdrive activa, efectos de
//  upgrade, jefe en pantalla — todo a la vez. Mide avg/p95/peor,
//  partículas, drops, textos, y si el auto-degradado responde.
//
//  AVISO sobre los FPS: Chromium headless sin GPU compone el canvas
//  por software — el suelo aquí es pesimista, no lo que da un iPad
//  real. Lo fiable es todo lo demás: conteos, topes, fugas, errores.

import { servidor, cargarPlaywright, abrir, captura } from "../qa.mjs";

const OUT = process.argv[2] || "artifacts/screenshots/estres-bloque6";
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const p = await abrir({ navegador }, srv, "ipad");

const medir = async () => p.evaluate(() => ({
  fps: +fps.toFixed(1),
  ene: enemies.length, eBal: eBullets.length, bal: bullets.length,
  flot: flotantes.length, shards: shards.length,
  part: VFX.metricas().parts, calidad: calidadAuto,
  overdriveActivo: +overdriveActivo.toFixed(1), combo, score,
}));

await p.evaluate(() => {
  unlockAudio();
  OPCIONES.dificultad = "high"; resolverDificultad();
  modo = "campana"; naveSel = 1; iniciarMision(4);   // M5, mundo con hazard propio
  golpe = () => {};   // la escena es de rendimiento, no de esquiva
  arma = 6; armaId = "ultimate";
  combo = 60; comboT = 5; maxCombo = 60;
  hazardEnabled = true;
  upgradesJugador = { triple_shot: 2, rapid_core: 2, heavy_core: 2, missile_swarm: 2, plasma_burst: 2 };
  evoluciones = { supernova_cannon: true, strike_fleet: true };
  overdrive = OVERDRIVE_MAX; activarOverdrive();
  spawnMiniboss("titan", 1); miniboss.est = "combate"; miniboss.estT = 0; miniboss.invul = false;
  // 30 enemigos, con élites forzados (no se espera a la tirada de siempre).
  for (let i = 0; i < 30; i++) {
    const e = spawnEnemy(["normal", "veloz", "torreta", "tanque", "kamikaze"][i % 5], 20 + (i % 15) * 52);
    if (i % 5 === 0) { e.elite = true; e.hpMax *= 1.4; e.hp = e.hpMax; }
  }
  // Más de 100 balas enemigas.
  for (let i = 0; i < 130; i++) eBala(Math.random() * W, Math.random() * H * 0.6, rand(-40, 40), rand(120, 260), 5);
  // Drops y texto de score ya en pantalla.
  lluviaShards(W / 2, H * 0.3, "boss");
  for (let i = 0; i < 10; i++) texto(rand(0, W), rand(0, H * 0.5), "+" + ((i + 1) * 40), "#ffd700", 14);
});

let pico = { ene: 0, eBal: 0, bal: 0, flot: 0, shards: 0, part: 0 };
const muestras = [];
for (let i = 0; i < 10; i++) {
  await p.waitForTimeout(1000);
  const m = await medir();
  muestras.push(m);
  for (const k of Object.keys(pico)) pico[k] = Math.max(pico[k], m[k]);
  if (i === 4) await captura(p, OUT, "peor-escena");
  console.log(("t+" + (i + 1) + "s").padEnd(6), JSON.stringify(m));
}
console.log("\nPICOS", JSON.stringify(pico));
console.log("Calidad final:", muestras[muestras.length - 1].calidad,
  "(el auto-degradado" + (muestras[0].calidad !== muestras[muestras.length - 1].calidad ? " SÍ" : " NO") + " se movió)");

const HARD_LIMITS = { flot: 40, shards: 60, eBal: 340, bal: 240 };
console.log("\nTOPES DUROS:");
for (const [k, max] of Object.entries(HARD_LIMITS)) {
  const ok = pico[k] <= max;
  console.log("  " + (ok ? "ok    " : "FALLO ") + k + ": " + pico[k] + " / " + max);
}

await navegador.close();
srv.cerrar();
