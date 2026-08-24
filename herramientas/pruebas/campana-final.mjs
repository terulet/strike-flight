// Recorre M6-M10 por checkpoints (saltando el reloj, limpiando lo que
// sobre de antes) y comprueba que cada evento de misión — sistemas,
// pozos, carriles, comandos, drones — funciona sin errores. Al final de
// cada una, fuerza el jefe y comprueba muerte + limpieza.

import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2] || "artifacts/screenshots/campaign-final";
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();

const MISIONES_TEST = [
  { idx: 5, slug: "m6", jefe: "warlord_vesper",     checks: [30, 100, 190, 270] },
  { idx: 6, slug: "m7", jefe: "singularity_warden", checks: [30, 90, 160, 230] },
  { idx: 7, slug: "m8", jefe: "pyre_lord",          checks: [30, 90, 160, 220] },
  { idx: 8, slug: "m9", jefe: "core_architect",     checks: [10, 90, 160, 230] },
  { idx: 9, slug: "m10", jefe: "omega_sovereign",   checks: [30, 160, 260, 320] },
];

const paginas = {};
for (const m of MISIONES_TEST) {
  const p = await abrir(navegador ? { navegador } : null, srv, "ipad");
  paginas[m.slug] = p;
  await p.evaluate(({ idx }) => {
    unlockAudio(); modo = "campana"; naveSel = 1; iniciarMision(idx);
    golpe = () => {};
    window._bot = setInterval(() => {
      if (state !== "play") return;
      // Bloque 6G: UPGRADE READY congela el juego hasta que alguien
      // toca una tarjeta; este piloto mueve targetX/Y a mano, sin
      // pointerdown real, así que se elige la primera opción él mismo.
      if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
      // Esquiva hacia la columna con menos amenazas cerca.
      let mejor = player.x, mejorD = -1;
      for (let i = 0; i < 22; i++) {
        const x = 26 + (W - 52) * i / 21;
        let d = 1e9;
        for (const b of eBullets) if (b.y > player.y - 260) d = Math.min(d, Math.abs(b.x - x));
        for (const e of enemies) if (e.y > player.y - 220) d = Math.min(d, Math.abs(e.x - x) * 0.7);
        d -= Math.abs(x - player.x) * 0.05;
        if (d > mejorD) { mejorD = d; mejor = x; }
      }
      targetX = mejor; targetY = H * 0.8;
    }, 55);
  }, { idx: m.idx });

  for (let i = 0; i < m.checks.length; i++) {
    await p.evaluate((t) => { elapsed = t; enemies.length = 0; eBullets.length = 0; }, m.checks[i]);
    await p.waitForTimeout(3500);
    await captura(p, OUT, m.slug + "-checkpoint-" + (i + 1));
    const st = await estado(p);
    console.log((m.slug + " t=" + m.checks[i]).padEnd(14), JSON.stringify(st));
  }

  // Forzar el jefe directamente y comprobar la pelea + muerte + limpieza
  await p.evaluate(({ jefe }) => {
    eventoIdx = 9999; enemies.length = 0; spawnQueue.length = 0; eBullets.length = 0;
    spawnMiniboss(jefe);
  }, { jefe: m.jefe });
  await p.waitForTimeout(1200 + 2000);
  await captura(p, OUT, m.slug + "-boss");
  console.log((m.slug + " jefe").padEnd(14), JSON.stringify(await estado(p)));

  await p.evaluate(() => { if (miniboss) miniboss.hp = 1; });
  for (let i = 0; i < 25; i++) {
    await p.waitForTimeout(400);
    const b = await p.evaluate(() => miniboss ? miniboss.est : null);
    if (b === null) break;
  }
  await captura(p, OUT, m.slug + "-boss-muerte");
  const limpio = await p.evaluate(() => ({
    eBal: eBullets.length, bal: bullets.length, rocas: rocas.length, zonas: zonas.length,
    pozos: pozos.length, carriles: carriles.length, sistemas: sistemas.filter(s=>s.vivo).length,
    telegrafos: telegrafos.length, boss: !!miniboss,
  }));
  console.log((m.slug + " limpieza").padEnd(14), JSON.stringify(limpio));
  await p.evaluate(() => clearInterval(window._bot));
}

await informe(paginas, OUT, "Campaña M6-M10 por checkpoints + jefes");
await navegador.close();
srv.cerrar();
