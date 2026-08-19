// ════════════════════════════════════════════════════════════
//  forjar-audio.mjs — fabrica el banco de sonidos del juego
// ════════════════════════════════════════════════════════════
//
//    node herramientas/forjar-audio.mjs            fabrica y empaqueta
//    node herramientas/forjar-audio.mjs --wav      además deja los WAV
//    node herramientas/forjar-audio.mjs --solo cannon,exp_boss
//
//  Qué hace, en orden:
//    1. Descodifica las fuentes CC0 de audio/fuentes/ con ffmpeg.
//    2. Ejecuta la receta de cada sonido de paleta.mjs.
//    3. Le pone el acabado de su categoría (EQ de reparto de espectro).
//    4. Lo normaliza al objetivo de sonoridad de su categoría. Esto es
//       la mezcla de verdad: que un disparo no pueda taparlo todo por
//       mucho que se toquen las ganancias en el juego.
//    5. Lo mide y comprueba que cumple el contrato de su categoría.
//    6. Lo codifica a MP3 mono y lo empaqueta en base64.
//
//  Por qué MP3 y por qué en base64 dentro de un .js:
//    · MP3 es el ÚNICO formato que decodeAudioData acepta en todas
//      partes, incluido Safari de iOS. Ogg Vorbis no lo es.
//    · Un <script src> clásico se carga con file:// — fetch() no. El
//      juego tiene que seguir funcionando con doble clic, y ese es el
//      motivo de que el audio fuera 100 % sintetizado hasta ahora.
//    · Cero peticiones de red = cero 404 posibles y cero latencia.
//
//  El resultado es determinista: mismo código, mismo SHA-256.

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGO, ACABADO } from "./audio/paleta.mjs";
import { SR, secs, medir, aWav, normalizarPico, ganancia, recortarCabeza,
         recortarCola, gainToDb, dbToGain, limitar, fadeOut } from "./audio/dsp.mjs";

const ejec = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTES = join(RAIZ, "audio", "fuentes", "kenney");
const TMP = join(RAIZ, "audio", ".forja");
const SALIDA = join(RAIZ, "audio", "muestras.js");
const MANIFIESTO = join(RAIZ, "audio", "MANIFIESTO.json");

const args = process.argv.slice(2);
const GUARDAR_WAV = args.includes("--wav");
const SOLO = (() => { const i = args.indexOf("--solo"); return i >= 0 ? args[i + 1].split(",") : null; })();

// ── Contrato de mezcla ────────────────────────────────────
//  objetivo  sonoridad a la que se normaliza (RMS de la ventana de
//            300 ms más fuerte, en dBFS). Es la jerarquía del brief
//            hecha número: el jefe manda, el disparo propio se oye
//            claramente y el disparo enemigo no compite con él.
//  pico      techo absoluto. Nada sale de aquí clipeando.
//  durMax    tope duro de duración. Los disparos frecuentes tienen que
//            ser cortos o la pantalla llena de enemigos es una masa.
//  sr/q      codificación. Lo corto y brillante conserva 32 kHz porque el
//            brillo del transitorio es justo lo que lo hace sonar rápido;
//            lo largo y grave baja a 24 kHz, donde no hay nada que perder
//            por encima de 12 kHz y sí un tercio de peso que ganar.
const CONTRATO = {
  disparo:    { objetivo: -19.5, pico: 0.90, durMax: 0.34, sr: 32000, q: 9 },
  disparoEne: { objetivo: -23.0, pico: 0.82, durMax: 0.40, sr: 24000, q: 9 },
  impacto:    { objetivo: -19.0, pico: 0.88, durMax: 0.42, sr: 32000, q: 9 },
  explosion:  { objetivo: -15.0, pico: 0.95, durMax: 1.20, sr: 24000, q: 9 },
  jefe:       { objetivo: -12.0, pico: 0.99, durMax: 2.80, sr: 24000, q: 9 },
  premio:     { objetivo: -18.0, pico: 0.90, durMax: 0.90, sr: 32000, q: 9 },
  aviso:      { objetivo: -16.0, pico: 0.93, durMax: 1.10, sr: 24000, q: 9 },
  ui:         { objetivo: -19.0, pico: 0.88, durMax: 0.30, sr: 32000, q: 9 },
};

