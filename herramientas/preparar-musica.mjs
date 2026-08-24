// ════════════════════════════════════════════════════════════
//  preparar-musica.mjs — deja la música lista para el juego
// ════════════════════════════════════════════════════════════
//
//    node herramientas/preparar-musica.mjs
//    node herramientas/preparar-musica.mjs --solo menu,jefe
//    node herramientas/preparar-musica.mjs --wav        deja los WAV de los stingers
//
//  Qué hace, en orden:
//    1. Recorta de cada fuente el TROZO que hace bucle. Ninguna de las
//       cinco pistas del pack se usa entera: dos traen fundidos de
//       entrada y salida que no pueden estar dentro de un bucle, y de
//       "Synth Wave" salen DOS pistas distintas (menú y combate B)
//       porque dura 3:12 y hay material de sobra.
//    2. Forja los cuatro stingers con el taller de dsp.mjs. El pack no
//       trae cortes, solo bucles.
//    3. Normaliza TODO a −16 LUFS con pico real a −1,5 dBFS.
//    4. Codifica a MP3 VBR y escribe audio/MUSICA.json.
//
//  Por qué normalizar es obligatorio y no una mejora: las cinco pistas
//  del pack venían con 6,5 LU de diferencia entre la más fuerte
//  (Trance Boss, −11,5) y la más floja (Calm Ambient, −18,0). Sin esto,
//  pasar del hangar al jefe es un susto. Y "Synth Wave" picaba a
//  +0,2 dBFS, o sea por encima del techo digital: recortaba sola.
//
//  La diferencia de volumen ENTRE ESTADOS se decide después, en
//  js/music.js, con la ganancia de cada estado. Ahí se ve y se toca; en
//  el archivo quedaría escondida.
//
//  Fuentes y licencias: THIRD_PARTY_AUDIO_LICENSES.md

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SR, aWav } from "./audio/dsp.mjs";
import { STINGERS, acabar } from "./audio/stingers.mjs";

const ejec = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTES = join(RAIZ, "audio", "fuentes", "musica");
const SALIDA = join(RAIZ, "audio", "musica");
const TMP = join(RAIZ, "audio", ".forja-musica");
const MANIFIESTO = join(RAIZ, "audio", "MUSICA.json");

const args = process.argv.slice(2);
const GUARDAR_WAV = args.includes("--wav");
const SOLO = (() => { const i = args.indexOf("--solo"); return i >= 0 ? args[i + 1].split(",") : null; })();

// ── Contrato de la música ─────────────────────────────────
//  Un solo objetivo para todo. La música es lo único del juego que suena
//  CONTINUO, así que no tiene categorías como los efectos: o todo está
//  al mismo nivel o hay saltos.
const LUFS = -16;      // sonoridad integrada de destino
const TP = -1.5;       // pico real máximo; deja aire para el bus y el códec
const Q = 5;           // VBR de libmp3lame: ~130 kbps a 44,1 kHz estéreo

