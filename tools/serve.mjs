/**
 * Servidor estático mínimo para desarrollo.
 *
 * Los módulos ES exigen origen http:// (con file:// el navegador los bloquea
 * por CORS), así que hace falta un servidor. Este no tiene dependencias, no
 * cachea nada y sirve para exactamente eso.
 *
 *   node tools/serve.mjs [puerto]
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 5178);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path.endsWith('/')) path += 'index.html';

    // normalize + comprobación de prefijo: sin esto, `../../etc/passwd`.
    const file = join(ROOT, normalize(path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }

    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`LAST LIGHT  →  http://localhost:${PORT}`);
  // La IP de red es lo que se teclea en el iPhone para probar en el móvil.
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`             →  http://${n.address}:${PORT}   (iPhone/iPad en la misma wifi)`);
    }
  }
});
