/**
 * Servidor de estaticos para produccion.
 *
 * En desarrollo, Vite sirve el frontend y reenvia /api al backend (dos
 * procesos). En produccion es al reves y mas simple: un unico proceso Node
 * sirve `dist/` Y `/api/*` desde el mismo puerto. Una URL, sin CORS, sin
 * segundo proceso que mantener vivo.
 *
 * `index.html` (y el manifest/service worker) se sirven SIEMPRE con
 * no-cache: son el punto de entrada, y tienen que revalidarse en cada visita
 * para que una build nueva se recoja sola. Los ficheros de `assets/` llevan
 * hash en el nombre (Vite), asi que son inmutables de verdad: cache de un ano.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** No-cache para el punto de entrada y lo que decide si hay version nueva. */
const NEVER_CACHE = new Set(['/index.html', '/', '/sw.js', '/manifest.webmanifest']);

export function createStaticServer(distDir) {
  if (!existsSync(distDir)) return null;

  async function listFiles() {
    const out = [];
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else out.push(full);
      }
    }
    await walk(distDir);
    return out;
  }

  // Se indexa una vez al arrancar: la build ya esta hecha, no cambia en caliente.
  const files = new Map();
  let ready = listFiles().then((paths) => {
    for (const path of paths) {
      const url = '/' + relative(distDir, path).split(sep).join('/');
      files.set(url, path);
    }
  });

  function contentTypeFor(path) {
    return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
  }

  function cacheControlFor(url) {
    if (NEVER_CACHE.has(url)) return 'no-cache';
    if (url.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
    return 'public, max-age=3600';
  }

  function send(res, filePath, url) {
    const stat = statSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Content-Length': stat.size,
      'Cache-Control': cacheControlFor(url),
    });
    createReadStream(filePath).pipe(res);
  }

  /** true si se ha atendido la peticion. */
  return async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    await ready;

    const direct = files.get(pathname === '/' ? '/index.html' : pathname);
    if (direct) {
      send(res, direct, pathname === '/' ? '/index.html' : pathname);
      return true;
    }

    // Nada de rutas del lado del cliente (todo va por query string aqui),
    // pero un fallback a index.html es barato y evita sorpresas con
    // mayusculas, barras finales, o un enlace mal copiado.
    const looksLikeFile = /\.[a-z0-9]+$/i.test(pathname);
    if (!looksLikeFile) {
      const shell = files.get('/index.html');
      if (shell) {
        send(res, shell, '/index.html');
        return true;
      }
    }
    return false;
  };
}
