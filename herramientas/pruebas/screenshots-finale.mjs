// Las capturas exactas pedidas para el informe final, con nombre propio.
import { servidor, cargarPlaywright, abrir, captura } from "../qa.mjs";

const OUT = "artifacts/screenshots/campaign-final";
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();

async function nueva() {
  const p = await abrir({ navegador }, srv, "ipad");
  await p.evaluate(() => {
    unlockAudio(); modo = "campana"; naveSel = 1; arma = 5;
    window._bot = setInterval(() => {
      if (state !== "play") return;
      targetX = miniboss ? miniboss.x : W / 2; targetY = H * 0.78;
    }, 60);
  });
  return p;
}

// M6
{
  const p = await nueva();
  await p.evaluate(() => { armaId = "misil"; iniciarMision(5); elapsed = 240; enemies.length = 0; eBullets.length = 0; });
  await p.waitForTimeout(3500);
  await captura(p, OUT, "m6-battle");
  await p.evaluate(() => { eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; spawnMiniboss("warlord_vesper"); });
  await p.waitForTimeout(1200 + 1500);
  await captura(p, OUT, "m6-command-ship");   // usa el mismo boss shot: el pod lateral se ve en dibujarExtra
  await p.waitForTimeout(2000);
  await captura(p, OUT, "m6-boss");
  await p.close();
}
// M7
{
  const p = await nueva();
  await p.evaluate(() => { armaId = "laser"; iniciarMision(6); elapsed = 90; enemies.length = 0; eBullets.length = 0; spawnPozo(W/2, H*0.46, 150, 110, 3.0); });
  await p.waitForTimeout(1600);
  await captura(p, OUT, "m7-gravity-well");
  await p.evaluate(() => { pozos.length = 0; eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; spawnMiniboss("singularity_warden"); });
  await p.waitForTimeout(1200 + 2500);
  await captura(p, OUT, "m7-boss");
  await p.close();
}
// M8
{
  const p = await nueva();
  await p.evaluate(() => { armaId = "fuego"; iniciarMision(7); elapsed = 90; enemies.length = 0; eBullets.length = 0; spawnCarril(H*0.5, 76, 2.5); });
  await p.waitForTimeout(1300);
  await captura(p, OUT, "m8-heat-lane");
  await p.evaluate(() => { carriles.length = 0; eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; spawnMiniboss("pyre_lord"); });
  await p.waitForTimeout(1200 + 2500);
  await captura(p, OUT, "m8-boss");
  await p.close();
}
// M9
{
  const p = await nueva();
  await p.evaluate(() => { armaId = "railgun"; iniciarMision(8); elapsed = 5; enemies.length = 0; eBullets.length = 0; });
  await p.waitForTimeout(1000);
  await captura(p, OUT, "m9-core-system");
  await p.evaluate(() => { eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; spawnMiniboss("core_architect"); });
  await p.waitForTimeout(1200 + 2500);
  await captura(p, OUT, "m9-boss");
  await p.close();
}
// M10 — acto por acto y las 4 fases del jefe final
{
  const p = await nueva();
  await p.evaluate(() => { armaId = "void"; iniciarMision(9); elapsed = 40; enemies.length = 0; eBullets.length = 0; });
  await p.waitForTimeout(2200);
  await captura(p, OUT, "m10-approach");

  await p.evaluate(() => { elapsed = 180; enemies.length = 0; eBullets.length = 0; });
  await p.waitForTimeout(2200);
  await captura(p, OUT, "m10-gauntlet");

  await p.evaluate(() => { elapsed = 302; enemies.length = 0; eBullets.length = 0; });
  await p.waitForTimeout(2200);
  await captura(p, OUT, "m10-preboss");

  await p.evaluate(() => { eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; arma = 6; spawnMiniboss("omega_sovereign"); });
  await p.waitForTimeout(700);
  await captura(p, OUT, "m10-final-boss-entry");
  await p.waitForTimeout(1200 + 1800);
  await captura(p, OUT, "m10-phase1");

  await p.evaluate(() => { if (miniboss) miniboss.hp = miniboss.hpMax * 0.68; });
  await p.waitForTimeout(2200);
  await captura(p, OUT, "m10-phase2");

  await p.evaluate(() => { if (miniboss) miniboss.hp = miniboss.hpMax * 0.38; });
  await p.waitForTimeout(2200);
  await captura(p, OUT, "m10-phase3");

  await p.evaluate(() => { if (miniboss) miniboss.hp = miniboss.hpMax * 0.14; });
  await p.waitForTimeout(1400);
  await captura(p, OUT, "m10-final-strike");

  await p.evaluate(() => { if (miniboss) miniboss.hp = 1; });
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(500);
    const b = await p.evaluate(() => miniboss ? miniboss.est : null);
    if (b === "muriendo") { await p.waitForTimeout(1600); break; }
  }
  await captura(p, OUT, "m10-death");
  await p.close();
}
// Campaña completada
{
  const p = await nueva();
  await p.evaluate(() => {
    misionIdx = 9; iniciarMision(9);
    score = 96000; enemiesKilled = 210; maxCombo = 62; bulletsFiredo = 1400; bulletsHit = 990;
    eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0;
    campaignCompleted = true;
    campaignStats = { score, best: score, enemiesKilled, maxCombo,
      precision: Math.round(bulletsHit / bulletsFiredo * 100), tiempo: 612, nave: NAVES[naveSel].nombre };
    guardarSave({ campaignCompleted: true, campaignStats, record: score });
    state = "menu"; pantalla = "campana-completa";
  });
  await p.waitForTimeout(600);
  await captura(p, OUT, "m10-campaign-complete");
  await p.close();
}

await navegador.close();
srv.cerrar();
console.log("listo");
