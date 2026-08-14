// Partida entera de una misión, en tiempo real y con un piloto automático
// que esquiva de verdad. Sirve para dos cosas que ninguna otra prueba da:
// cuánto DURA la misión de principio a fin, y si se puede terminar.
//
//   node herramientas/pruebas/mision-completa.mjs <destino> [misión 1-5]

import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2];
const MIS = Number(process.argv[3] || 1) - 1;
// Con --inmune el piloto no muere: sirve para medir la DURACIÓN de la
// misión de principio a fin, que es lo que no se puede saber de otra forma.
const INMUNE = process.argv.includes("--inmune");
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const p = await abrir({ navegador }, srv, "ipad");

await p.evaluate(({ mis, inmune }) => {
  unlockAudio(); modo = "campana"; naveSel = 1; iniciarMision(mis);
  if (inmune) golpe = () => {};
  // Piloto automático: busca la columna más despejada de la mitad
  // inferior y se va a ella. No es bueno, pero esquiva.
  window._bot = setInterval(() => {
    if (state !== "play") return;
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
      d -= Math.abs(x - player.x) * 0.08;          // prefiere no cruzar la pantalla
      if (d > mejorD) { mejorD = d; mejor = x; }
    }
    targetX = mejor;
    targetY = H * 0.8;
    if (bombas > 0 && eBullets.length > 150) usarBomba();
  }, 55);
}, { mis: MIS, inmune: INMUNE });

const t0 = Date.now();
let ultimo = null, capturas = 0;
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(3000);
  const e = await estado(p);
  ultimo = e;
  if (i % 10 === 0) console.log((((Date.now() - t0) / 1000) | 0) + "s", JSON.stringify(e));
  if (e.boss && capturas < 1) { capturas++; await captura(p, OUT, "boss-m" + (MIS + 1)); }
  if (e.state !== "play") break;
  const fin = await p.evaluate(() => misionCompletaT > 0);
  if (fin) { await captura(p, OUT, "final-m" + (MIS + 1)); break; }
}
console.log("\nDURACIÓN REAL:", (((Date.now() - t0) / 1000) | 0) + "s",
  "· estado:", JSON.stringify(ultimo));

await informe({ ipad: p }, OUT, "Misión " + (MIS + 1) + " de principio a fin");
await navegador.close();
srv.cerrar();
