// Una pasada visual por las cinco misiones en sus momentos característicos,
// para ver que cada una se distingue de las demás de un vistazo.

import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const p = await abrir({ navegador }, srv, "ipad");

// Momentos elegidos: donde la mecánica propia de cada misión está activa.
const MOMENTOS = [
  [0, [30, 100, 180], "primer-contacto"],
  [1, [20, 95, 160], "asteroides"],
  [2, [35, 100, 205], "defensa"],
  [3, [25, 100, 180], "toxico"],
  [4, [40, 120, 215], "fisura"],
];

for (const [mis, tiempos, slug] of MOMENTOS) {
  for (let i = 0; i < tiempos.length; i++) {
    await p.evaluate(({ mis, t }) => {
      unlockAudio(); modo = "campana"; naveSel = 3; iniciarMision(mis);
      golpe = () => {};
      arma = 4;
      elapsed = t - 6;
      // Se deja correr 6 s de juego real desde 6 s antes del momento, para
      // que las oleadas entren de forma natural en vez de amontonarse.
    }, { mis, t: tiempos[i] });
    await p.waitForTimeout(6500);
    await captura(p, OUT, "m" + (mis + 1) + "-" + slug + "-" + tiempos[i] + "s");
    console.log(("M" + (mis + 1) + " " + tiempos[i] + "s").padEnd(10), JSON.stringify(await estado(p)));
  }
}

await informe({ ipad: p }, OUT, "Las cinco misiones en sus momentos característicos");
await navegador.close();
srv.cerrar();
