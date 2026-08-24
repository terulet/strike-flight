// ════════════════════════════════════════════════════════════
//  muestra-ritmo-real.mjs — telemetría REAL de una muestra de misiones
// ════════════════════════════════════════════════════════════
//
//    node herramientas/muestra-ritmo-real.mjs
//
//  informe-ritmo.mjs analiza el GUIÓN sin jugar nada. Esto es lo
//  contrario: juega la misión de principio a fin con el mismo piloto
//  automático de mision-completa.mjs y lee `resultado` -que ya rellena
//  cerrarMision(), bloque 6I- para sacar números reales de skill
//  events, élites, jackpots y overdrives. NO son las 20 misiones -cada
//  una tarda minutos reales y el piloto no siempre termina vivo- son
//  una MUESTRA, presentada como tal.

import { servidor, cargarPlaywright, abrir } from "./qa.mjs";

const MISIONES_MUESTRA = [0, 9, 14];   // M1, M10, M20... (14 = M15, índice 0-based)
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();

const filas = [];
for (const mis of MISIONES_MUESTRA) {
  const p = await abrir({ navegador }, srv, "ipad");
  await p.evaluate((mis) => {
    unlockAudio(); modo = "campana"; naveSel = 1; iniciarMision(mis);
    window._bot = setInterval(() => {
      if (state !== "play") return;
      if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
      let mejor = player.x, mejorD = -1;
      for (let i = 0; i < 26; i++) {
        const x = 26 + (W - 52) * i / 25;
        let d = 1e9;
        for (const b of eBullets) {
          if (b.y > player.y - 300 && b.y < player.y + 90 && b.vy > -10) {
            d = Math.min(d, Math.abs(b.x + b.vx * 0.35 - x) + Math.abs(b.y - player.y) * 0.22);
          }
        }
        for (const e of enemies) if (e.y > player.y - 260) d = Math.min(d, Math.abs(e.x - x));
        for (const h of hazards) d = Math.min(d, Math.abs(h.x - x) * 0.8);
        d -= Math.abs(x - player.x) * 0.08;
        if (d > mejorD) { mejorD = d; mejor = x; }
      }
      targetX = mejor; targetY = H * 0.8;
      if (bombas > 0 && eBullets.length > 150) usarBomba();
    }, 55);
  }, mis);

  const t0 = Date.now();
  let terminada = false, ultimo = null;
  for (let i = 0; i < 150 && !terminada; i++) {
    await p.waitForTimeout(3000);
    ultimo = await p.evaluate(() => ({ state, misionCompletaT, elapsed }));
    if (ultimo.state !== "play") break;
    if (ultimo.misionCompletaT > 0) terminada = true;
  }
  const real = (Date.now() - t0) / 1000;
  const r = await p.evaluate(() => ({
    completada: !!(resultado && resultado.rank),
    estado: state,
    elapsed,
    rank: resultado && resultado.rank && resultado.rank.letra,
    puntos: resultado && resultado.rank && resultado.rank.puntos,
    maxCombo: resultado && resultado.maxCombo,
    skillEventos: resultado && resultado.skillEventos,
    elites: resultado && resultado.elites,
    overdrives: resultado && resultado.overdrives,
    jackpots: resultado && resultado.jackpots,
    huecoMax: RHYTHM.estado().maxHueco,
    nHuecos: RHYTHM.estado().huecos.length,
  }));
  filas.push({ mision: "M" + (mis + 1), duracionReal: Math.round(real), ...r });
  console.log("M" + (mis + 1), JSON.stringify(r), "· " + Math.round(real) + "s reales");
  await p.close ? p.close() : null;
}

console.log("\n# Muestra real de ritmo — " + MISIONES_MUESTRA.length + " misiones jugadas de principio a fin\n");
console.table ? console.table(filas) : console.log(JSON.stringify(filas, null, 2));

await navegador.close();
srv.cerrar();
