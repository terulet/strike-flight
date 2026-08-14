// Prueba de aguante: densidad de bullet hell sostenida, fugas de memoria
// y comportamiento de la calidad automática.
//
// AVISO sobre los FPS: esto corre en Chromium sin ventana y SIN GPU, así
// que el canvas se compone por software. Los fotogramas por segundo que
// salen aquí son un suelo pesimista, NO una medida de lo que hace un
// iPad. Lo que sí es fiable es todo lo demás: conteos, reservas, fugas y
// errores.

import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const p = await abrir({ navegador }, srv, "ipad");

const medir = async () => p.evaluate(() => ({
  fps: +fps.toFixed(1),
  ene: enemies.length, eBal: eBullets.length, bal: bullets.length,
  part: particles.length, fx: efectos.length, tel: telegrafos.length,
  reservaPart: libresPart.length, reservaBala: libresBala.length,
  calidad: calidadAuto, voces,
}));

// ── 1 · Tormenta sostenida ──
await p.evaluate(() => {
  unlockAudio(); modo = "campana"; iniciarMision(0);
  golpe = () => {};
  arma = 6; armaId = "ultimate";
  // Cada segundo: una oleada de cada tipo. Mucho más de lo que la
  // campaña genera nunca.
  window._tormenta = setInterval(() => {
    for (const t of ["normal", "veloz", "torreta", "tanque", "kamikaze",
                     "bombardero", "francotirador", "portaescudos", "elite"]) {
      spawnFormacion(t, 3, "linea");
    }
  }, 1000);
});

let pico = { ene: 0, eBal: 0, part: 0, fx: 0 };
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(2500);
  const m = await medir();
  for (const k of Object.keys(pico)) pico[k] = Math.max(pico[k], m[k]);
  if (i === 5) await captura(p, OUT, "01-tormenta");
  console.log(("t+" + ((i + 1) * 2.5) + "s").padEnd(9), JSON.stringify(m));
}
console.log("PICOS", JSON.stringify(pico));

// ── 2 · Vaciado: ¿vuelve todo a la reserva? ──
await p.evaluate(() => {
  clearInterval(window._tormenta);
  enemies.length = 0; spawnQueue.length = 0; eBullets.length = 0; eventoIdx = 999;
});
await p.waitForTimeout(4000);
const limpio = await medir();
console.log("VACIADO   ", JSON.stringify(limpio));

// ── 3 · Bomba con la pantalla llena ──
await p.evaluate(() => {
  for (const t of ["normal", "veloz", "tanque", "elite"]) spawnFormacion(t, 6, "ola");
  bombas = 3;
});
await p.waitForTimeout(2200);
await p.evaluate(() => { PATRONES.circulo(W / 2, H * 0.3, 200, 60, 0, 6); usarBomba(); });
await p.waitForTimeout(180);
await captura(p, OUT, "02-bomba");
console.log("BOMBA     ", JSON.stringify(await medir()));

// ── 4 · Fin de partida ──
await p.evaluate(() => {
  golpe = window._golpeReal || golpe;
  lives = 1; escudo = 0; invulnT = 0;
});
await p.evaluate(() => { location.reload(); });
await p.waitForTimeout(1500);
await p.evaluate(() => {
  modo = "campana"; iniciarMision(0); lives = 1; escudo = 0; invulnT = 0;
  golpe();
});
await p.waitForTimeout(1400);
await captura(p, OUT, "03-fin-de-partida");
console.log("FIN       ", JSON.stringify(await estado(p)));

// ── 5 · Supervivencia sigue viva ──
await p.evaluate(() => { state = "menu"; pantalla = "mundos"; modo = "supervivencia"; T = TEMAS[3]; reset(); });
await p.waitForTimeout(6000);
await captura(p, OUT, "04-supervivencia");
console.log("SUPERV.   ", JSON.stringify(await estado(p)));

await informe({ ipad: p }, OUT, "Aguante — tormenta, vaciado, bomba, fin y supervivencia");
await navegador.close();
srv.cerrar();
