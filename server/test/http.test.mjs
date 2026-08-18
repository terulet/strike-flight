/** Pruebas del servidor HTTP de verdad: sockets, cabeceras, SSE y limites. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPlayzoneServer } from '../src/server.mjs';

let instance;
let base;

beforeEach(async () => {
  instance = createPlayzoneServer({ dbPath: ':memory:', timezone: 'Europe/Madrid' });
  const address = await instance.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await instance.close();
});

const post = (path, body, token) =>
  fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const get = (path, token) =>
  fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

async function createPlayer(name) {
  const response = await post('/api/groups', { name });
  const data = await response.json();
  return { ...data, token: `${data.player.id}.${data.player.secret}` };
}

async function joinPlayer(code, name) {
  const response = await post('/api/groups/join', { code, name });
  const data = await response.json();
  return { ...data, token: `${data.player.id}.${data.player.secret}` };
}

describe('servidor http', () => {
  it('responde al health check', async () => {
    const data = await get('/api/health').then((r) => r.json());
    expect(data.ok).toBe(true);
    expect(data.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('permite el flujo completo crear -> unirse -> puntuar -> ver', async () => {
    const eloi = await createPlayer('Eloi');
    const marc = await joinPlayer(eloi.group.code, 'Marc');

    const day = (await get('/api/health').then((r) => r.json())).day;
    const submit = await post(
      '/api/scores',
      {
        attemptId: 'http-attempt-01',
        gameId: 'pulse',
        challengeId: 'c1',
        day,
        score: 6200,
        durationMs: 30_000,
        attemptsUsed: 1,
      },
      eloi.token,
    ).then((r) => r.json());
    expect(submit.bestScore).toBe(6200);

    const snapshot = await get('/api/snapshot', marc.token).then((r) => r.json());
    const mine = snapshot.snapshot.scores.find((s) => s.playerId === eloi.player.id);
    expect(mine.bestScore).toBe(6200);
  });

  it('rechaza peticiones sin credencial', async () => {
    const response = await get('/api/snapshot');
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('unauthorized');
  });

  it('rechaza cuerpos gigantes', async () => {
    const eloi = await createPlayer('Eloi');
    const response = await post('/api/scores', { relleno: 'x'.repeat(70_000) }, eloi.token);
    expect([400, 413]).toContain(response.status);
  });

  it('rechaza JSON invalido', async () => {
    const eloi = await createPlayer('Eloi');
    const response = await fetch(`${base}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${eloi.token}` },
      body: '{esto no es json',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_json');
  });

  it('devuelve 404 en rutas desconocidas', async () => {
    const eloi = await createPlayer('Eloi');
    expect((await get('/api/loquesea', eloi.token)).status).toBe(404);
  });

  it('empuja el snapshot por SSE cuando alguien puntua', async () => {
    const eloi = await createPlayer('Eloi');
    const marc = await joinPlayer(eloi.group.code, 'Marc');
    const day = (await get('/api/health').then((r) => r.json())).day;

    const controller = new AbortController();
    const stream = await fetch(`${base}/api/stream?token=${encodeURIComponent(eloi.token)}`, {
      signal: controller.signal,
    });
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();

    // La primera foto llega sola, sin esperar a que cambie nada.
    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain('event: snapshot');

    await post(
      '/api/scores',
      {
        attemptId: 'sse-attempt-01',
        gameId: 'snap',
        challengeId: 'c2',
        day,
        score: 4321,
        durationMs: 30_000,
        attemptsUsed: 1,
      },
      marc.token,
    );

    let payload = '';
    for (let i = 0; i < 5 && !payload.includes('4321'); i++) {
      payload += decoder.decode((await reader.read()).value);
    }
    expect(payload).toContain('4321');

    controller.abort();
  });

  it('el mismo intento enviado dos veces no duplica nada', async () => {
    const eloi = await createPlayer('Eloi');
    const day = (await get('/api/health').then((r) => r.json())).day;
    const payload = {
      attemptId: 'idem-http-01',
      gameId: 'drift',
      challengeId: 'c1',
      day,
      score: 5000,
      durationMs: 30_000,
      attemptsUsed: 1,
    };
    const [a, b] = await Promise.all([
      post('/api/scores', payload, eloi.token).then((r) => r.json()),
      post('/api/scores', payload, eloi.token).then((r) => r.json()),
    ]);
    const snapshot = await get('/api/snapshot', eloi.token).then((r) => r.json());
    const row = snapshot.snapshot.scores.find((s) => s.challengeId === 'c1');
    // Una de las dos puede ser la duplicada; lo importante es que solo cuenta una.
    expect(a.bestScore).toBe(5000);
    expect(b.bestScore).toBe(5000);
    expect(row.plays).toBe(1);
    expect(row.attemptsUsed).toBe(1);
  });
});