// Sonoridad de corto plazo: la ventana de 300 ms con más energía. Medir
// el RMS del archivo entero castigaría a los sonidos con cola larga y
// dejaría las explosiones demasiado altas.
function sonoridad(x) {
  const w = secs(0.3);
  if (x.length <= w) {
    let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    return Math.sqrt(s / Math.max(1, x.length));
  }
  let s = 0;
  for (let i = 0; i < w; i++) s += x[i] * x[i];
  let mejor = s;
  for (let i = w; i < x.length; i++) { s += x[i] * x[i] - x[i - w] * x[i - w]; if (s > mejor) mejor = s; }
  return Math.sqrt(mejor / w);
}

// ── Fuentes externas ──────────────────────────────────────
const cacheFuentes = new Map();
async function cargarFuentes() {
  const archivos = (await readdir(FUENTES)).filter(f => f.endsWith(".ogg"));
  for (const f of archivos) {
    const { stdout } = await ejec("ffmpeg",
      ["-v", "error", "-i", join(FUENTES, f), "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"],
      { encoding: "buffer", maxBuffer: 1 << 28 });
    const n = Math.floor(stdout.length / 4);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = stdout.readFloatLE(i * 4);
    cacheFuentes.set(f.replace(/\.ogg$/, ""), x);
  }
  return archivos.length;
}
const F = nombre => {
  const x = cacheFuentes.get(nombre);
  if (!x) throw new Error("fuente que no existe: " + nombre);
  return x;
};

// ── Fabricar un sonido ────────────────────────────────────
function forjar(id, k) {
  const receta = CATALOGO[id];
  const c = CONTRATO[receta.cat];
  let x = receta.hacer(F, k);

  x = ACABADO[receta.cat](x);
  x = recortarCabeza(x, 0.0012);
  x = recortarCola(x, 0.0010);

  // Tope de duración ANTES de normalizar: si hay que recortar, mejor
  // que la sonoridad se calcule sobre lo que se va a oír de verdad.
  const nMax = secs(c.durMax);
  if (x.length > nMax) x = fadeOut(x.slice(0, nMax), 14);

  // Normalizar a la sonoridad de la categoría y sujetar el pico.
  const s = sonoridad(x);
  if (s > 1e-7) x = ganancia(x, dbToGain(c.objetivo) / s);
  x = limitar(x, { techo: c.pico, mirada: 0.004 });

  return x;
}

// ── Codificación ──────────────────────────────────────────
//  32 kHz mono. 16 kHz de ancho de banda sobran para este material y
//  quitan la parte del espectro donde el MP3 gasta más bits en algo que
//  en un altavoz de tableta no se oye.
async function aMp3(x, ruta, c) {
  const wav = ruta + ".wav";
  await writeFile(wav, aWav(x));
  await ejec("ffmpeg", ["-v", "error", "-y", "-i", wav,
    "-ac", "1", "-ar", String(c.sr), "-c:a", "libmp3lame", "-q:a", String(c.q),
    "-write_xing", "1", ruta]);
  const mp3 = await readFile(ruta);
  if (!GUARDAR_WAV) await rm(wav, { force: true });
  return mp3;
}

