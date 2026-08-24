import { servidor, cargarPlaywright, abrir, captura, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const pw = { navegador };
const paginas = {};

for (const disp of ["ipad", "iphone", "escritorio"]) {
  const p = await abrir(pw, srv, disp);
  paginas[disp] = p;
  const ir = async (pant, nombre) => {
    await p.evaluate((x) => { pantalla = x; }, pant);
    await p.waitForTimeout(600);
    await captura(p, OUT, nombre + "-" + disp);
  };
  await ir("inicio", "01-portada");
  await ir("naves", "02-naves");
  await ir("campana", "03-campana");
  await ir("mundos", "04-supervivencia");
  await ir("ajustes", "05-ajustes");

  // Resultados de misión
  await p.evaluate(() => {
    modo = "campana"; iniciarMision(0);
    enemiesKilled = 84; maxCombo = 37; bulletsFiredo = 900; bulletsHit = 640;
    score = 24310; elapsed = 312; lives = 3; sinDanio = true;
    eventoIdx = 999; enemies.length = 0; spawnQueue.length = 0;
    cerrarMision(); misionCompletaT = 3.6;
  });
  await p.waitForTimeout(1200);
  await captura(p, OUT, "06-resultados-" + disp);
}

await informe(paginas, OUT, "Frontal — portada, naves, campaña, ajustes y resultados");
await navegador.close();
srv.cerrar();
