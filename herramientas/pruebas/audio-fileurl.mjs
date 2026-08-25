// ════════════════════════════════════════════════════════════
//  audio-fileurl.mjs — el juego abierto con doble clic
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/audio-fileurl.mjs
//
//  La restricción que decide toda la arquitectura del audio: FLIGHT
//  STRIKE tiene que funcionar abriendo index.html con doble clic, sin
//  servidor. Con file:// el navegador prohíbe fetch(), y por eso el
//  juego no tenía ni un archivo de sonido: cargar un .mp3 con fetch()
//  desde disco no funciona nunca.
//
//  La solución es el <script src> clásico, que sí se permite. Esta
//  prueba existe para que nadie lo "mejore" volviendo a fetch() sin
//  darse cuenta de que deja mudo el juego fuera del servidor.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const url = pathToFileURL(join(RAIZ, "index.html")).href;

const nav = await chromium.launch({ args: ["--autoplay-policy=document-user-activation-required"] });
const ctx = await nav.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push("EXCEPCION " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });

await p.goto(url, { waitUntil: "load" });
await p.waitForTimeout(700);

const pre = await p.evaluate(() => ({
  banco: !!(window.SFX_MUESTRAS && window.SFX_MUESTRAS.d),
  ids: window.SFX_MUESTRAS ? Object.keys(window.SFX_MUESTRAS.d).length : 0,
}));

await p.mouse.click(410, 900);
await p.waitForFunction(
  () => muestrasDbg.total > 0 && muestrasDbg.listas + muestrasDbg.fallo >= muestrasDbg.total,
  null, { timeout: 60000 }).catch(() => {});

const post = await p.evaluate(() => {
  sfx("exp_boss");
  return { ctx: audio && audio.state, listas: muestrasDbg.listas,
    total: muestrasDbg.total, fallo: muestrasDbg.fallo, state,
    conMuestra: Object.keys(SONIDOS).filter(k => MUESTRAS[k] && MUESTRAS[k].bufs.length).length,
    enCatalogo: Object.keys(SONIDOS).length };
});

const fallos = [];
const comprobar = (ok, t) => { console.log((ok ? "  ok   " : "  FALLO") + "  " + t); if (!ok) fallos.push(t); };

console.log("abierto como " + url.slice(0, 8) + "…/index.html  (sin servidor)\n");
comprobar(pre.banco, `el banco carga sin fetch(): ${pre.ids} ids`);
comprobar(post.ctx === "running", `AudioContext arranca con el gesto: ${post.ctx}`);
comprobar(post.fallo === 0 && post.listas === post.total,
  `descodificados ${post.listas}/${post.total}, ${post.fallo} fallos`);
comprobar(post.conMuestra === post.enCatalogo,
  `${post.conMuestra}/${post.enCatalogo} sonidos con muestra real`);
comprobar(errs.length === 0, "sin errores de consola" + (errs.length ? ": " + errs.slice(0, 4).join(" | ") : ""));

await nav.close();
console.log(fallos.length ? `\n${fallos.length} FALLOS` : "\nTODO OK — el juego suena con doble clic");
process.exit(fallos.length ? 1 : 0);