// ════════════════════════════════════════════════════════════
async function main() {
  if (!existsSync(FUENTES)) { console.error("Faltan las fuentes en " + FUENTES); process.exit(1); }
  await mkdir(TMP, { recursive: true });
  const nF = await cargarFuentes();
  console.log(`fuentes CC0 descodificadas: ${nF}\n`);

  const ids = Object.keys(CATALOGO).filter(id => !SOLO || SOLO.includes(id));
  const datos = {}, manifiesto = [], avisos = [];
  let bytes = 0, segundos = 0, nArchivos = 0;

  for (const id of ids) {
    const receta = CATALOGO[id];
    const c = CONTRATO[receta.cat];
    datos[id] = [];
    const filas = [];
    for (let k = 0; k < receta.n; k++) {
      const x = forjar(id, k);
      const m = medir(x);
      const mp3 = await aMp3(x, join(TMP, `${id}_${k}.mp3`), c);
      datos[id].push(mp3.toString("base64"));
      bytes += mp3.length; segundos += m.dur; nArchivos++;

      // Comprobaciones del contrato. Son la definición operativa de
      // "grueso": un sonido sin energía por debajo de 200 Hz suena a
      // juguete por muy alto que esté.
      const sDb = gainToDb(sonoridad(x));
      if (Math.abs(sDb - c.objetivo) > 1.6) avisos.push(`${id}#${k} sonoridad ${sDb.toFixed(1)} != ${c.objetivo}`);
      if (m.pico > c.pico + 0.005) avisos.push(`${id}#${k} pico ${m.pico.toFixed(3)} > ${c.pico}`);
      if (m.dur > c.durMax + 0.005) avisos.push(`${id}#${k} dura ${m.dur.toFixed(3)} > ${c.durMax}`);
      // Solo se le exige cuerpo a lo que dura lo bastante para tenerlo:
      // un impacto ligero de 36 ms no cabe medio ciclo de 100 Hz, y
      // exigírselo sería pedir que sonara a lo que no es. Lo marcado
      // como `agudo` tampoco: un aviso con sub compite con la explosión
      // justo en el momento en que más falta hace oírlo.
      if (!["ui", "premio"].includes(receta.cat) && !receta.agudo && m.dur > 0.12 && m.bandas.grave < 0.05)
        avisos.push(`${id}#${k} sin cuerpo grave (${(m.bandas.grave * 100).toFixed(1)}%)`);

      filas.push({ v: k, ms: Math.round(m.dur * 1000), pico: +m.pico.toFixed(3),
        son: +sDb.toFixed(1), cresta: +m.cresta.toFixed(1),
        grave: +(m.bandas.grave * 100).toFixed(0), agudo: +(m.bandas.agudo * 100).toFixed(0),
        kb: +(mp3.length / 1024).toFixed(1) });
    }
    manifiesto.push({ id, cat: receta.cat, variantes: receta.n, medidas: filas });
    const f0 = filas[0];
    console.log(`${id.padEnd(18)} ${receta.cat.padEnd(11)} x${receta.n}  ` +
      `${String(f0.ms).padStart(4)}ms  son ${String(f0.son).padStart(6)}dB  ` +
      `pico ${f0.pico.toFixed(2)}  grave ${String(f0.grave).padStart(2)}%  ` +
      `${filas.reduce((a, b) => a + b.kb, 0).toFixed(1)}kB`);
  }

  // ── Empaquetado ─────────────────────────────────────────
  const cuerpo = Object.entries(datos)
    .map(([id, v]) => `"${id}":[${v.map(b => `"${b}"`).join(",")}]`).join(",\n");
  const js = `// GENERADO por herramientas/forjar-audio.mjs — no editar a mano.
// Banco de efectos de FLIGHT STRIKE: MP3 mono 32 kHz en base64.
// Va como <script src> clásico a propósito: así funciona también con
// file://, que es donde fetch() falla y por lo que este juego no tenía
// archivos de audio. Fuentes y licencias: THIRD_PARTY_AUDIO_LICENSES.md
window.SFX_MUESTRAS = { v: 1, fmt: "mp3", sr: 32000, d: {
${cuerpo}
}};
`;
  await writeFile(SALIDA, js, "utf8");

  const sha = createHash("sha256").update(js).digest("hex");
  await writeFile(MANIFIESTO, JSON.stringify({
    generado: "herramientas/forjar-audio.mjs",
    formato: "mp3 mono 32 kHz VBR q6, base64 en audio/muestras.js",
    sha256_muestras_js: sha,
    contrato: CONTRATO,
    totales: { sonidos: ids.length, archivos: nArchivos,
      segundos: +segundos.toFixed(2), kb_mp3: +(bytes / 1024).toFixed(1),
      kb_js: +(Buffer.byteLength(js) / 1024).toFixed(1) },
    sonidos: manifiesto,
  }, null, 2), "utf8");

  // En Windows la carpeta puede quedar retenida por otro proceso; que no
  // se pueda borrar el temporal no invalida lo forjado.
  if (!GUARDAR_WAV) await rm(TMP, { recursive: true, force: true }).catch(() => {});

  console.log(`\n${nArchivos} archivos · ${segundos.toFixed(1)} s · ` +
    `${(bytes / 1024).toFixed(0)} kB mp3 · ${(Buffer.byteLength(js) / 1024).toFixed(0)} kB js`);
  console.log(`sha256 ${sha.slice(0, 16)}…`);
  if (avisos.length) { console.log(`\nAVISOS (${avisos.length}):`); avisos.forEach(a => console.log("  " + a)); }
  else console.log("\ncontrato de mezcla: todo dentro de tolerancia");
}

main().catch(e => { console.error(e); process.exit(1); });
