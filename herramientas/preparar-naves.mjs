// ════════════════════════════════════════════════════════════
//  preparar-naves.mjs — deja los assets del bloque 4 listos
// ════════════════════════════════════════════════════════════
//
//    node herramientas/preparar-naves.mjs <carpeta del pack>
//
//  Procesa los chasis, los emblemas y el fondo del hangar del pack de
//  arte y los deja en art/ con el formato que el juego necesita.
//
//  ── Por qué hay que procesarlos y no copiarlos ──
//
//  1. RECORTE. `prepararSprite()` recorta a la caja alfa al cargar…
//     pero solo cuando puede leer los píxeles. Con `file://` el
//     navegador prohíbe `getImageData`, así que NO recorta, y un PNG con
//     94 px de margen por lado se dibujaría un 15 % más pequeño y
//     descentrado SOLO al abrir con doble clic. Se recorta aquí.
//
//  2. TAMAÑO. `MAX_SPRITE` es 512: cualquier cosa mayor la reduce el
//     navegador en cada arranque. Los originales son de 1254 px.
//
//  3. PESO. Los emblemas vienen a 1254² y pesan 31 MB entre los quince.
//     Se muestran a 40–64 px. Bajarlos a 256 los deja en kilobytes.
//
//  El resultado es determinista: mismas fuentes, mismos archivos.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ejec = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = process.argv[2];

if (!PACK || !existsSync(PACK)) {
  console.error("Uso: node herramientas/preparar-naves.mjs <carpeta FLIGHT_STRIKE_ASSETS_CLAUDE>");
  process.exit(1);
}

