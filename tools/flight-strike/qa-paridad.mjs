#!/usr/bin/env node
// ════════════════════════════════════════════════════════════
//  QA de paridad: el juego suelto contra el juego en PLAYZONE
//
//    node tools/flight-strike/qa-paridad.mjs <ruta-al-repo-canonico>
//
//  Levanta los dos, los abre a la misma resolución y compara lo que
//  de verdad decide cómo se ve el juego: el lienzo, su resolución
//  interna, el devicePixelRatio y el factor de escala ESC del propio
//  juego. Si esas cifras coinciden, el juego se ve igual en los dos
//  sitios; lo que cambie será el contenedor, no el juego.
// ════════════════════════════════════════════════════════════
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png",
                ".json": "application/json", ".css": "text/css", ".txt": "text/plain" };

function servir(raiz) {
  const s = createServer(async (req, res) => {
    const ruta = decodeURIComponent(req.url.split("?")[0]);
    const abs = join(raiz, normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
    try {
      const cuerpo = await readFile(abs);
      res.writeHead(200, { "content-type": TIPOS[extname(abs)] ?? "application/octet-stream" });
      res.end(cuerpo);
    } catch { res.writeHead(404).end("no"); }
  });
  return new Promise((ok) => s.listen(0, () => ok({ s, puerto: s.address().port })));
}

const SALIDA = process.env.QA_SALIDA ?? ".";

const PANTALLAS = [
  { nombre: "iPhone 14 Pro", width: 393, height: 852, dpr: 3, movil: true },
  { nombre: "iPad Air",      width: 820, height: 1180, dpr: 2, movil: true },
  { nombre: "Escritorio",    width: 1440, height: 900, dpr: 1, movil: false },
];

// Lo que se mide dentro de la página.
const MEDIR = `(() => {
  const c = document.querySelector("canvas");
  const leer = (n) => { try { return eval(n); } catch { return null; } };
  return {
    innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio,
    cssW: c && parseFloat(getComputedStyle(c).width),
    cssH: c && parseFloat(getComputedStyle(c).height),
    bufW: c && c.width, bufH: c && c.height,
    ESC: leer("ESC"),
    naveTam: (() => { const g = leer("CONFIG"); return g && (g.naveTam ?? g.tamNave ?? null); })(),
    zoomCSS: getComputedStyle(document.body).zoom || "",
    transformCSS: getComputedStyle(document.body).transform,
    overlay: !!document.getElementById("pzVolver"),
    scroll: document.documentElement.scrollWidth > innerWidth + 1,
  };
})()`;

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const canonico = resolve(process.argv[2] ?? ".");
const [a, b] = await Promise.all([servir(RAIZ), servir(canonico)]);
// Si el entorno trae un Chromium propio, se usa; si no, el de Playwright.
const nav = await chromium.launch(
  process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}
);

const SITIOS = [
  { id: "DIRECTO ", url: `http://127.0.0.1:${b.puerto}/index.html` },
  { id: "PLAYZONE", url: `http://127.0.0.1:${a.puerto}/max/001-flight-strike/index.html` },
];

let fallos = 0;
for (const p of PANTALLAS) {
  console.log(`\n━━ ${p.nombre}  ${p.width}×${p.height} @${p.dpr}x ━━`);
  const filas = {};
  for (const sitio of SITIOS) {
    const ctx = await nav.newContext({
      viewport: { width: p.width, height: p.height },
      deviceScaleFactor: p.dpr, isMobile: p.movil, hasTouch: p.movil,
    });
    const pag = await ctx.newPage();
    const errores = [];
    pag.on("pageerror", (e) => errores.push(e.message));
    await pag.goto(sitio.url, { waitUntil: "load" });
    await pag.waitForTimeout(400);
    const m = await pag.evaluate(MEDIR);
    m.errores = errores;
    filas[sitio.id] = m;
    await pag.screenshot({ path: join(SALIDA, `qa-${p.nombre.replace(/\W+/g, "")}-${sitio.id.trim()}.png`) });
    await ctx.close();
  }

  const d = filas["DIRECTO "], z = filas["PLAYZONE"];
  const campos = ["innerW", "innerH", "dpr", "cssW", "cssH", "bufW", "bufH", "ESC"];
  for (const k of campos) {
    const igual = String(d[k]) === String(z[k]);
    if (!igual) fallos++;
    console.log(`   ${igual ? "✓" : "✗"} ${k.padEnd(7)} directo=${String(d[k]).padEnd(9)} playzone=${z[k]}`);
  }
  console.log(`   · overlay PLAYZONE presente: ${z.overlay}  (directo: ${d.overlay})`);
  if (d.errores.length || z.errores.length) {
    fallos++;
    console.log(`   ✗ errores JS  directo=${JSON.stringify(d.errores)}  playzone=${JSON.stringify(z.errores)}`);
  }
  if (z.scroll) { fallos++; console.log(`   ✗ la página hace scroll horizontal en PLAYZONE`); }
}

await nav.close(); a.s.close(); b.s.close();
console.log(fallos === 0
  ? `\n✓ Paridad total: el juego se comporta igual suelto que dentro de PLAYZONE.`
  : `\n✗ ${fallos} diferencia(s) entre el juego suelto y el de PLAYZONE.`);
process.exit(fallos === 0 ? 0 : 1);
