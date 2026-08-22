#!/usr/bin/env node
// ════════════════════════════════════════════════════════════
//  verify-flight-strike-sync
//
//  Responde a una sola pregunta, sin mirar el juego a ojo:
//
//      ¿el Flight Strike de PLAYZONE es el Flight Strike canónico?
//
//    node tools/flight-strike/verify.mjs                  → destino vs ficha
//    node tools/flight-strike/verify.mjs --source <ruta>  → y además vs origen
//
//  Sale con código 1 si algo no cuadra, para poder colgarlo de CI
//  o de un hook de pre-commit.
// ════════════════════════════════════════════════════════════
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DESTINO, FICHA, ETIQUETA_OVERLAY,
  listar, huella, huellaDe, quitarOverlay, esDirectorio,
} from "./common.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const iSrc = args.indexOf("--source");
const origen = iSrc !== -1 ? args[iSrc + 1] : null;

const fallos = [];
const avisos = [];
const falla = (m) => fallos.push(m);

// ── 1. La ficha ───────────────────────────────────────────
const fichaAbs = join(RAIZ, FICHA);
if (!existsSync(fichaAbs)) {
  console.error(`✗ Falta ${FICHA}. Sincroniza primero:\n    node tools/flight-strike/sync.mjs <ruta-al-repo-canonico>`);
  process.exit(1);
}
const ficha = JSON.parse(readFileSync(fichaAbs, "utf8"));
const manifiesto = ficha.ficheros || {};

console.log(`DESTINO  ${DESTINO}`);
console.log(`ORIGEN   ${ficha.origen?.etiqueta ?? ficha.origen?.ruta ?? "?"}`);
if (ficha.origen?.etiqueta) console.log(`         ${ficha.origen.ruta}`);
console.log(`         commit ${ficha.origen?.commit ? ficha.origen.commit.slice(0, 7) : "(sin commit registrado)"}` +
            `  ·  sincronizado ${ficha.sincronizado ?? "?"}`);
if (ficha.origen?.arbolSucio) avisos.push("El origen tenía cambios sin confirmar al sincronizar: el commit registrado no describe del todo lo copiado.");
console.log("");

// ── 2. El overlay de PLAYZONE existe ──────────────────────
if (!existsSync(join(RAIZ, "max/_playzone/overlay.js"))) {
  falla("Falta max/_playzone/overlay.js: el botón de volver al catálogo no cargaría.");
}

// ── 3. index.html = origen + exactamente una línea ────────
const idxAbs = join(RAIZ, DESTINO, "index.html");
if (!existsSync(idxAbs)) {
  falla(`Falta ${DESTINO}/index.html.`);
} else {
  const texto = readFileSync(idxAbs, "utf8");
  const veces = texto.split("\n").filter((l) => l.trim() === ETIQUETA_OVERLAY).length;
  if (veces === 0) falla("El index.html del destino no carga max/_playzone/overlay.js: no habría salida al catálogo.");
  if (veces > 1) falla(`La línea del overlay aparece ${veces} veces en index.html; debería aparecer una.`);

  const { limpio } = quitarOverlay(texto);
  const sha = huella(Buffer.from(limpio, "utf8"));
  if (ficha.indexOrigenSha && sha !== ficha.indexOrigenSha) {
    falla(`index.html NO coincide con el del origen.\n     esperado ${ficha.indexOrigenSha.slice(0, 16)}…\n     obtenido ${sha.slice(0, 16)}…\n     Alguien ha editado el destino a mano. El destino es una copia: los cambios van en el repo canónico.`);
  }
}

// ── 4. Todos los demás ficheros, huella a huella ──────────
let iguales = 0;
for (const [rel, shaEsperado] of Object.entries(manifiesto)) {
  if (rel === "index.html") continue;               // ya comprobado arriba
  const abs = join(RAIZ, DESTINO, rel);
  if (!existsSync(abs)) { falla(`Falta en el destino: ${rel}`); continue; }
  const sha = huellaDe(abs);
  if (sha !== shaEsperado) falla(`Cambiado a mano en el destino: ${rel}`);
  else iguales++;
}

// ── 5. Nada de más ────────────────────────────────────────
const { dentro: enDestino } = listar(join(RAIZ, DESTINO), { aplicarExclusiones: false });
for (const rel of enDestino) {
  const clave = rel.split("\\").join("/");
  if (clave === "build-info.json") continue;
  if (!(clave in manifiesto)) falla(`Sobra en el destino (no viene del origen): ${clave}`);
}

// ── 6. Opcional: ¿y el origen ha seguido avanzando? ───────
if (origen) {
  const ORIGEN = resolve(origen);
  if (!esDirectorio(ORIGEN)) {
    falla(`--source apunta a algo que no existe: ${ORIGEN}`);
  } else {
    const { dentro } = listar(ORIGEN);
    const actual = {};
    for (const rel of dentro) actual[rel.split("\\").join("/")] = huellaDe(join(ORIGEN, rel));

    const nuevos    = Object.keys(actual).filter((k) => !(k in manifiesto));
    const perdidos  = Object.keys(manifiesto).filter((k) => !(k in actual));
    const distintos = Object.keys(actual).filter((k) => k in manifiesto && actual[k] !== manifiesto[k]);

    if (nuevos.length || perdidos.length || distintos.length) {
      falla(`El origen ha cambiado desde la última sincronización` +
            ` (${nuevos.length} nuevos, ${distintos.length} modificados, ${perdidos.length} borrados).` +
            `\n     Vuelve a sincronizar: node tools/flight-strike/sync.mjs "${ORIGEN}"`);
      for (const k of [...nuevos.map((k) => `+ ${k}`), ...distintos.map((k) => `~ ${k}`), ...perdidos.map((k) => `- ${k}`)].slice(0, 15)) {
        console.log(`     ${k}`);
      }
    } else {
      console.log(`✓ El origen no ha cambiado desde la última sincronización.`);
    }
  }
}

// ── Veredicto ─────────────────────────────────────────────
for (const a of avisos) console.log(`⚠ ${a}`);
if (fallos.length === 0) {
  console.log(`✓ ${iguales + 1} ficheros comprobados: PLAYZONE Flight Strike == versión canónica.`);
  console.log(`  Única diferencia permitida: la línea del overlay de PLAYZONE.`);
  process.exit(0);
}
console.log("");
for (const f of fallos) console.log(`✗ ${f}`);
console.log(`\n${fallos.length} problema(s). PLAYZONE y la versión canónica NO están sincronizados.`);
process.exit(1);
