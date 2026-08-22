// ════════════════════════════════════════════════════════════
//  Piezas compartidas por sync.mjs y verify.mjs
//
//  CONTRATO, en una línea:
//    ORIGEN  = el repositorio canónico de Flight Strike
//    DESTINO = max/001-flight-strike/ dentro de PLAYZONE
//    El destino es una copia. No se edita a mano. Nunca.
// ════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const DESTINO = "max/001-flight-strike";
export const FICHA   = `${DESTINO}/build-info.json`;

// La ÚNICA diferencia permitida entre el index.html del origen y el del
// destino. Una línea, exacta, y verify.mjs sabe descontarla.
export const ETIQUETA_OVERLAY = '<script src="../_playzone/overlay.js" defer></script>';

// ── Qué NO se copia ───────────────────────────────────────
//  Lista de exclusión, no de inclusión: así, si el juego canónico
//  estrena una carpeta de assets que aquí no conocemos, se copia
//  igualmente. Preferimos copiar de más que perder un asset.
export const CARPETAS_FUERA = new Set([
  ".git", ".github", ".claude", ".vscode", ".idea", ".DS_Store",
  "node_modules", "herramientas", "tools", "scripts",
  "test", "tests", "__tests__", "spec",
  "docs", "doc", "screenshots", "capturas", "auditorias",
  "coverage", "dist-tools", "artifacts",
]);

export const FICHEROS_FUERA = new Set([
  ".gitignore", ".gitattributes", ".editorconfig", ".npmrc", ".nvmrc",
  "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "tsconfig.json", "eslint.config.js", ".eslintrc", ".eslintrc.json",
  "build-info.json",
]);

// Extensiones que son documentación, material de trabajo o empaquetado:
// nada de esto hace falta para que el juego arranque.
export const EXTENSIONES_FUERA = [
  ".md", ".zip", ".7z", ".rar", ".gz", ".tar",
  ".psd", ".ai", ".xcf", ".aseprite", ".fig", ".sketch",
  ".log", ".map", ".ts", ".tsx",
];

// LEEME.txt y compañía: documentación en texto plano.
export const NOMBRES_FUERA = [/^leeme/i, /^readme/i, /^auditoria/i, /^changelog/i];

// ── Lo que se copia SIEMPRE, gane quien gane ──────────────
//  Las licencias y atribuciones de terceros viajan con el juego: el
//  build se publica, y publicar los assets de otros sin su licencia
//  al lado no es una opción. Esto manda sobre cualquier exclusión,
//  incluida la de los .md.
export const SIEMPRE_DENTRO = [
  /licen[cs]e/i, /licencia/i, /third[_-]?party/i,
  /attribution/i, /cr[eé]dito?s/i, /credits/i,
];

export function seExcluye(rel) {
  const partes = rel.split(sep);
  const nombre = partes[partes.length - 1];

  for (const re of SIEMPRE_DENTRO) if (re.test(nombre)) return null;

  for (const p of partes.slice(0, -1)) if (CARPETAS_FUERA.has(p)) return `carpeta/${p}`;
  if (CARPETAS_FUERA.has(nombre)) return `carpeta/${nombre}`;
  if (FICHEROS_FUERA.has(nombre)) return `fichero/${nombre}`;

  const bajo = nombre.toLowerCase();
  for (const ext of EXTENSIONES_FUERA) if (bajo.endsWith(ext)) return `extension/${ext}`;
  for (const re of NOMBRES_FUERA) if (re.test(nombre)) return `documentacion/${nombre}`;
  return null;
}

// ── Recorrido ─────────────────────────────────────────────
export function listar(raiz, { aplicarExclusiones = true } = {}) {
  const dentro = [], fuera = [], enlaces = [];

  (function baja(dir) {
    let entradas;
    try { entradas = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entradas.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = join(dir, e.name);
      const rel = relative(raiz, abs);
      if (e.isSymbolicLink()) { enlaces.push(rel); continue; }
      if (e.isDirectory()) {
        if (aplicarExclusiones && CARPETAS_FUERA.has(e.name)) { fuera.push([rel, `carpeta/${e.name}`]); continue; }
        baja(abs);
        continue;
      }
      if (!e.isFile()) continue;
      const motivo = aplicarExclusiones ? seExcluye(rel) : null;
      if (motivo) fuera.push([rel, motivo]);
      else dentro.push(rel);
    }
  })(raiz);

  return { dentro, fuera, enlaces };
}

export const huella = (buf) => createHash("sha256").update(buf).digest("hex");
export const huellaDe = (ruta) => huella(readFileSync(ruta));

// ── El index.html del destino, sin la línea de PLAYZONE ───
//  Devuelve el contenido tal y como salió del origen, para poder
//  compararlo con su huella original.
export function quitarOverlay(texto) {
  const lineas = texto.split("\n");
  const i = lineas.findIndex((l) => l.trim() === ETIQUETA_OVERLAY);
  if (i === -1) return { limpio: texto, encontrado: false };
  lineas.splice(i, 1);
  return { limpio: lineas.join("\n"), encontrado: true };
}

export function ponerOverlay(texto) {
  const { limpio } = quitarOverlay(texto);           // idempotente
  const lineas = limpio.split("\n");
  // Justo antes de </body>, para que el juego ya esté montado.
  const i = lineas.map((l) => l.trim().toLowerCase()).lastIndexOf("</body>");
  if (i === -1) throw new Error("El index.html del origen no tiene </body> en su propia línea; no sé dónde inyectar el overlay.");
  lineas.splice(i, 0, ETIQUETA_OVERLAY);
  return lineas.join("\n");
}

export function esDirectorio(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}
