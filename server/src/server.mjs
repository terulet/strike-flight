/**
 * Servidor HTTP. Sin framework: node:http, un enrutador de veinte lineas y
 * JSON. Todo lo que decide algo vive en api.mjs; esto solo traduce.
 */
import { createServer } from 'node:http';
import { config } from './config.mjs';
import { createStore, openDatabase } from './db.mjs';
import { createApi } from './api.mjs';
import { createDashboard } from './dashboard.mjs';
import { createHub } from './sse.mjs';
import { createStaticServer } from './static.mjs';
import { startBackupSchedule } from './backup.mjs';
import { computeBuildId } from './version.mjs';
import { ApiError } from './validate.mjs';

export function createPlayzoneServer(options = {}) {
  const db = options.db ?? openDatabase(options.dbPath ?? config.dbPath);
  const store = createStore(db);
  const hub = createHub();
  const api = createApi(store, {
    now: options.now,
    timezone: options.timezone,
    publish: (groupId, snapshot) => hub.publish(groupId, snapshot),
  });

  // Solo lectura: no comparte el store con la API, prepara sus propios SELECT.
  const dashboard = createDashboard(db);

  const buildId = options.buildId ?? computeBuildId();
  const serveStatic = createStaticServer(options.distDir ?? config.distDir);
  const backup = options.disableBackups
    ? null
    : startBackupSchedule(db, {
        dir: options.backupDir ?? config.backupDir,
        intervalMs: options.backupIntervalMs ?? config.backupIntervalMs,
        keep: options.backupKeep ?? config.backupKeep,
      });

  const buckets = new Map();
  function rateLimited(key) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + 60_000 });
      return false;
    }
    bucket.count++;
    return bucket.count > config.rateLimitPerMinute;
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => sendError(res, error));
  });

  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    cors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        day: api.serverDay(),
        streams: hub.size,
        buildId,
        lastBackup: backup?.last() ?? null,
      });
    }

    // Todo lo que no es /api es el frontend. Si no hay build (modo dev, dos
    // procesos), esto no encuentra nada y sigue hacia las rutas de la API.
    if (!path.startsWith('/api/') && serveStatic && (await serveStatic(req, res, path))) {
      return undefined;
    }

    const ip = req.socket.remoteAddress ?? 'desconocida';
    if (rateLimited(`${ip}:${path}`)) {
      return sendError(res, new ApiError(429, 'rate_limited', 'Demasiadas peticiones'));
    }

    // --- rutas abiertas (crear grupo / unirse) ---
    if (req.method === 'POST' && path === '/api/groups') {
      const body = await readJson(req, res);
      return sendJson(res, 201, api.createGroup(body));
    }
    if (req.method === 'POST' && path === '/api/groups/join') {
      const body = await readJson(req, res);
      return sendJson(res, 200, api.joinGroup(body));
    }

    // /api/errors es la unica ruta que funciona sin sesion: un fallo en el
    // onboarding, antes de tener grupo, tiene que poder contarse igual.
    if (req.method === 'POST' && path === '/api/errors') {
      const token = bearer(req) ?? url.searchParams.get('token');
      let anonymous = null;
      try {
        anonymous = token ? api.authenticate(token) : null;
      } catch {
        anonymous = null;
      }
      const body = await readJson(req, res);
      return sendJson(res, 202, api.recordClientError(anonymous, body));
    }

    // --- a partir de aqui hace falta credencial ---
    const token = bearer(req) ?? url.searchParams.get('token');
    const player = api.authenticate(token);

    if (req.method === 'GET' && path === '/api/snapshot') {
      return sendJson(res, 200, { snapshot: api.snapshotFor(player) });
    }
    if (req.method === 'POST' && path === '/api/scores') {
      const body = await readJson(req, res);
      return sendJson(res, 200, api.submitScore(player, body));
    }
    if (req.method === 'GET' && path === '/api/ghost') {
      return sendJson(res, 200, api.getGhost(player, {
        playerId: url.searchParams.get('playerId'),
        gameId: url.searchParams.get('gameId'),
        day: url.searchParams.get('day') ?? undefined,
      }));
    }
    if (req.method === 'POST' && path === '/api/name') {
      const body = await readJson(req, res);
      return sendJson(res, 200, api.rename(player, body?.name));
    }
    if (req.method === 'POST' && path === '/api/events') {
      const body = await readJson(req, res);
      return sendJson(res, 202, api.recordEvents(player, body));
    }
    if (req.method === 'GET' && path === '/api/stats') {
      return sendJson(res, 200, api.groupStats(player));
    }
    // Metricas agregadas de la semana. Solo lectura y solo del propio grupo:
    // no hay forma de tocar un resultado desde aqui ni de ver otro grupo.
    if (req.method === 'GET' && path === '/api/dashboard') {
      return sendJson(res, 200, {
        buildId,
        metrics: dashboard.metrics(player.group_id, api.serverDay()),
        errors: api.errorSummary(30),
      });
    }
    if (req.method === 'GET' && path === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      hub.subscribe(player.group_id, res);
      // Foto inicial para no esperar al primer cambio.
      res.write(`event: snapshot\ndata: ${JSON.stringify(api.snapshotFor(player))}\n\n`);
      return undefined;
    }

    return sendError(res, new ApiError(404, 'not_found', 'Ruta desconocida'));
  }

  function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }

  function bearer(req) {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    return header.slice(7);
  }

  function readJson(req, res) {
    return new Promise((resolve, reject) => {
      let size = 0;
      let rejected = false;
      const chunks = [];
      req.on('data', (chunk) => {
        if (rejected) return;
        size += chunk.length;
        if (size > config.maxBodyBytes) {
          rejected = true;
          chunks.length = 0;
          // Dejamos de leer, contestamos 413 y solo despues cerramos el socket:
          // si lo destruyeramos ya, el movil veria "conexion perdida" en vez
          // del error real.
          req.pause();
          res.on('finish', () => req.destroy());
          reject(new ApiError(413, 'payload_too_large', 'Peticion demasiado grande'));
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (chunks.length === 0) return resolve({});
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new ApiError(400, 'invalid_json', 'JSON invalido'));
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
  }

  function sendError(res, error) {
    const status = error instanceof ApiError ? error.status : 500;
    const code = error instanceof ApiError ? error.code : 'server_error';
    if (status >= 500) console.error('[playzone]', error);
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, status, { ok: false, error: code, message: error.message });
  }

  return {
    server,
    api,
    store,
    db,
    hub,
    listen(port = config.port, host = config.host) {
      return new Promise((resolve) => {
        server.listen(port, host, () => resolve(server.address()));
      });
    },
    buildId,
    logServerError(source, error) {
      api.recordServerError(source, error);
    },
    close() {
      hub.close();
      backup?.stop();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
