// Las tres peleas nuevas, paso a paso: entrada, cada fase, mecánica
// firma, muerte, y una comprobación de limpieza tras reiniciar.

import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2] || "artifacts/screenshots/bosses-m2-m4";
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const p = await abrir({ navegador }, srv, "ipad");

const limpieza = () => p.evaluate(() => ({
  eBal: eBullets.length, bal: bullets.length, rocas: rocas.length,
  zonas: zonas.length, telegrafos: telegrafos.length, boss: !!miniboss,
}));

// ════════════════ M2 — RIFT REAPER ════════════════
await p.evaluate(() => {
  unlockAudio(); modo = "campana"; naveSel = 1; iniciarMision(1);
  golpe = () => {}; eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
  armaId = "cannon"; arma = 6;
  window._bot = setInterval(() => {
    if (state !== "play") return;
    if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
    if (!miniboss) return;
    targetX = miniboss.x; targetY = H * 0.78;
  }, 50);
  spawnMiniboss("rift_reaper");
});
await p.waitForTimeout(1200);
await captura(p, OUT, "01-entry");
console.log("m2 entry ", JSON.stringify(await estado(p)));

await p.waitForTimeout(2500);
await captura(p, OUT, "02-phase1");
console.log("m2 f1    ", JSON.stringify(await estado(p)));

await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.6; });
await p.waitForTimeout(2500);
await captura(p, OUT, "03-asteroid-mechanic");
console.log("m2 f2    ", JSON.stringify(await estado(p)));

await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.28; });
await p.waitForTimeout(3000);
await captura(p, OUT, "04-phase3");
console.log("m2 f3    ", JSON.stringify(await estado(p)));

let t0 = Date.now();
await p.evaluate(() => { miniboss.hp = 1; });
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(400);
  const b = await p.evaluate(() => miniboss ? miniboss.est : null);
  if (b === null) break;
}
await captura(p, OUT, "05-death");
console.log("m2 death ", (Date.now() - t0) + "ms hasta null, limpieza:", JSON.stringify(await limpieza()));

// restart
await p.evaluate(() => { clearInterval(window._bot); iniciarMision(1); });
await p.waitForTimeout(600);
console.log("m2 restart", JSON.stringify(await estado(p)));

// ════════════════ M3 — AEGIS PRIME ════════════════
await p.evaluate(() => {
  iniciarMision(2); eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
  armaId = "cannon"; arma = 6;
  window._bot = setInterval(() => {
    if (state !== "play") return;
    if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
    if (!miniboss) return;
    targetX = miniboss.x; targetY = H * 0.78;
  }, 50);
  spawnMiniboss("aegis_prime");
});
await p.waitForTimeout(1200);
await captura(p, OUT, "06-entry");
console.log("m3 entry ", JSON.stringify(await estado(p)));

await p.waitForTimeout(2500);
await captura(p, OUT, "07-defense-nodes");
const nodos1 = await p.evaluate(() => miniboss.nodos ? miniboss.nodos.length : -1);
console.log("m3 nodos tras 3.7s:", nodos1, JSON.stringify(await estado(p)));

// dejar que el bot los destruya un poco más
await p.waitForTimeout(6000);
const nodos2 = await p.evaluate(() => miniboss.nodos ? miniboss.nodos.length : -1);
console.log("m3 nodos tras 9.7s:", nodos2);

await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.55; });
await p.waitForTimeout(2500);
await captura(p, OUT, "08-phase2");
const nodosF2 = await p.evaluate(() => miniboss.nodos ? miniboss.nodos.length : -1);
console.log("m3 f2 nodos (debe ser 0):", nodosF2, JSON.stringify(await estado(p)));

await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.22; });
await p.waitForTimeout(2500);
await captura(p, OUT, "09-overload");
console.log("m3 f3    ", JSON.stringify(await estado(p)));

t0 = Date.now();
await p.evaluate(() => { miniboss.hp = 1; });
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(400);
  const b = await p.evaluate(() => miniboss ? miniboss.est : null);
  if (b === null) break;
}
await captura(p, OUT, "10-death");
console.log("m3 death ", (Date.now() - t0) + "ms, limpieza:", JSON.stringify(await limpieza()));

await p.evaluate(() => { clearInterval(window._bot); iniciarMision(2); });
await p.waitForTimeout(600);
console.log("m3 restart", JSON.stringify(await estado(p)));

// ════════════════ M4 — VENOM CORE ════════════════
await p.evaluate(() => {
  iniciarMision(3); eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
  armaId = "cannon"; arma = 6;
  window._bot = setInterval(() => {
    if (state !== "play") return;
    if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
    if (!miniboss) return;
    targetX = miniboss.x; targetY = H * 0.78;
  }, 50);
  spawnMiniboss("venom_core");
});
await p.waitForTimeout(1200);
await captura(p, OUT, "11-entry");
console.log("m4 entry ", JSON.stringify(await estado(p)));

// forzar una zona ya y capturar los tres estados
await p.evaluate(() => { venomZona(1); });
await p.waitForTimeout(300);
await captura(p, OUT, "12-toxic-telegraph");
console.log("m4 telegraph", JSON.stringify(await p.evaluate(() => zonas.map(z => z.fase))));

await p.waitForTimeout(2200);
await captura(p, OUT, "13-toxic-active");
console.log("m4 active   ", JSON.stringify(await p.evaluate(() => zonas.map(z => z.fase))));

await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.55; });
await p.waitForTimeout(3000);
await captura(p, OUT, "13b-phase2-columnas");
console.log("m4 f2 zonas x:", JSON.stringify(await p.evaluate(() => zonas.map(z => Math.round(z.x)))), "W:", await p.evaluate(() => W));

await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.22; });
await p.waitForTimeout(3000);
await captura(p, OUT, "14-phase3");
console.log("m4 f3    ", JSON.stringify(await estado(p)));

t0 = Date.now();
await p.evaluate(() => { miniboss.hp = 1; });
for (let i = 0; i < 20; i++) {
  await p.waitForTimeout(400);
  const b = await p.evaluate(() => miniboss ? miniboss.est : null);
  if (b === null) break;
}
await captura(p, OUT, "15-death");
console.log("m4 death ", (Date.now() - t0) + "ms, limpieza:", JSON.stringify(await limpieza()));

await p.evaluate(() => { clearInterval(window._bot); iniciarMision(3); });
await p.waitForTimeout(600);
console.log("m4 restart", JSON.stringify(await estado(p)));

await informe({ ipad: p }, OUT, "Jefes M2-M4 — entrada, fases, mecánica firma, muerte, reinicio");
await navegador.close();
srv.cerrar();
