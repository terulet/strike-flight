// ════════════════════════════════════════════════════════════
//  preparar-musica-expansion.mjs — las cinco pistas del bloque 5I
// ════════════════════════════════════════════════════════════
//
//    node herramientas/preparar-musica-expansion.mjs
//
//  Mismo contrato que preparar-musica.mjs (−16 LUFS, pico real −1,5 dBFS,
//  MP3 VBR q5 44,1 kHz estéreo) aplicado al segundo pack de MintoDog:
//  combate_c/d/e, jefe2 y final2. Se deja aparte del script original
//  porque ese ya tiene su propio catálogo de recortes y stingers, y
//  mezclar los dos paquetes en un solo array los haría difíciles de leer.
//
//  Las cinco fuentes son bucles ENTEROS, sin recorte: las cinco duran un
//  número exacto de compases a su BPM (comprobado con ffprobe antes de
//  escribir esto: 88,615 s / 130 BPM = 48 compases; 130,286 s / 140 BPM =
//  76; 89,143 s / 140 BPM = 52; 104,229 s / 175 BPM = 76; 130,909 s /
//  110 BPM = 60 — los cinco exactos), así que el cruce puede ser tan
//  corto como el de "jefe" (0,15 s): la costura ya cae en el sitio
//  musicalmente correcto.
//
//  Licencias: audio/fuentes/musica/LICENCIAS_5I.md

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ejec = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTES = join(RAIZ, "audio", "fuentes", "musica");
const SALIDA = join(RAIZ, "audio", "musica");
const MANIFIESTO = join(RAIZ, "audio", "MUSICA.json");

const LUFS = -16;
const TP = -1.5;
const Q = 5;

const PISTAS = [
  { id: "combate_c", fuente: "combate_c_space_battle.mp3", fade: 0.15,
    titulo: "Space Battle", autor: "MintoDog", licencia: "CC0",
    pagina: "https://opengameart.org/content/space-battle",
    uso: "Combate — misiones 11 y 12 (hielo), 17 y 18 (fragua)" },

  { id: "combate_d", fuente: "combate_d_space_adventure.mp3", fade: 0.15,
    titulo: "Space Adventure", autor: "MintoDog", licencia: "CC0",
    pagina: "https://opengameart.org/content/space-adventure",
    uso: "Combate — misiones 15 y 16 (abismo), 19 y 20 (grieta)" },

  { id: "combate_e", fuente: "combate_e_hard_battle_2.mp3", fade: 0.15,
    titulo: "Hard Battle 2", autor: "MintoDog", licencia: "CC0",
    pagina: "https://opengameart.org/content/hard-battle-2",
    uso: "Combate — misiones 13 y 14 (megaciudad)" },

  { id: "jefe2", fuente: "jefe2_space_boss_battle.mp3", fade: 0.15,
    titulo: "Space Boss Battle", autor: "MintoDog", licencia: "CC0",
    pagina: "https://opengameart.org/content/space-boss-battle",
    uso: "KRYOS, VÉRTICE, NÝX y VULCANO" },

  { id: "final2", fuente: "final2_heavy_boss_battle_2.mp3", fade: 0.15,
    titulo: "Heavy Boss Battle 2", autor: "MintoDog", licencia: "CC0",
    pagina: "https://opengameart.org/content/heavy-boss-battle-2",
    uso: "AXIOMA — jefe final de la expansión" },
];

const sha = (b) => createHash("sha256").update(b).digest("hex");

async function medirLoudnorm(entrada) {
  const { stderr } = await ejec("ffmpeg", [
    "-hide_banner", "-nostats", "-i", entrada,
    "-af", `loudnorm=I=${LUFS}:TP=${TP}:LRA=11:print_format=json`,
    "-f", "null", "-",
  ], { maxBuffer: 1 << 26 });
  const m = stderr.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("loudnorm no devolvió medida para " + entrada);
  return JSON.parse(m[0]);
}

