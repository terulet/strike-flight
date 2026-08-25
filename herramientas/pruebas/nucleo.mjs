import { servidor, cargarPlaywright, abrir, captura, estado, informe } from "../qa.mjs";

const OUT = process.argv[2];
const srv = await servidor();
const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const pw = { navegador };

const ipad = await abrir(pw, srv, "ipad");
await captura(ipad, OUT, "01-menu-ipad");
console.log("menu:", JSON.stringify(await estado(ipad)));

// entrar a M1
await ipad.evaluate(() => { unlockAudio(); modo = "campana"; iniciarMision(0); });
await ipad.waitForTimeout(6000);
await captura(ipad, OUT, "02-m1-6s");
console.log("6s:", JSON.stringify(await estado(ipad)));

await ipad.evaluate(() => { elapsed = 40; });
await ipad.waitForTimeout(6000);
await captura(ipad, OUT, "03-m1-46s");
console.log("46s:", JSON.stringify(await estado(ipad)));

const escritorio = await abrir(pw, srv, "escritorio");
await escritorio.evaluate(() => { modo = "campana"; iniciarMision(0); });
await escritorio.waitForTimeout(5000);
await captura(escritorio, OUT, "04-escritorio-marco");
console.log("desktop:", JSON.stringify(await estado(escritorio)));

const iphone = await abrir(pw, srv, "iphone");
await captura(iphone, OUT, "05-menu-iphone");

await informe({ ipad, escritorio, iphone }, OUT, "Prueba núcleo premium");
await navegador.close();
srv.cerrar();
