/**
 * Empaquetador de un solo archivo, sin dependencias.
 *
 * Recorre el grafo de imports desde src/main.js, ordena los módulos en
 * profundidad, quita `import`/`export` y lo concatena todo dentro de una
 * IIFE que se inyecta en el HTML. Salida: UN archivo que se abre con doble
 * clic, se manda por AirDrop al iPhone o se publica tal cual.
 *
 * Es legítimo preguntar por qué no un empaquetador de verdad. Porque este
 * proyecto no tiene dependencias y no debe tenerlas: cualquier ordenador con
 * Node ejecuta el juego hoy, sin `npm install`, sin red y sin caducar.
 *
 *   node tools/build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = resolve(ROOT, 'src/main.js');
const OUT_DIR = resolve(ROOT, 'dist');
const OUT = resolve(OUT_DIR, 'last-light.html');

const IMPORT_RE = /^\s*import\s+[\s\S]*?\s+from\s+['"](.+?)['"]\s*;?\s*$/gm;
const EXPORT_RE = /^(\s*)export\s+(?=(?:default\s+)?(?:class|const|let|var|function|async))/gm;

/** Recorrido en profundidad: una dependencia siempre se emite antes que quien la usa. */
const emitted = new Set();
const order = [];

function collect(file) {
  if (emitted.has(file)) return;
  emitted.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1];
    if (!spec.startsWith('.')) throw new Error(`${relative(ROOT, file)}: import externo no soportado: ${spec}`);
    collect(resolve(dirname(file), spec));
  }
  order.push({ file, src });
}

collect(ENTRY);

// Todos los módulos acaban compartiendo un único ámbito, así que dos nombres
// iguales en archivos distintos se pisarían en silencio. Mejor reventar aquí.
const declared = new Map();
// Sin `\s*` inicial a propósito: solo interesan las declaraciones de nivel
// superior, que son las que comparten ámbito. Las locales quedan encerradas
// en su función y pueden repetirse tranquilamente.
const DECL_RE = /^(?:export\s+)?(?:async\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
for (const { file, src } of order) {
  for (const m of src.matchAll(DECL_RE)) {
    const name = m[1];
    if (declared.has(name)) {
      throw new Error(
        `Colisión de nombre "${name}" entre ${relative(ROOT, declared.get(name))} y ${relative(ROOT, file)}.\n` +
        `Al empaquetar comparten ámbito: renombra uno de los dos.`);
    }
    declared.set(name, file);
  }
}

const bundle = order
  .map(({ file, src }) => {
    const body = src.replace(IMPORT_RE, '').replace(EXPORT_RE, '$1');
    return `/* ── ${relative(ROOT, file)} ─────────────────────────── */\n${body.trim()}\n`;
  })
  .join('\n');

const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const out = html.replace(
  /<script type="module" src="\.\/src\/main\.js"><\/script>/,
  `<script>\n(function(){\n"use strict";\n${bundle}\n})();\n</script>`,
);

if (out === html) throw new Error('No se encontró la etiqueta <script> de entrada en index.html');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`✓ ${relative(ROOT, OUT)}  ${kb} kB  ·  ${order.length} módulos, ${declared.size} símbolos`);
