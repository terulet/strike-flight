// Ciclo de vida del audio. Chromium arranca el AudioContext ya en
// "running" salvo que se le prohíba, así que la prueba se lanza con la
// política de autoplay estricta: así el contexto nace SUSPENDIDO, que es
// lo que pasa en Safari/iOS, y se puede comprobar de verdad que el
// desbloqueo por gesto funciona.
//
//   node herramientas/pruebas/audio.mjs [destino]

import { servidor, cargarPlaywright, captura } from "../qa.mjs";

const OUT = process.argv[2] || "artifacts/screenshots/audio";
const srv = await servidor();
const { chromium } = await cargarPlaywright();

// --autoplay-policy=document-user-activation-required reproduce la
// condición de iOS: nada suena hasta que el usuario toca.
const navegador = await chromium.launch({
  args: ["--autoplay-policy=document-user-activation-required"],
});
const ctx = await navegador.newContext({
  viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", e => errores.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errores.push("CONSOLE " + m.text()); });
await p.goto(srv.url + "?debug", { waitUntil: "load" });
await p.waitForTimeout(1200);

const estado = () => p.evaluate(() => ({
  ctx: audio ? audio.state : null,
  listo: audioListo,
  master: BUS.master ? +BUS.master.gain.value.toFixed(2) : null,
  sfxG: BUS.sfx ? +BUS.sfx.gain.value.toFixed(2) : null,
  mute: OPCIONES.silencio,
  intentos: audioDbg.intentos, ok: audioDbg.ok, fallos: audioDbg.fallos,
  motivo: audioDbg.motivo, ultimo: audioDbg.ultimo,
}));

const paso = async (nombre) => console.log(nombre.padEnd(30), JSON.stringify(await estado()));

// 1 · Página cargada, SIN interacción. El contexto no debe existir aún.
await paso("1 sin interaccion");

// 2 · Pedir sonido antes del desbloqueo: tiene que ser inofensivo.
await p.evaluate(() => { sfx("ui_ok"); sfx("exp_med"); });
await paso("2 sfx antes de desbloquear");

// 3 · Primera interacción real (toque de verdad, no evaluate).
await p.mouse.click(410, 900);
await p.waitForTimeout(600);
await paso("3 tras primer toque");

// 4 · Sonido después del desbloqueo.
await p.evaluate(() => sfx("mejora"));
await p.waitForTimeout(200);
await paso("4 sfx tras desbloqueo");

// 5 · Suspender a mano (equivale a irse a otra app en iOS) y volver.
await p.evaluate(() => audio.suspend());
await p.waitForTimeout(300);
await paso("5 suspendido a mano");

await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.waitForTimeout(600);
await paso("6 tras visibilitychange");

// 7 · Si aún no ha vuelto, el siguiente gesto tiene que levantarlo.
await p.mouse.click(410, 900);
await p.waitForTimeout(600);
await paso("7 tras gesto posterior");

// 8 · Mute / unmute por los ajustes.
await p.evaluate(() => { OPCIONES.silencio = true; aplicarVolumenes(); });
await paso("8 mute");
await p.evaluate(() => { OPCIONES.silencio = false; aplicarVolumenes(); });
await paso("9 unmute");

// 10 · Un guardado corrupto con volúmenes a 0 no puede dejar el juego mudo.
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("sf_save") || "{}");
  s.opciones = Object.assign({}, s.opciones, { volMaster: 0, volSfx: 0 });
  localStorage.setItem("sf_save", JSON.stringify(s));
});
await p.reload({ waitUntil: "load" });
await p.waitForTimeout(900);
await p.mouse.click(410, 900);
await p.waitForTimeout(500);
await paso("10 save con vol 0");

// 11 · El botón PROBAR SONIDO de los ajustes.
await p.evaluate(() => { state = "menu"; pantalla = "ajustes"; });
await p.waitForTimeout(400);
await captura(p, OUT, "ajustes-probar-sonido");
const btn = await p.evaluate(() => {
  const b = botones[botones.length - 1];
  return b ? { x: b.x + PX + b.w / 2, y: b.y + b.h / 2 } : null;
});
if (btn) { await p.mouse.click(btn.x, btn.y); await p.waitForTimeout(400); }
await paso("11 tras PROBAR SONIDO");

await p.evaluate(() => { state = "play"; });
await p.waitForTimeout(300);
await captura(p, OUT, "debug-overlay-audio");

console.log("\nerrores:", errores.length ? errores.join(" | ") : "ninguno");
await navegador.close();
srv.cerrar();
