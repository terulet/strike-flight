#!/usr/bin/env node
// Minimal zero-dependency static server for local playtesting.
// ES modules require http(s), so file:// is not enough.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const full = resolve(join(ROOT, clean));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  try {
    let full = safePath(req.url || '/');
    if (!full) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(full).catch(() => null);
    if (info?.isDirectory()) {
      full = join(full, 'index.html');
      info = await stat(full).catch(() => null);
    }
    if (!info) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 Not Found');
      return;
    }
    const body = await readFile(full);
    res.writeHead(200, {
      'content-type': MIME[extname(full)] || 'application/octet-stream',
      'cache-control': 'no-cache, no-store, must-revalidate',
    }).end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('500 ' + err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  ONE MORE FLOOR — dev server\n  http://localhost:${PORT}/\n  (Ctrl+C to stop)\n`);
});
