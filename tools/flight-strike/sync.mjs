#!/usr/bin/env node
// ════════════════════════════════════════════════════════════
//  sync-flight-strike
//
//  Copia el runtime del Flight Strike canónico dentro de PLAYZONE.
//
//    node tools/flight-strike/sync.mjs <ruta-al-repo-canonico> [--dry-run] [--label "texto"]
//
//  Ejemplo (Windows):
//    node tools/flight-strike/sync.mjs "C:/Users/TeRuLeT/Desktop/PROJECTES SOFTS/JOCS/strike-flight-repo"
//
//  Qué hace, por orden:
//    1. comprueba que el origen es de verdad un Flight Strike
//    2. copia todo menos lo que no hace falta para jugar
//    3. inyecta UNA línea en index.html: la del overlay de PLAYZONE
//    4. escribe build-info.json con el commit de origen y la huella
//       sha256 de cada fichero, para que verify.mjs pueda demostrar
//       que destino y origen son el mismo juego
//
//  Lo que este script NO hace, a propósito: tocar el juego. Ni escalar,
//  ni recortar, ni "adaptar". PLAYZONE se adapta al juego.
// ════════════════════════════════════════════════════════════
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DESTINO, FICHA, ETIQUETA_OVERLAY,
  listar, huella, huellaDe, ponerOverlay, esDirectorio,
} from "./common.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args    = process.argv.slice(2);
const seco    = args.includes("--dry-run");
const iEtiq   = args.indexOf("--label");
const etiqueta = iEtiq !== -1 ? args[iEtiq + 1] : null;
const iValor  = iEtiq === -1 ? -1 : iEtiq + 1;   // el texto que sigue a --label no es la ruta
const origen  = args.filter((a, i) => !a.startsWith("--") && i !== iValor)[0];

if (!origen) {
  console.error("Uso: node tools/flight-strike/sync.mjs <ruta-al-repo-canonico> [--dry-run] [--label \"texto\"]");
  process.exit(2);
}

const ORIGEN = resolve(origen);
if (!esDirectorio(ORIGEN)) {
  console.error(`✗ No existe la carpeta de origen:\n  ${ORIGEN}`);
  process.exit(2);
}
if (!existsSync(join(ORIGEN, "index.html"))) {
  console.error(`✗ En el origen no hay index.html. Esto no parece Flight Strike:\n  ${ORIGEN}`);
  process.exit(2);
}

// ── De qué commit viene ───────────────────────────────────
function commitDeOrigen() {
  try {
    const git = (...a) => execFileSync("git", ["-C", ORIGEN, ...a], { encoding: "utf8" }).trim();
    const sucio = git("status", "--porcelain") !== "";
    return { commit: git("rev-parse", "HEAD"), asunto: git("log", "-1", "--format=%s"), sucio };
  } catch {
    return { commit: null, asunto: null, sucio: null };
  }
}

const { dentro, fuera, enlaces } = listar(ORIGEN);
const proc = commitDeOrigen();

console.log(`ORIGEN   ${ORIGEN}`);
console.log(`         commit ${proc.commit ? proc.commit.slice(0, 7) : "(no es un repo git)"}` +
            `${proc.sucio ? "  ⚠ árbol con cambios sin confirmar" : ""}`);
console.log(`DESTINO  ${DESTINO}\n`);

if (enlaces.length) {
  console.log("⚠ Enlaces simbólicos ignorados (cópialos a mano si hacen falta):");
  for (const e of enlaces) console.log(`   ${e}`);
  console.log("");
}

// Nada de recortes silenciosos: se enseña todo lo que se queda fuera.
console.log(`Se copian ${dentro.length} ficheros. Se dejan fuera ${fuera.length}:`);
const porMotivo = new Map();
for (const [rel, motivo] of fuera) {
  const clave = motivo.split("/")[0];
  if (!porMotivo.has(clave)) porMotivo.set(clave, []);
  porMotivo.get(clave).push(rel);
}
for (const [clave, lista] of [...porMotivo].sort()) {
  console.log(`   ${clave.padEnd(14)} ${lista.length}`);
  for (const r of lista.slice(0, 8)) console.log(`       · ${r}`);
  if (lista.length > 8) console.log(`       · … y ${lista.length - 8} más`);
}
console.log("");

if (seco) {
  console.log("--dry-run: no se ha escrito nada.");
  process.exit(0);
}

// ── Copia ─────────────────────────────────────────────────
const destAbs = join(RAIZ, DESTINO);
rmSync(destAbs, { recursive: true, force: true });
mkdirSync(destAbs, { recursive: true });

const manifiesto = {};
for (const rel of dentro) {
  const src = join(ORIGEN, rel);
  const dst = join(destAbs, rel);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  manifiesto[rel.split("\\").join("/")] = huellaDe(src);
}

// ── La única línea que PLAYZONE añade ─────────────────────
const idx = join(destAbs, "index.html");
const original = readFileSync(idx, "utf8");
writeFileSync(idx, ponerOverlay(original), "utf8");

// ── La ficha que hace posible el control de paridad ───────
const ficha = {
  _comentario: [
    "Generado por tools/flight-strike/sync.mjs. NO editar a mano.",
    "El juego de max/001-flight-strike es una copia del repositorio canónico.",
    "Para cambiar el juego se cambia el ORIGEN y se vuelve a sincronizar.",
  ],
  origen: {
    etiqueta,
    ruta: ORIGEN,
    commit: proc.commit,
    asunto: proc.asunto,
    arbolSucio: proc.sucio,
  },
  sincronizado: new Date().toISOString(),
  overlay: ETIQUETA_OVERLAY,
  // Huella del index.html TAL COMO ESTÁ EN EL ORIGEN, sin la línea del
  // overlay: es lo que compara verify.mjs después de descontarla.
  indexOrigenSha: huella(Buffer.from(original, "utf8")),
  ficheros: manifiesto,
};
writeFileSync(join(RAIZ, FICHA), JSON.stringify(ficha, null, 2) + "\n", "utf8");

console.log(`✓ ${dentro.length} ficheros copiados en ${DESTINO}`);
console.log(`✓ overlay inyectado (1 línea) en ${DESTINO}/index.html`);
console.log(`✓ ficha escrita en ${FICHA}`);
console.log(`\nComprueba la paridad con:  node tools/flight-strike/verify.mjs`);
