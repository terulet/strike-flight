// ════════════════════════════════════════════════════════════
//  hangar-fileurl.mjs — el Hangar abierto con doble clic
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/hangar-fileurl.mjs
//
//  La misma restricción que decide la arquitectura del audio decide la
//  del tinte de las naves: con `file://` el navegador prohíbe LEER
//  píxeles (`getImageData` lanza una excepción de seguridad en cuanto el
//  lienzo ha tocado una imagen de disco).
//
//  Por eso el compositor de skins NO lee píxeles: dibuja, aplica un
//  `source-atop` y devuelve el lienzo. Esta prueba existe para que nadie
//  lo "mejore" metiendo un `getImageData` y deje el Hangar roto justo en
//  el modo que no se prueba desde el servidor.
//
//  También se comprueba lo otro que file:// cambia: `prepararSprite` no
//  puede recortar a la caja alfa, así que los PNG tienen que venir ya
//  recortados de `preparar-naves.mjs`. Si alguien mete un PNG con margen,
//  aquí se ve como una nave más pequeña que en servidor.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = pathToFileURL(join(RAIZ, "index.html")).href;

const fallos = [];
const comprobar = (ok, t, extra) => {
  console.log((ok ? "  ok    " : "  FALLO ") + t + (extra ? "   " + extra : ""));
  if (!ok) fallos.push(t);
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });

await p.goto(url, { waitUntil: "load" });
await p.waitForTimeout(1200);

// El estado se monta EN LA PÁGINA y no sembrando localStorage + recarga:
// con file:// el origen es opaco y Chromium no conserva localStorage de
// una navegación a la siguiente, así que la semilla se perdería y la
// prueba mediría un save en blanco creyendo que mide uno lleno. Esto
// además ejercita el camino real: conceder, construir y equipar.
await p.evaluate(() => {
  SAVE.setVarios({ "campana.misionMax": MISIONES.length - 1, "campana.completada": true });
  SHIPS.otorgarPorProgreso(MISIONES.length, "chassis_03", false);
  SHIPS.guardarConfig("chassis_03", { skinId: "golden", trailId: "solar", emblemId: "dragon" });
  NAVES = SHIPS.construir("chassis_03", SAVE.get("naves.desbloqueadas", []));
  naveSel = NAVES.findIndex(n => n.id === "chassis_03");
  nvIdx = -1; trIdx = -1;
  guardarNave();
});
await p.waitForTimeout(300);

console.log("\n1 · ARRANQUE");
{
  const r = await p.evaluate(() => ({
    protocolo: location.protocol,
    naves: NAVES.length,
    equipada: NAVES[naveSel] && NAVES[naveSel].id,
    // Con la campaña terminada tiene que tener las cinco.
    libres: NAVES.filter(n => !n.bloqueada).length,
    sprites: ["chassis_01", "chassis_02", "chassis_03", "chassis_04", "chassis_05"]
      .filter(id => !!SPRITES[id]).length,
    emblemas: SHIPS.EMBLEMAS.filter(e => e.archivo && SPRITES["emb_" + e.id]).length,
    fondo: !!SPRITES.hangar_fondo,
  }));
  comprobar(r.protocolo === "file:", "se está midiendo file:// de verdad", r.protocolo);
  comprobar(r.sprites === 5, "los cinco chasis cargan sin servidor", r.sprites + "/5");
  comprobar(r.emblemas === 10, "y los diez emblemas", r.emblemas + "/10");
  comprobar(r.fondo, "y el fondo del hangar");
  comprobar(r.libres === 5, "la campaña completada abre las cinco naves", r.libres + "/5");
  comprobar(r.equipada === "chassis_03", "con la suya equipada", r.equipada);
}

