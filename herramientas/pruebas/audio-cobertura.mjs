// ════════════════════════════════════════════════════════════
//  audio-cobertura.mjs — el audio no puede pedir lo que no existe
// ════════════════════════════════════════════════════════════
//
//    node herramientas/pruebas/audio-cobertura.mjs
//
//  Comprueba cuatro cosas que solo se ven mirando el juego entero:
//
//    1. Ningún sfx("x") pide un id que no esté en el catálogo. Un id
//       inventado no da error: sale por `if (!s) return` y el evento se
//       queda mudo para siempre sin que nadie se entere.
//    2. Ninguna tabla (ARMAS.snd, MUERTES.snd, IMPACTOS.snd) apunta a un
//       id que no exista. Este es el fallo que tenía IMPACTOS "rotura".
//    3. Todo id del banco de muestras corresponde a un sonido real, y
//       todo sonido del catálogo tiene su grupo de mezcla asignado.
//    4. Qué sonidos del catálogo NO los dispara nadie. No es un error
//       —un repuesto puede existir sin usarse— pero tiene que salir en
//       la lista para que sea una decisión y no un olvido.

import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = await readFile(join(RAIZ, "index.html"), "utf8");

const sacar = re => { const r = new Set(); let m; while ((m = re.exec(html))) r.add(m[1]); return r; };

// El catálogo: las claves de primer nivel dentro de `const SONIDOS = {`.
const bloque = html.slice(html.indexOf("const SONIDOS = {"));
const finCat = bloque.indexOf("\n};");
const catalogo = new Set();
for (const m of bloque.slice(0, finCat).matchAll(/^\s{2}([a-z_0-9]+)\s*:\s*\{\s*bus:/gm)) catalogo.add(m[1]);

// No basta con sfx("x": también hay llamadas con ternario, como
// sfx(d.epico ? "finale" : "victoria"). Se recogen todas las cadenas
// que aparezcan dentro de la llamada.
const pedidos = new Set();
for (const m of html.matchAll(/sfx\(([^;\n]*)/g))
  for (const q of m[1].matchAll(/"([a-z_0-9]+)"/g)) pedidos.add(q[1]);
const porTabla  = new Set([
  ...[...html.matchAll(/snd:\s*"([a-z_0-9]+)"/g)].map(m => m[1]),
]);
const grupos = new Set([...html.matchAll(/^\s*(disparo|enemigo|impacto|explosion|jefe):\s*\[([^\]]*)\]/gm)]
  .flatMap(m => [...m[2].matchAll(/"([a-z_0-9]+)"/g)].map(x => x[1])));

const banco = JSON.parse(await readFile(join(RAIZ, "audio", "MANIFIESTO.json"), "utf8"));
const enBanco = new Set(banco.sonidos.map(s => s.id));

const fallos = [], notas = [];

for (const id of pedidos) if (!catalogo.has(id)) fallos.push(`sfx("${id}") no está en SONIDOS`);
for (const id of porTabla) if (!catalogo.has(id)) fallos.push(`una tabla apunta a snd:"${id}", que no existe`);
for (const id of enBanco) if (!catalogo.has(id)) fallos.push(`el banco trae "${id}", que no está en SONIDOS`);
for (const id of grupos) if (!catalogo.has(id)) fallos.push(`GRUPO_DE nombra "${id}", que no existe`);

const usados = new Set([...pedidos, ...porTabla]);
const sinUsar = [...catalogo].filter(id => !usados.has(id));
const sinMuestra = [...catalogo].filter(id => !enBanco.has(id));

if (sinUsar.length) notas.push("sin evento que los dispare: " + sinUsar.join(" "));
if (sinMuestra.length) notas.push("solo sintetizados (sin muestra): " + sinMuestra.join(" "));

console.log(`catálogo ......... ${catalogo.size} sonidos`);
console.log(`banco ............ ${enBanco.size} ids · ${banco.totales.archivos} archivos · ${banco.totales.kb_js} kB`);
console.log(`pedidos por sfx() . ${pedidos.size} ids distintos`);
console.log(`pedidos por tabla . ${porTabla.size} ids distintos`);
notas.forEach(n => console.log("nota: " + n));

if (fallos.length) { console.log("\nFALLOS:"); fallos.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("\nOK — ninguna ruta de audio rota");
