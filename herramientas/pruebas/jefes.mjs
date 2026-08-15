import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const pw = { navegador };
const p = await abrir(pw, srv, "ipad");

const paso = async (nombre, seg) => {
  await p.waitForTimeout(seg * 1000);
  await captura(p, OUT, nombre);
  console.log(nombre.padEnd(28), JSON.stringify(await estado(p)));
  if (p.errores.length) console.log("   !!", p.errores.slice(-2).join(" | "));
};

// GUARDIÁN — la secuencia completa
await p.evaluate(() => {
  unlockAudio(); modo = "campana"; naveSel = 1; iniciarMision(0);
  golpe = () => {};   // el guion no esquiva: aquí interesa la puesta en escena
  arma = 4; armaId = "cannon";
  elapsed = 208;
  // El salto de reloj dispara de golpe todo el guion previo: se limpia
  // para que la captura muestre el jefe, no una pila de 90 cazas.
  setTimeout(() => { enemies.length = 0; spawnQueue.length = 0; }, 900);
});
await paso("01-aviso-jefe", 1.2);
await paso("02-entrada", 2.2);
await paso("03-fase1", 3.0);
await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.52; });
await paso("04-transicion", 2.0);
await paso("05-fase2", 3.0);
await p.evaluate(() => { miniboss.hp = 1; });
await paso("06-muerte-fallos", 1.4);
await paso("07-muerte-detonacion", 1.0);
await paso("08-victoria", 2.0);

// TITÁN — M5, fase final
await p.evaluate(() => {
  iniciarMision(4); arma = 6; armaId = "cryo"; elapsed = 250;   // el Titán entra en t=256
  golpe = () => {};
  setTimeout(() => { enemies.length = 0; spawnQueue.length = 0; }, 900);
});
await paso("09-titan-aviso", 3.2);
await paso("10-titan-fase1", 3.0);
await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.63; });
await paso("11-titan-fase2", 3.0);
await p.evaluate(() => { miniboss.hp = miniboss.hpMax * 0.29; });
await paso("12-titan-fase-final", 4.0);

await informe({ ipad: p }, OUT, "Jefes — arquitectura de acontecimiento");
await navegador.close();
srv.cerrar();
