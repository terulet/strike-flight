// Las pantallas que se cruzan durante una partida: entrada de misión,
// pausa y fin de partida. Y que sus botones funcionan de verdad.

import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const p = await abrir({ navegador }, srv, "ipad");

const tocar = async (etiqueta) => {
  const r = await p.evaluate((et) => {
    // Los botones no guardan su etiqueta, así que se localiza por posición
    // conocida: el índice dentro de botones[] es estable por pantalla.
    const b = botones[et];
    if (!b) return null;
    return { x: b.x + PX + b.w / 2, y: b.y + b.h / 2 };
  }, etiqueta);
  if (!r) throw new Error("no hay botón " + etiqueta);
  await p.mouse.click(r.x, r.y);
  await p.waitForTimeout(500);
};

await p.evaluate(() => { unlockAudio(); modo = "campana"; iniciarMision(0); });
await p.waitForTimeout(700);
await captura(p, OUT, "01-entrada-mision");
console.log("entrada  ", JSON.stringify(await estado(p)));

await p.waitForTimeout(3000);
await p.evaluate(() => { paused = true; });
await p.waitForTimeout(400);
await captura(p, OUT, "02-pausa");

// AJUSTES desde la pausa y vuelta: la partida tiene que seguir donde estaba
const antes = await p.evaluate(() => ({ t: elapsed, ene: enemies.length }));
await tocar(1);
await p.waitForTimeout(600);
await captura(p, OUT, "03-ajustes-desde-pausa");
await tocar(0);   // flecha de volver
await p.waitForTimeout(400);
const despues = await p.evaluate(() => ({ t: elapsed, ene: enemies.length, st: state, pa: paused }));
console.log("ida y vuelta a ajustes:", JSON.stringify(antes), "→", JSON.stringify(despues));
await captura(p, OUT, "04-vuelta-a-pausa");

// Continuar
await tocar(0);
console.log("tras continuar:", JSON.stringify(await estado(p)));

// Fin de partida
await p.evaluate(() => { lives = 1; escudo = 0; invulnT = 0; golpe(); });
await p.waitForTimeout(1400);
await captura(p, OUT, "05-fin-de-partida");
console.log("fin      ", JSON.stringify(await estado(p)));

// Reintentar
await tocar(0);
await p.waitForTimeout(900);
console.log("reintento", JSON.stringify(await estado(p)));
await captura(p, OUT, "06-reintento");

await informe({ ipad: p }, OUT, "Pantallas de partida");
await navegador.close();
srv.cerrar();
