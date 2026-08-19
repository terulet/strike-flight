// ════════════════════════════════════════════════════════════
//  premios.mjs — cada premio tiene que enseñar SU icono, no un
//                cristal de repuesto
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/premios.mjs
//
//  Existe por una regresión de verdad: bajo una conexión lenta, los
//  bloques 5D/5E/5F/5G habían puesto ~6,6 MB de arte de la expansión
//  —diez enemigos, seis hazards, cinco minijefes— delante de los
//  power-ups en la cola de carga, sin que ninguna misión jugable use
//  todavía ese arte. El síntoma es exactamente el fallback vectorial de
//  `dibujarPremio()`: un cristal facetado de seis puntas que, en un
//  icono pequeño, se lee como un triángulo genérico.
//
//  El arreglo (bloque `index.html`: `asegurarSpriteEnemigo/Hazard/Jefe`)
//  hace que ese arte se pida BAJO DEMANDA —como ya hacían los fondos
//  desde el bloque 5D— así que una partida de M1-M10 nunca lo pide y no
//  le quita ancho de banda a nada. Esta prueba comprueba el síntoma
//  directamente: que los DIECISÉIS premios resuelven un sprite de
//  verdad, no que la teoría de la causa sea cierta.
//
//  Nada de esto toca probabilidades de drop, efectos, duración,
//  estadísticas, audio ni economía — solo lee `PREMIOS` y `SPRITES`.

import { servidor, cargarPlaywright } from "../qa.mjs";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const srv = await servidor();
const { chromium: cr } = await cargarPlaywright();
const nav = await cr.launch();