async function medirFinal(archivo) {
  const { stderr } = await ejec("ffmpeg", [
    "-hide_banner", "-nostats", "-i", archivo,
    "-filter_complex", "ebur128=peak=true", "-f", "null", "-",
  ], { maxBuffer: 1 << 26 });
  const ultimo = (re) => { const m = [...stderr.matchAll(re)]; return m.length ? +m[m.length - 1][1] : null; };
  return {
    lufs: ultimo(/I:\s*(-?[\d.]+)\s*LUFS/g),
    pico: ultimo(/Peak:\s*(-?[\d.]+)\s*dBFS/g),
    lra: ultimo(/LRA:\s*(-?[\d.]+)\s*LU/g),
  };
}

async function duracion(archivo) {
  const { stdout } = await ejec("ffprobe", ["-v", "error",
    "-show_entries", "format=duration", "-of", "csv=p=0", archivo]);
  return +(+stdout.trim()).toFixed(3);
}

async function procesarPista(p) {
  const entrada = join(FUENTES, p.fuente);
  if (!existsSync(entrada)) {
    console.error(`  ✗ falta la fuente ${p.fuente}`);
    return null;
  }
  const med = await medirLoudnorm(entrada);
  const filtro = `loudnorm=I=${LUFS}:TP=${TP}:LRA=11:linear=true` +
    `:measured_I=${med.input_i}:measured_TP=${med.input_tp}` +
    `:measured_LRA=${med.input_lra}:measured_thresh=${med.input_thresh}` +
    `:offset=${med.target_offset}`;

  const destino = join(SALIDA, p.id + ".mp3");
  await ejec("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", entrada,
    "-af", filtro, "-ar", "44100", "-ac", "2",
    "-c:a", "libmp3lame", "-q:a", String(Q), "-write_xing", "1", destino],
    { maxBuffer: 1 << 26 });

  const bytes = await readFile(destino);
  const fin = await medirFinal(destino);
  const dur = await duracion(destino);
  const orig = await readFile(entrada);

  console.log(`  ✓ ${p.id.padEnd(11)} ${String(dur).padStart(7)} s  ` +
    `${String(Math.round(bytes.length / 1024)).padStart(5)} kB  ` +
    `${String(fin.lufs).padStart(6)} LUFS  pico ${String(fin.pico).padStart(5)} dBFS`);

  return {
    id: p.id, archivo: "audio/musica/" + p.id + ".mp3",
    origen: "pack", titulo: p.titulo, autor: p.autor, licencia: p.licencia,
    pagina: p.pagina, atribucion: null, uso: p.uso,
    fuente: "audio/fuentes/musica/" + p.fuente,
    sha256_fuente: sha(orig),
    recorte: { desde: 0, hasta: null },
    bucle: true, fade: p.fade,
    duracion: dur, kb: +(bytes.length / 1024).toFixed(1),
    lufs: fin.lufs, pico: fin.pico, lra: fin.lra,
    sha256: sha(bytes),
  };
}

await mkdir(SALIDA, { recursive: true });

console.log("PISTAS DE LA EXPANSIÓN (bloque 5I)");
const nuevas = [];
for (const p of PISTAS) {
  const r = await procesarPista(p);
  if (r) nuevas.push(r);
}

const previo = existsSync(MANIFIESTO) ? JSON.parse(await readFile(MANIFIESTO, "utf8")) : { pistas: [] };
const porId = new Map((previo.pistas || []).map(p => [p.id, p]));
for (const p of nuevas) porId.set(p.id, p);
const todas = [...porId.values()];

const kb = todas.reduce((a, p) => a + p.kb, 0);
const segs = todas.reduce((a, p) => a + p.duracion, 0);

await writeFile(MANIFIESTO, JSON.stringify({
  ...previo,
  totales: { pistas: todas.length, segundos: +segs.toFixed(1), kb: +kb.toFixed(1) },
  pistas: todas,
}, null, 2) + "\n");

console.log(`\n${todas.length} pistas en total · ${(segs / 60).toFixed(1)} min · ${(kb / 1024).toFixed(2)} MB`);
console.log("→ audio/MUSICA.json actualizado");
