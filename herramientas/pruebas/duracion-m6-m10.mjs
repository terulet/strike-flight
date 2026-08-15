import { servidor, cargarPlaywright, abrir, informe } from "../qa.mjs";

const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();

const CASOS = [
  ["M6 Warlord Vesper",     5, "warlord_vesper",     "misil",  5],
  ["M7 Singularity Warden", 6, "singularity_warden", "laser",  5],
  ["M8 Pyre Lord",          7, "pyre_lord",           "rapid",  5],
  ["M9 Core Architect",     8, "core_architect",      "railgun",4],
];

const paginas = {};
for (const [nombre, mis, jefe, ar, niv] of CASOS) {
  const p = await abrir({ navegador }, srv, "ipad");
  paginas[nombre] = p;
  await p.evaluate(({ mis, jefe, ar, niv }) => {
    unlockAudio(); modo = "campana"; iniciarMision(mis);
    golpe = () => {};
    eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
    armaId = ar; arma = niv;
    window._bot = setInterval(() => {
      if (state !== "play") return;
      targetX = miniboss ? miniboss.x : W / 2;
      targetY = H * 0.78;
      arma = niv; armaId = ar;
    }, 50);
    spawnMiniboss(jefe);
  }, { mis, jefe, ar, niv });

  let t0 = null, seg = null, hpMax = null;
  for (let i = 0; i < 160; i++) {
    await p.waitForTimeout(1200);
    const st = await p.evaluate(() => miniboss
      ? { hp: miniboss.hp, max: miniboss.hpMax, est: miniboss.est } : null);
    if (!st) { seg = t0 ? (Date.now() - t0) / 1000 : null; break; }
    hpMax = st.max;
    if (st.est === "combate" && t0 === null) t0 = Date.now();
    if (st.est === "muriendo") { seg = (Date.now() - t0) / 1000; break; }
  }
  console.log(
    (nombre + " · " + ar + " nivel " + niv).padEnd(36),
    String(hpMax).padStart(5) + " HP →",
    seg === null ? "NO MUERE en 190 s" : seg.toFixed(0) + " s de combate"
  );
  await p.close();
}

await informe(paginas, "artifacts/screenshots/campaign-final", "Duración de combate M6-M10");
await navegador.close();
srv.cerrar();