// ── Medida de la caja alfa ────────────────────────────────
async function cajaAlfa(archivo) {
  const { stdout: dim } = await ejec("ffprobe", ["-v", "error",
    "-show_entries", "stream=width,height", "-of", "csv=p=0", archivo]);
  const [w, h] = dim.trim().split(",").map(Number);
  const { stdout } = await ejec("ffmpeg", ["-v", "error", "-i", archivo,
    "-vf", "alphaextract", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    { encoding: "buffer", maxBuffer: 1 << 28 });
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (stdout[y * w + x] > 12) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { w, h, x: x0, y: y0, cw: x1 - x0 + 1, ch: y1 - y0 + 1 };
}

// Recorta a la caja alfa y escala para que el lado mayor sea `lado`.
// El recorte se hace SIMÉTRICO en horizontal a propósito: las naves son
// simétricas, y un recorte de 94 px a la izquierda y 93 a la derecha las
// dejaría con el morro medio píxel fuera del centro. En un juego donde
// el disparo sale del centro exacto, eso se nota.
async function prepararNave(origen, destino, lado) {
  const c = await cajaAlfa(origen);
  if (!c) throw new Error("sin alfa: " + origen);
  const cx = (c.x + c.cw / 2);
  const semiW = Math.max(cx - c.x, (c.x + c.cw) - cx);
  const x = Math.max(0, Math.round(cx - semiW));
  const cw = Math.min(c.w - x, Math.round(semiW * 2));
  const esc = lado / Math.max(cw, c.ch);
  const nw = Math.max(1, Math.round(cw * esc)), nh = Math.max(1, Math.round(c.ch * esc));
  await ejec("ffmpeg", ["-v", "error", "-y", "-i", origen,
    "-vf", `crop=${cw}:${c.ch}:${x}:${c.y},scale=${nw}:${nh}:flags=lanczos`,
    "-c:v", "png", "-compression_level", "9", destino]);
  const bytes = (await readFile(destino)).length;
  return { orig: `${c.w}x${c.h}`, caja: `${cw}x${c.ch}`, final: `${nw}x${nh}`,
           ratio: +(nw / nh).toFixed(3), kb: Math.round(bytes / 1024) };
}

// ── Chasis ────────────────────────────────────────────────
const CHASIS = [
  ["SHIP_CHASSIS_01_INTERCEPTOR.png", "chassis_01_interceptor.png"],
  ["SHIP_CHASSIS_02_STRIKER.png",     "chassis_02_striker.png"],
  ["SHIP_CHASSIS_03_AEGIS.png",       "chassis_03_aegis.png"],
  ["SHIP_CHASSIS_04_PHANTOM.png",     "chassis_04_phantom.png"],
  ["SHIP_CHASSIS_05_NOVA.png",        "chassis_05_nova.png"],
];

await mkdir(join(RAIZ, "art", "naves"), { recursive: true });
console.log("CHASIS  (recortados, centrados y a 512 px de lado mayor)");
const fichas = [];
for (const [src, dst] of CHASIS) {
  const o = join(PACK, "01_CHASSIS_FINAL_4C", src);
  if (!existsSync(o)) { console.error("  ✗ falta " + src); continue; }
  const r = await prepararNave(o, join(RAIZ, "art", "naves", dst), 512);
  fichas.push({ dst, ...r });
  console.log(`  ✓ ${dst.padEnd(30)} ${r.orig} → caja ${r.caja} → ${r.final}  ` +
    `ratio ${r.ratio}  ${r.kb} kB`);
}

// ── Emblemas ──────────────────────────────────────────────
//  Nombres cortos y en inglés técnico: son ids que van al save y no
//  pueden depender de un nombre de archivo en español con tildes.
const EMBLEMAS = [
  ["emblema_cibernético_de_calavera_luminosa.png", "skull",   "CALAVERA"],
  ["emblema_de_lobo_cibernético_eléctrico.png",   "wolf",    "LOBO"],
  ["emblema_de_tigre_cibernético_neón.png",       "tiger",   "TIGRE"],
  ["emblema_de_fénix_ígneo_mecánico.png",        "phoenix", "FÉNIX"],
  ["emblema_del_dragón_de_hielo_celestial.png",   "dragon",  "DRAGÓN"],
  ["emblema_cobra_mecánica_radiactiva.png",       "cobra",   "COBRA"],
  ["emblema_cósmico_del_ojo_omnividente.png",     "eye",     "OJO"],
  ["emblema_cósmico_de_cristal_neón.png",        "crystal", "CRISTAL"],
  ["emblema_mecánico_alado_de_neón_cian.png",    "wings",   "ALAS"],
  ["emblema_solar_del_fénix_celestial.png",       "solar",   "SOLAR"],
];

await mkdir(join(RAIZ, "art", "emblemas"), { recursive: true });
console.log("\nEMBLEMAS  (a 256 px: se ven a 40–64 px, no hacen falta 1254)");
let kbEmb = 0;
for (const [src, id] of EMBLEMAS) {
  const o = join(PACK, "05_EMBLEMS", src);
  if (!existsSync(o)) { console.error("  ✗ falta " + src); continue; }
  const r = await prepararNave(o, join(RAIZ, "art", "emblemas", id + ".png"), 256);
  kbEmb += r.kb;
  console.log(`  ✓ ${(id + ".png").padEnd(16)} ${r.orig} → ${r.final}  ${r.kb} kB`);
}
console.log(`  ${EMBLEMAS.length} emblemas · ${kbEmb} kB en total`);

// ── Hangar ────────────────────────────────────────────────
//  El original es HORIZONTAL (4:3 apaisado) y el juego es VERTICAL. No
//  se recorta a lo bestia: se conserva entero y el Hangar lo coloca como
//  una banda, con degradados arriba y abajo. Cuando llegue el vertical,
//  entra por la misma ruta y esto se cae solo.
await mkdir(join(RAIZ, "art", "hangar"), { recursive: true });
console.log("\nHANGAR");
{
  const o = join(PACK, "04_HANGAR", "HANGAR_MAIN_01.png");
  if (existsSync(o)) {
    const dst = join(RAIZ, "art", "hangar", "hangar_h.png");
    // 1280 de ancho es de sobra: se dibuja como mucho a 820 CSS px, y a
    // DPR 2 en iPad son 1640… pero de un fondo desenfocado y oscuro
    // nadie distingue 1280 de 1640, y son 2 MB menos.
    await ejec("ffmpeg", ["-v", "error", "-y", "-i", o,
      "-vf", "scale=1280:-1:flags=lanczos", "-c:v", "png",
      "-compression_level", "9", dst]);
    const kb = Math.round((await readFile(dst)).length / 1024);
    const { stdout } = await ejec("ffprobe", ["-v", "error",
      "-show_entries", "stream=width,height", "-of", "csv=p=0", dst]);
    console.log(`  ✓ hangar_h.png  ${stdout.trim()}  ${kb} kB  (HORIZONTAL, provisional)`);
  } else console.error("  ✗ falta HANGAR_MAIN_01.png");
}

console.log("\nListo. art/naves/ · art/emblemas/ · art/hangar/");
