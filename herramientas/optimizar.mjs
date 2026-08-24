// ════════════════════════════════════════════════════════════
//  optimizar.mjs — deja los PNG de la biblioteca listos y ligeros
// ════════════════════════════════════════════════════════════
//
//    node herramientas/optimizar.mjs glow 256 art/vfx art/impactos
//    node herramientas/optimizar.mjs recorte 192 art/powerups
//
//  DOS MODOS, porque hay dos clases de imagen:
//
//  · recorte — objetos sólidos (naves, iconos, jefes). Reutiliza el
//    prepararSprite() del propio juego: relleno por inundación desde los
//    bordes, así que un negro del INTERIOR del dibujo se conserva.
//
//  · glow — efectos luminosos sobre fondo negro (disparos, explosiones,
//    impactos). El alfa sale del brillo del píxel: lo negro desaparece y
//    lo brillante queda opaco. Es lo que permite dibujarlos encima de
//    cualquier fondo, con o sin mezcla aditiva, sin ver el recuadro negro.
//
//  Los dos recortan al contenido y reducen al lado máximo pedido. Los
//  originales de la biblioteca MASTER no se tocan nunca: esto trabaja
//  sobre las copias que ya están en art/.
// ════════════════════════════════════════════════════════════

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, extname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(RAIZ, "index.html");
const EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const [modo, maxStr, ...rutas] = process.argv.slice(2);
const MAX = Number(maxStr);
if (!["glow", "recorte"].includes(modo) || !MAX || !rutas.length) {
  console.log("uso: node herramientas/optimizar.mjs <glow|recorte> <px> <carpeta...>");
  process.exit(1);
}

async function expandir(p) {
  const s = await stat(p).catch(() => null);
  if (!s) { console.error(`  ✗ no existe: ${p}`); return []; }
  if (s.isFile()) return EXT.has(extname(p).toLowerCase()) ? [p] : [];
  const out = [];
  for (const h of await readdir(p)) out.push(...await expandir(join(p, h)));
  return out;
}

const archivos = [];
for (const r of rutas) archivos.push(...await expandir(r));
if (!archivos.length) { console.error("No hay imágenes."); process.exit(1); }

async function cargarPlaywright() {
  for (const s of ["playwright", "playwright-core"]) {
    try { return await import(s); } catch (_) {}
  }
  console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const { chromium } = await cargarPlaywright();
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(pathToFileURL(INDEX).href, { waitUntil: "load" });

let hechos = 0, fallos = 0, antesTotal = 0, despuesTotal = 0;

for (const archivo of archivos) {
  const datos = await readFile(archivo);
  const entrada = `data:image/png;base64,${datos.toString("base64")}`;

  const res = await pagina.evaluate(async ({ src, modo, MAX }) => {
    const img = new Image();
    const ok = await new Promise(r => { img.onload = () => r(true); img.onerror = () => r(false); img.src = src; });
    if (!ok) return { error: "ilegible" };

    let cv;
    if (modo === "recorte") {
      cv = prepararSprite(img);
      if (!cv) return { error: "no procesable" };
    } else {
      const w = img.naturalWidth, h = img.naturalHeight;
      cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const cx = cv.getContext("2d", { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, w, h), px = d.data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // El alfa sale del canal más brillante: un halo tenue queda tenue,
        // el núcleo queda opaco, y el fondo negro desaparece del todo.
        const a = Math.max(px[i], px[i + 1], px[i + 2]);
        px[i + 3] = Math.min(255, Math.round(a * 1.12));
        if (px[i + 3] > 10) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) return { error: "vacía" };
      cx.putImageData(d, 0, 0);
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const rec = document.createElement("canvas");
      rec.width = cw; rec.height = ch;
      rec.getContext("2d").drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
      cv = rec;
    }

    const esc = Math.min(1, MAX / Math.max(cv.width, cv.height));
    if (esc < 1) {
      let cur = cv;
      let tw = Math.max(1, Math.round(cv.width * esc)), th = Math.max(1, Math.round(cv.height * esc));
      while (cur.width > tw * 2 && cur.height > th * 2) {
        const t = document.createElement("canvas");
        t.width = Math.max(tw, cur.width >> 1); t.height = Math.max(th, cur.height >> 1);
        const tx = t.getContext("2d");
        tx.imageSmoothingQuality = "high";
        tx.drawImage(cur, 0, 0, t.width, t.height);
        cur = t;
      }
      const fin = document.createElement("canvas");
      fin.width = tw; fin.height = th;
      const fx = fin.getContext("2d");
      fx.imageSmoothingQuality = "high";
      fx.drawImage(cur, 0, 0, tw, th);
      cv = fin;
    }
    return { w: cv.width, h: cv.height, data: cv.toDataURL("image/png") };
  }, { src: entrada, modo, MAX });

  const nombre = basename(archivo);
  if (res.error) { console.error(`  ✗ ${nombre}: ${res.error}`); fallos++; continue; }

  await writeFile(archivo, Buffer.from(res.data.split(",")[1], "base64"));
  const despues = (await stat(archivo)).size;
  antesTotal += datos.length; despuesTotal += despues;
  console.log(`  ✓ ${nombre.padEnd(20)} → ${res.w}×${res.h}  ${(datos.length / 1024) | 0} KB → ${(despues / 1024) | 0} KB`);
  hechos++;
}

await navegador.close();
console.log(`\n${hechos} imagen(es) · ${(antesTotal / 1048576).toFixed(1)} MB → ${(despuesTotal / 1048576).toFixed(1)} MB` +
  (fallos ? ` · ${fallos} con problemas` : ""));
process.exit(fallos ? 1 : 0);