// ── Las pistas ────────────────────────────────────────────
//  desde/hasta  el trozo que se conserva, en segundos. `hasta: null` es
//               "hasta el final".
//  fade         cuánto dura el cruce del bucle CONSIGO MISMO, en
//               segundos. No se cuece en el archivo: se guarda en el
//               manifiesto y lo aplica js/music.js. Una pista que hace
//               bucle perfecto —Trance Boss dura 102,400 s exactos, que
//               son 64 compases a 150 BPM— solo necesita el cruce
//               mínimo que tape la costura del códec.
const PISTAS = [
  { id: "menu", fuente: "synth_wave.mp3", desde: 8, hasta: 88, fade: 2.0,
    titulo: "Synth Wave", autor: "Pro Sensory / Alex McCulloch",
    pagina: "https://opengameart.org/content/synth-wave", licencia: "CC0",
    uso: "Menú principal" },

  { id: "combate_a", fuente: "space_shooter.mp3", desde: 0, hasta: null, fade: 1.0,
    titulo: "Space Shooter (Loop)", autor: "Pro Sensory / Alex McCulloch",
    pagina: "https://opengameart.org/content/space-shooter-loop", licencia: "CC0",
    uso: "Combate — misiones 1, 3, 5, 7, 9 y supervivencia" },

  // El segundo trozo de "Synth Wave", después del descanso del minuto
  // 1:28. Es otra sección de la misma pieza, no la misma repetida: con
  // una sola pista de combate para diez misiones de seis minutos, el
  // brief se incumple solo.
  { id: "combate_b", fuente: "synth_wave.mp3", desde: 96, hasta: 176, fade: 2.0,
    titulo: "Synth Wave", autor: "Pro Sensory / Alex McCulloch",
    pagina: "https://opengameart.org/content/synth-wave", licencia: "CC0",
    uso: "Combate — misiones 2, 4, 6, 8 y 10" },

  // Entra a −51 dB y acaba a −70: los fundidos de estudio no pueden
  // estar dentro de un bucle o el hangar se queda mudo cada dos minutos.
  { id: "hangar", fuente: "001_Synthwave_4k.mp3", desde: 16, hasta: 140, fade: 4.0,
    titulo: "Calm Ambient 1 (Synthwave 4k)", autor: "The Cynic Project",
    pagina: "https://opengameart.org/content/calm-ambient-1-synthwave-4k", licencia: "CC0",
    atribucion: "The Cynic Project / cynicmusic.com / pixelsphere.org",
    uso: "Hangar y pausa" },

  { id: "jefe", fuente: "trance_boss_battle_bpm150.mp3", desde: 0, hasta: null, fade: 0.15,
    titulo: "Trance Boss Battle", autor: "MintoDog",
    pagina: "https://opengameart.org/content/trance-boss-battle", licencia: "CC0",
    uso: "Jefes 1 a 9" },

  // Única fuente en OGG: Safari de iOS no descodifica Vorbis, así que
  // transcodificar no es una mejora, es la condición para que suene en
  // el aparato de destino.
  { id: "jefe_final", fuente: "boss_battle_10_retro.ogg", desde: 0, hasta: null, fade: 1.0,
    titulo: "Boss Battle 10 [Retro]", autor: "nene",
    pagina: "https://opengameart.org/content/boss-battle-10-retro", licencia: "CC0",
    uso: "OMEGA SOVEREIGN (misión 10)" },
];

const sha = (b) => createHash("sha256").update(b).digest("hex");