// ════════════════════════════════════════════════════════════
console.log("\n1 · LOS DIECISÉIS PREMIOS RESUELVEN SU SPRITE (servidor local)");
{
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = [];
  const p404 = [];
  p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
  p.on("response", r => { if (r.status() === 404) p404.push(r.url().replace(srv.url, "")); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  // Sin esperas largas ni trucos: si un premio necesita 20 s en una
  // conexión de verdad para tener su sprite, el juego tiene que
  // pedirlo con margen — no que la prueba le regale ese margen.
  await p.waitForTimeout(1500);

  const r = await p.evaluate(() => {
    const tipos = Object.keys(PREMIOS);
    return tipos.map(t => {
      const d = PREMIOS[t];
      const sp = SPRITES[d.sp];
      return { tipo: t, spId: d.sp, resuelto: !!sp, w: sp ? (sp.naturalWidth || sp.width || 0) : 0 };
    });
  });
  comprobar(r.length === 16, "hay 16 tipos de premio en PREMIOS", r.length + "");
  for (const item of r) {
    console.log(`        ${item.tipo.padEnd(10)} → ${item.spId.padEnd(14)} ${item.resuelto ? "sprite " + item.w + "px" : "SIN SPRITE"}`);
    comprobar(item.resuelto && item.w > 0,
      "★ " + item.tipo + ": resuelve un sprite de verdad, no el cristal de repuesto",
      item.resuelto ? item.w + "px" : "SPRITES." + item.spId + " es undefined");
  }
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  comprobar(!p404.length, "sin 404", p404.slice(0, 5).join(" ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n2 · CADA PREMIO SUELTO EN PARTIDA SE PINTA CON SU SPRITE (no el fallback)");
{
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(1200);

  const r = await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 250));
    state = "play"; paused = false;
    premios.length = 0;
    const tipos = Object.keys(PREMIOS);
    // Uno de cada, en fila, ya "nacido" (sin la animación de entrada)
    // para medir el dibujo en régimen normal.
    tipos.forEach((t, i) => {
      soltarPremio(60 + i * 46, 200, t);
      const pr = premios[premios.length - 1];
      pr.nace = 0; pr.t = 0.6;
    });
    for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r));
    // "Cae al fallback" en código es exactamente esto: dibujarPremio()
    // resuelve `SPRITES[d.sp]` como falsy. Se comprueba el mismo dato
    // que consulta el renderer, no una lectura de píxeles indirecta.
    return premios.map(pr => {
      const d = PREMIOS[pr.tipo];
      return { tipo: pr.tipo, x: pr.x, y: pr.y, tieneSprite: !!SPRITES[d.sp] };
    });
  });
  comprobar(r.length === 16, "los 16 premios se sueltan a la vez sin chocar con el tope", r.length + "");
  comprobar(r.every(x => x.tieneSprite),
    "★ ninguno de los 16, ya en pantalla, cae al fallback genérico",
    r.filter(x => !x.tieneSprite).map(x => x.tipo).join(",") || "ninguno en fallback");

  // Captura comparativa: los 16 premios visibles a la vez.
  const dest = join(RAIZ, "artifacts", "screenshots", "premios");
  await p.evaluate(() => new Promise(r => setTimeout(r, 50)));
  await import("node:fs/promises").then(fs => fs.mkdir(dest, { recursive: true }));
  await p.screenshot({ path: join(dest, "premios-16-servidor.png") });
  console.log("        captura: artifacts/screenshots/premios/premios-16-servidor.png");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n3 · FILE:// — DOBLE CLIC, SIN SERVIDOR");
{
  // Mismo motivo que hangar-fileurl.mjs: es el modo en que el juego
  // tiene que arrancar sin nada montado, y el que menos se prueba.
  const url = pathToFileURL(join(RAIZ, "index.html")).href;
  const ctxF = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  const pf = await ctxF.newPage();
  const errsF = [];
  pf.on("pageerror", e => errsF.push("EXCEPCION " + e.message));
  pf.on("console", m => { if (m.type() === "error") errsF.push("CONSOLE " + m.text()); });
  await pf.goto(url, { waitUntil: "load" });
  await pf.waitForTimeout(1800);

  const r = await pf.evaluate(() => Object.keys(PREMIOS).map(t => {
    const d = PREMIOS[t];
    const sp = SPRITES[d.sp];
    return { tipo: t, resuelto: !!sp };
  }));
  comprobar(r.every(x => x.resuelto),
    "★ los 16 premios resuelven sprite también con file://",
    r.filter(x => !x.resuelto).map(x => x.tipo).join(",") || "ninguno en fallback");
  comprobar(!errsF.length, "sin errores JS en file://", errsF.slice(0, 5).join(" | ") || "ninguno");
  await ctxF.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n4 · PROXY DE IPAD/SAFARI (viewport + táctil de iPad, motor Chromium)");
{
  // Esta suite no tiene Safari de verdad disponible —ningún test de este
  // repo lo tiene—: el proxy establecido en todo el proyecto es Chromium
  // con viewport y `hasTouch`/`isMobile` de iPad, que es lo que ya usan
  // el resto de pruebas para "iPad". Se deja dicho aquí para no dar a
  // entender que esto sustituye una comprobación en Safari real.
  const ctx = await nav.newContext({ viewport: { width: 834, height: 1194 }, hasTouch: true, isMobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15" });
  const p = await ctx.newPage();
  const errs = [];
  const p404 = [];
  p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
  p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
  p.on("response", r => { if (r.status() === 404) p404.push(r.url().replace(srv.url, "")); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => Object.keys(PREMIOS).map(t => !!SPRITES[PREMIOS[t].sp]));
  comprobar(r.every(Boolean), "★ los 16 premios resuelven sprite en viewport de iPad", r.filter(x => !x).length + " sin resolver");
  comprobar(!errs.length, "sin errores JS", errs.slice(0, 5).join(" | ") || "ninguno");
  comprobar(!p404.length, "sin 404", p404.slice(0, 5).join(" ") || "ninguno");
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n5 · LA EXPANSIÓN YA NO COMPITE POR ANCHO DE BANDA EN M1-M10");
{
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 } });
  const p = await ctx.newPage();
  const peticionesExpansion = [];
  const patron = /hz_tempano|hz_trafico|hz_mina_bio|hz_colada|hz_fragmento|sierra_hielo|prisma\.png|patrulla\.png|torre_neon|medusa\.png|sembrador|crisol\.png|martillo\.png|rompedor\.png|eco\.png|cazador_polar|unidad_control|guardian_ruina|yunque_movil|heraldo_grieta/;
  p.on("requestfinished", r => { if (patron.test(r.url())) peticionesExpansion.push(r.url()); });
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 400));
  });
  await p.waitForTimeout(600);
  comprobar(peticionesExpansion.length === 0,
    "★ jugar M1 no pide NI UN sprite de la expansión (5D/5E/5F/5G)",
    peticionesExpansion.length + " peticiones: " + peticionesExpansion.slice(0, 3).join(", "));
  await ctx.close();
}

// ════════════════════════════════════════════════════════════
console.log("\n6 · PERO SIGUE DISPONIBLE BAJO DEMANDA (ADMIN, futuras M11-M20)");
{
  const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
  await p.goto(srv.url + "/index.html", { waitUntil: "load" });
  await p.waitForTimeout(900);
  const r = await p.evaluate(async () => {
    OPCIONES.vfx = "alto"; aplicarVFX();
    modo = "campana"; iniciarMision(0);
    await new Promise(r => setTimeout(r, 250));
    enemies.length = 0; hazards.length = 0; miniboss = null;
    spawnEnemy("sierra_hielo", 100);
    hazardTipo = "tempano"; spawnHazard();
    spawnMiniboss("cazador_polar", 1);
    for (let i = 0; i < 5; i++) await new Promise(r => requestAnimationFrame(r));
    return { e: !!SPRITES.e_sierra_hielo, h: !!SPRITES.hz_tempano, b: !!SPRITES.bs_cazador_polar };
  });
  comprobar(r.e, "spawnEnemy pide el sprite de un enemigo de la expansión al usarlo", JSON.stringify(r));
  comprobar(r.h, "spawnHazard hace lo mismo con un hazard de la expansión");
  comprobar(r.b, "spawnMiniboss hace lo mismo con un jefe de la expansión");
  comprobar(!errs.length, "sin errores JS", errs.join(" | ") || "ninguno");
  await ctx.close();
}

await nav.close();
srv.cerrar();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