console.log("\n2 · EL TINTE FUNCIONA SIN PODER LEER PÍXELES");
{
  const r = await p.evaluate(() => {
    // Primero se confirma que efectivamente NO se pueden leer píxeles:
    // si esto dejara de ser cierto, la prueba estaría midiendo otra cosa
    // y habría que enterarse.
    let lecturaProhibida = false;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const x = c.getContext("2d");
      x.drawImage(SPRITES["chassis_03"], 0, 0, 8, 8);
      x.getImageData(0, 0, 8, 8);
    } catch (e) { lecturaProhibida = true; }

    SHIPS.limpiarCache();
    const orig = SPRITES["chassis_03"];
    const comp = SHIPS.sprite("chassis_03", orig);
    return {
      lecturaProhibida,
      compuesto: comp !== orig,
      esLienzo: comp && comp.tagName === "CANVAS",
      ancho: comp && comp.width, alto: comp && comp.height,
      anchoOrig: orig.width || orig.naturalWidth,
      altoOrig: orig.height || orig.naturalHeight,
    };
  });
  comprobar(r.lecturaProhibida, "file:// sigue prohibiendo leer píxeles (es la premisa)");
  comprobar(r.compuesto && r.esLienzo, "y aun así la skin se compone");
  comprobar(r.ancho === r.anchoOrig && r.alto === r.altoOrig,
    "conservando el tamaño del sprite", `${r.ancho}×${r.alto}`);
}

console.log("\n3 · SPRITES YA RECORTADOS");
{
  // Sin `getImageData` no hay recorte automático, así que lo que se
  // dibuja es el PNG tal cual. Si viniera con margen, la proporción no
  // cuadraría con la del archivo de disco.
  // Solo los del juego NORMAL: la founder fleet no se carga si no se
  // entra en admin, y eso es a propósito.
  const r = await p.evaluate(() => SHIPS.CHASIS.filter(c => c.archivo && !c.adminOnly).map(c => {
    const sp = SPRITES[c.id];
    const w = sp.width || sp.naturalWidth, h = sp.height || sp.naturalHeight;
    return { id: c.id, w, h, lado: Math.max(w, h) };
  }));
  for (const x of r) console.log(`        ${x.id}  ${x.w}×${x.h}`);
  comprobar(r.every(x => x.lado === 512), "todos llegan a 512 en su lado mayor",
    r.map(x => x.lado).join(" "));
  comprobar(r.every(x => x.w >= 400 && x.h >= 400),
    "y ninguno trae margen transparente de sobra");
}

console.log("\n4 · EL HANGAR SE DIBUJA Y SE GUARDA");
{
  const r = await p.evaluate(async () => {
    state = "menu"; pantalla = "naves";
    for (let i = 0; i < 5; i++) await new Promise(r => requestAnimationFrame(r));
    const casillas = naveRects.length;
    HANGAR.ir("aspecto");
    const secciones = [];
    for (const s of ["skin", "estela", "emblema", "color", "nombre"]) {
      HANGAR.irSeccion(s);
      botones.length = 0;
      HANGAR.dibujar(PUENTE_HANGAR);
      secciones.push(botones.length);
    }
    // Y que guardar funcione: localStorage SÍ está disponible en file://.
    SHIPS.guardarConfig("chassis_03", { customName: "DOBLE CLIC" });
    SAVE.ya("prueba");
    const leido = JSON.parse(localStorage.getItem("sf_save"));
    return { casillas, secciones,
             guardado: leido.naves.config.chassis_03.customName };
  });
  comprobar(r.casillas === 5, "la rejilla pinta las cinco naves", r.casillas + "");
  comprobar(r.secciones.every(n => n > 8), "las cinco secciones dibujan sus controles",
    r.secciones.join(" "));
  comprobar(r.guardado === "DOBLE CLIC", "y la personalización se guarda", r.guardado);
}

await p.screenshot({ path: "artifacts/screenshots/hangar/4d-fileurl.png" });

console.log("\n5 · SIN ERRORES");
{
  // Los 404 de audio no cuentan: con file:// el navegador aborta las
  // peticiones de medios y eso ya está documentado en audio-fileurl.
  const graves = errs.filter(e => !/mp3|ogg|wav|Autoplay|play\(\)/i.test(e));
  comprobar(graves.length === 0, "ni una excepción", graves.slice(0, 3).join(" | "));
}

await nav.close();
if (fallos.length) {
  console.log("\nFALLOS: " + fallos.length);
  for (const f of fallos) console.log(" - " + f);
  process.exit(1);
}
console.log("\nTodo correcto.");