// ── Medida de sonoridad ───────────────────────────────────
//  Primera pasada de loudnorm: mide y no toca nada. Se necesita para que
//  la segunda pasada sea exacta; loudnorm en una sola pasada corrige
//  sobre la marcha y el resultado depende de por dónde empiece.
async function medirLoudnorm(entrada, recorte) {
  const { stderr } = await ejec("ffmpeg", [
    "-hide_banner", "-nostats", ...recorte, "-i", entrada,
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
  // El ÚLTIMO, no el primero: ebur128 escupe una línea por fotograma
  // mientras analiza y luego el resumen. La primera "I:" es el primer
  // fotograma —silencio, −70 LUFS— y es la que cogía la versión
  // anterior, así que el manifiesto decía que todo estaba mudo.
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

// ── Una pista del pack ────────────────────────────────────
async function procesarPista(p) {
  const entrada = join(FUENTES, p.fuente);
  if (!existsSync(entrada)) {
    console.error(`  ✗ falta la fuente ${p.fuente} — ver THIRD_PARTY_AUDIO_LICENSES.md`);
    return null;
  }
  const recorte = ["-ss", String(p.desde)];
  if (p.hasta != null) recorte.push("-t", String(p.hasta - p.desde));

  const med = await medirLoudnorm(entrada, recorte);
  // Segunda pasada: se le dan las medidas de la primera, así que aplica
  // una ganancia calculada de una vez y no un control automático que
  // respira. `linear=true` es lo que lo hace transparente.
  const filtro = `loudnorm=I=${LUFS}:TP=${TP}:LRA=11:linear=true` +
    `:measured_I=${med.input_i}:measured_TP=${med.input_tp}` +
    `:measured_LRA=${med.input_lra}:measured_thresh=${med.input_thresh}` +
    `:offset=${med.target_offset}`;

  const destino = join(SALIDA, p.id + ".mp3");
  await ejec("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...recorte, "-i", entrada,
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
    pagina: p.pagina, atribucion: p.atribucion || null, uso: p.uso,
    fuente: "audio/fuentes/musica/" + p.fuente,
    sha256_fuente: sha(orig),
    recorte: { desde: p.desde, hasta: p.hasta },
    bucle: true, fade: p.fade,
    duracion: dur, kb: +(bytes.length / 1024).toFixed(1),
    lufs: fin.lufs, pico: fin.pico, lra: fin.lra,
    sha256: sha(bytes),
  };
}

// ── Un stinger forjado ────────────────────────────────────
async function procesarStinger(id) {
  const s = STINGERS[id];
  const x = acabar(s.hacer());
  const wav = join(TMP, id + ".wav");
  await writeFile(wav, aWav(x, SR));

  const med = await medirLoudnorm(wav, []);
  const filtro = `loudnorm=I=${LUFS}:TP=${TP}:LRA=11:linear=true` +
    `:measured_I=${med.input_i}:measured_TP=${med.input_tp}` +
    `:measured_LRA=${med.input_lra}:measured_thresh=${med.input_thresh}` +
    `:offset=${med.target_offset}`;

  const destino = join(SALIDA, id + ".mp3");
  await ejec("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", wav,
    "-af", filtro, "-ar", "44100", "-ac", "2",
    "-c:a", "libmp3lame", "-q:a", String(Q), "-write_xing", "1", destino],
    { maxBuffer: 1 << 26 });

  if (!GUARDAR_WAV) await rm(wav, { force: true });

  const bytes = await readFile(destino);
  const fin = await medirFinal(destino);
  const dur = await duracion(destino);

  console.log(`  ✓ ${id.padEnd(11)} ${String(dur).padStart(7)} s  ` +
    `${String(Math.round(bytes.length / 1024)).padStart(5)} kB  ` +
    `${String(fin.lufs).padStart(6)} LUFS  pico ${String(fin.pico).padStart(5)} dBFS`);

  return {
    id, archivo: "audio/musica/" + id + ".mp3",
    origen: "forjado", titulo: "Flight Strike — " + id, autor: "Flight Strike",
    licencia: "propia", pagina: null, atribucion: null,
    uso: { mision: "Misión completada", victoria: "Jefe derrotado",
           derrota: "Fin de partida", unlock: "Desbloqueo" }[id],
    fuente: "herramientas/audio/stingers.mjs",
    bucle: false, fade: 0,
    duracion: dur, kb: +(bytes.length / 1024).toFixed(1),
    lufs: fin.lufs, pico: fin.pico, lra: fin.lra,
    sha256: sha(bytes),
  };
}

// ── Principal ─────────────────────────────────────────────
const quiere = (id) => !SOLO || SOLO.includes(id);

await mkdir(SALIDA, { recursive: true });
await mkdir(TMP, { recursive: true });

console.log("BUCLES DEL PACK");
const pistas = [];
for (const p of PISTAS) {
  if (!quiere(p.id)) continue;
  const r = await procesarPista(p);
  if (r) pistas.push(r);
}

console.log("\nSTINGERS FORJADOS");
for (const id of Object.keys(STINGERS)) {
  if (!quiere(id)) continue;
  pistas.push(await procesarStinger(id));
}

if (!GUARDAR_WAV) await rm(TMP, { recursive: true, force: true });

// El manifiesto solo se reescribe entero cuando se han hecho todas las
// pistas. Con --solo se fusiona, o una prueba parcial dejaría un
// manifiesto que dice que el juego tiene tres pistas.
let previo = {};
if (SOLO && existsSync(MANIFIESTO)) previo = JSON.parse(await readFile(MANIFIESTO, "utf8"));
const porId = new Map((previo.pistas || []).map(p => [p.id, p]));
for (const p of pistas) porId.set(p.id, p);
const todas = [...porId.values()];

const kb = todas.reduce((a, p) => a + p.kb, 0);
const segs = todas.reduce((a, p) => a + p.duracion, 0);

await writeFile(MANIFIESTO, JSON.stringify({
  generado: "herramientas/preparar-musica.mjs",
  formato: `mp3 estéreo 44,1 kHz VBR q${Q}, archivos sueltos en audio/musica/`,
  contrato: { lufs: LUFS, picoReal: TP, q: Q },
  nota: "La música NO va en base64 como los efectos: son megabytes. " +
        "Con file:// no suena, y es la excepción aceptada.",
  totales: { pistas: todas.length, segundos: +segs.toFixed(1), kb: +kb.toFixed(1) },
  pistas: todas,
}, null, 2) + "\n");

console.log(`\n${todas.length} pistas · ${(segs / 60).toFixed(1)} min · ${(kb / 1024).toFixed(2)} MB`);
console.log("→ audio/MUSICA.json");
