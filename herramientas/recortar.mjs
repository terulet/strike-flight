// ════════════════════════════════════════════════════════════
//  recortar.mjs — deja los PNG listos para el juego
// ════════════════════════════════════════════════════════════
//
//  Quita el fondo plano, recorta al contenido y reduce a 512 px,
//  y GUARDA el resultado en el propio archivo.
//
//    node herramientas/recortar.mjs art/naves/*.png
//    node herramientas/recortar.mjs art/            (toda la carpeta)
//    node herramientas/recortar.mjs art/ --copia    (deja el original)
//
//  ¿Por qué existe, si el juego ya lo hace solo?
//  Porque solo lo hace cuando la página se sirve por HTTP. Abriendo
//  index.html con doble clic, el navegador prohíbe leer los píxeles de
//  un archivo del disco, así que a las imágenes de art/ no se les puede
//  quitar el fondo en ese modo. Pasándolas por aquí una vez, ya vienen
//  recortadas y se ven bien en TODAS partes: doble clic, GitHub Pages
//  y el iPad.
//
//  No hay una segunda copia del algoritmo: esta herramienta abre el
//  propio index.html en un navegador sin ventana y llama a su
//  prepararSprite(). El resultado es idéntico al del juego, por
//  construcción, y no se puede desincronizar al tocar el juego.
//
//  Necesita Playwright (npm i -D playwright). Es solo para preparar
//  imágenes: el juego sigue sin dependencias de ningún tipo.
// ════════════════════════════════════════════════════════════

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, extname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(RAIZ, "index.html");
const EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const args = process.argv.slice(2);
const copia = args.includes("--copia");
const rutas = args.filter(a => !a.startsWith("--"));

if (!rutas.length) {
  console.log("uso: node herramientas/recortar.mjs <archivo.png | carpeta> [--copia]");
  process.exit(1);
}

// Una carpeta se expande a los PNG que tenga dentro, incluidas subcarpetas.
async function expandir(p) {
  const s = await stat(p).catch(() => null);
  if (!s) { console.error(`  ✗ no existe: ${p}`); return []; }
  if (s.isFile()) return EXT.has(extname(p).toLowerCase()) ? [p] : [];
  const hijos = await readdir(p);
  const out = [];
  for (const h of hijos) out.push(...await expandir(join(p, h)));
  return out;
}

const archivos = [];
for (const r of rutas) archivos.push(...await expandir(r));
if (!archivos.length) { console.error("No hay imágenes que recortar."); process.exit(1); }

// Vale tanto la instalación local del proyecto como una global del sistema.
async function cargarPlaywright() {
  const sitios = ["playwright", "playwright-core",
    "/opt/node22/lib/node_modules/playwright/index.mjs",
    "/usr/lib/node_modules/playwright/index.mjs"];
  for (const s of sitios) {
    try { return await import(s); } catch (_) {}
  }
  console.error("Falta Playwright. Instálalo con:  npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(INDEX).href, { waitUntil: "load" });

const tipoMime = e => (e === ".png" ? "image/png" : e === ".webp" ? "image/webp" : "image/jpeg");
let hechos = 0, fallos = 0;

for (const archivo of archivos) {
  const ext = extname(archivo).toLowerCase();
  const datos = await readFile(archivo);
  const entrada = `data:${tipoMime(ext)};base64,${datos.toString("base64")}`;

  // Los data: URL no ensucian el canvas, así que aquí SÍ se pueden leer
  // los píxeles aunque la página venga de file://.
  const res = await pagina.evaluate(async (src) => {
    const img = new Image();
    const ok = await new Promise(r => { img.onload = () => r(true); img.onerror = () => r(false); img.src = src; });
    if (!ok) return { error: "no es una imagen legible" };
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    const cv = prepararSprite(img);
    if (!cv || !cv.toDataURL) return { error: "no se ha podido procesar" };

    // ¿Ha quedado algo, y con transparencia de verdad?
    const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    let opacos = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 200) opacos++;
    return { w0, h0, w: cv.width, h: cv.height, opacos, data: cv.toDataURL("image/png") };
  }, entrada);

  const nombre = basename(archivo);
  if (res.error) { console.error(`  ✗ ${nombre}: ${res.error}`); fallos++; continue; }
  if (!res.opacos) { console.error(`  ✗ ${nombre}: se quedaría en nada — el fondo no es de un color plano`); fallos++; continue; }

  const salida = copia ? archivo.replace(/(\.[^.]+)$/, "-recortado.png") : archivo.replace(/\.[^.]+$/, ".png");
  await writeFile(salida, Buffer.from(res.data.split(",")[1], "base64"));

  const antes = datos.length, despues = (await stat(salida)).size;
  console.log(
    `  ✓ ${nombre.padEnd(18)} ${res.w0}×${res.h0} → ${res.w}×${res.h}   ` +
    `${(antes / 1024).toFixed(0)} KB → ${(despues / 1024).toFixed(0)} KB` +
    (copia ? `   (en ${basename(salida)})` : "")
  );
  hechos++;
}

await navegador.close();
console.log(`\n${hechos} imagen(es) lista(s)${fallos ? `, ${fallos} con problemas` : ""}.`);
process.exit(fallos ? 1 : 0);
