// Cuánto dura cada combate de jefe con un piloto que SÍ apunta.
//
// El piloto de mision-completa.mjs busca la columna más despejada, que
// durante un combate de jefe significa lejos del jefe: mide bien el
// tránsito de la misión y fatal el combate. Éste se coloca debajo del
// jefe, que es lo que hace un jugador de verdad.

import { servidor, cargarPlaywright, abrir, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();

const CASOS = [
  ["M1 Guardián", 0, "guardian", 1,    "cannon",  4],
  ["M5 Titán",    4, "titan",    1,    "cryo",    6],
];

const paginas = {};
for (const [nombre, mis, jefe, mult, ar, niv] of CASOS) {
  const p = await abrir({ navegador }, srv, "ipad");
  paginas[nombre + " " + ar] = p;
  await p.evaluate(({ mis, jefe, mult, ar, niv }) => {
    unlockAudio(); modo = "campana"; iniciarMision(mis);
    golpe = () => {};
    eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
    armaId = ar; arma = niv;
    window._bot = setInterval(() => {
      if (state !== "play") return;
      if (upgradesOfrecidos) { elegirUpgrade(upgradesOfrecidos.opciones[0]); return; }
      targetX = miniboss ? miniboss.x : W / 2;
      targetY = H * 0.78;
      arma = niv; armaId = ar;      // sin premios que lo cambien
    }, 50);
    spawnMiniboss(jefe, mult);
  }, { mis, jefe, mult, ar, niv });

  let t0 = null, seg = null, hpMax = null;
  for (let i = 0; i < 140; i++) {
    await p.waitForTimeout(1500);
    const st = await p.evaluate(() => miniboss
      ? { hp: miniboss.hp, max: miniboss.hpMax, est: miniboss.est } : null);
    if (!st) { seg = t0 ? (Date.now() - t0) / 1000 : null; break; }
    hpMax = st.max;
    if (st.est === "combate" && t0 === null) t0 = Date.now();
    if (st.est === "muriendo") { seg = (Date.now() - t0) / 1000; break; }
  }
  const juego = await p.evaluate(() => elapsed);
  console.log(
    (nombre + " · " + ar + " nivel " + niv).padEnd(34),
    String(hpMax).padStart(5) + " HP →",
    seg === null ? "NO MUERE en 210 s" : seg.toFixed(0) + " s de reloj · " + juego.toFixed(0) + " s de juego"
  );
  await p.close();
}

await informe(paginas, OUT, "Duración de los combates de jefe");
await navegador.close();
srv.cerrar();
