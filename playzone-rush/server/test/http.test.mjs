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

    /**
     * SSE es un protocolo de lineas, no de paquetes: el servidor hace dos
     * write() (el retry y la foto) y que lleguen juntos o separados depende
     * del buffering de la version de Node, no de que el codigo este bien. Hay
     * que acumular hasta encontrar lo que se busca; dar por hecho que cabe
     * todo en el primer chunk hace que el test pase o falle segun la maquina.
     */
    async function readUntil(needle, maxChunks = 8) {
      let buffer = '';
      for (let i = 0; i < maxChunks && !buffer.includes(needle); i++) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      return buffer;
    }

    // La primera foto llega sola, sin esperar a que cambie nada.
    expect(await readUntil('event: snapshot')).toContain('event: snapshot');

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

  it('acepta un error de cliente sin credencial (antes de tener grupo)', async () => {
    const response = await post('/api/errors', { message: 'fallo en el onboarding', url: '/onboarding' });
    expect(response.status).toBe(202);
    expect((await response.json()).ok).toBe(true);

    const row = instance.store.recentErrors.all(1)[0];
    expect(row.source).toBe('client');
    expect(row.player_id).toBeNull();
    expect(row.message).toBe('fallo en el onboarding');
  });

  it('atribuye el error de cliente al jugador cuando llega con Bearer token', async () => {
    const eloi = await createPlayer('Eloi');
    await post('/api/errors', { message: 'algo raro en portada' }, eloi.token);

    const row = instance.store.recentErrors.all(1)[0];
    expect(row.player_id).toBe(eloi.player.id);
  });

  it('tambien atribuye el error si el token llega por query string (asi lo manda sendBeacon)', async () => {
    const eloi = await createPlayer('Eloi');
    const response = await fetch(`${base}/api/errors?token=${encodeURIComponent(eloi.token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'via beacon' }),
    });
    expect(response.status).toBe(202);

    const row = instance.store.recentErrors.all(1)[0];
    expect(row.player_id).toBe(eloi.player.id);
    expect(row.message).toBe('via beacon');
  });

  it('un token invalido en /api/errors no revienta: se guarda como anonimo', async () => {
    const response = await post('/api/errors', { message: 'token basura' }, 'esto-no-es-un-token-valido');
    expect(response.status).toBe(202);
    const row = instance.store.recentErrors.all(1)[0];
    expect(row.player_id).toBeNull();
    expect(row.message).toBe('token basura');
  });
});

/**
 * Grupos grandes.
 *
 * La regla del reto secreto era "todos los que han abierto hoy". Con cinco
 * personas es un logro de equipo; con veinticinco basta uno que juegue dos
 * retos y se vaya para bloquear al grupo todos los dias. Estas pruebas fijan
 * que el umbral funciona en grande y que en pequeno no regala nada.
 */
describe('grupos grandes y reto secreto', () => {
  const RETOS = ['c1', 'c2', 'c3'];

  /** Juega los tres retos del dia con ese jugador. */
  async function completarDia(jugador, base = 1000) {
    const day = (await get('/api/health').then((r) => r.json())).day;
    for (const challengeId of RETOS) {
      const respuesta = await post(
        '/api/scores',
        {
          // attemptId pide entre 8 y 64 caracteres: el id del jugador ya los
          // trae de sobra y ademas hace la peticion idempotente por reto.
          attemptId: `${jugador.player.id}-${challengeId}`,
          challengeId,
          gameId: 'pulse',
          day,
          score: base,
          durationMs: 30000,
        },
        jugador.token,
      );
      // Si el servidor rechaza la marca, la prueba miente: diria que el
      // secreto no se abre cuando en realidad nadie ha jugado.
      expect(respuesta.status, `marca de ${jugador.player.name} en ${challengeId}`).toBe(200);
    }
  }

  const secretoDe = async (jugador) =>
    (await get('/api/snapshot', jugador.token).then((r) => r.json())).snapshot.secret;

  it('caben 25 personas en un grupo', async () => {
    const dueno = await createPlayer('ELOI');
    const codigo = dueno.group.code;
    for (let i = 1; i < 25; i++) {
      const respuesta = await post('/api/groups/join', { code: codigo, name: `J${i}` });
      expect(respuesta.status, `al entrar el numero ${i + 1}`).toBe(200);
    }
    const estado = (await get('/api/snapshot', dueno.token).then((r) => r.json())).snapshot;
    expect(estado.members).toHaveLength(25);
    expect(estado.group.maxPlayers).toBe(25);
  });

  it('el 26 se queda fuera', async () => {
    const dueno = await createPlayer('ELOI');
    for (let i = 1; i < 25; i++) await post('/api/groups/join', { code: dueno.group.code, name: `J${i}` });
    const sobra = await post('/api/groups/join', { code: dueno.group.code, name: 'SOBRA' });
    expect(sobra.status).toBe(409);
  });

  it('en un grupo grande, cinco que acaben abren el secreto', async () => {
    const dueno = await createPlayer('ELOI');
    const jugadores = [dueno];
    for (let i = 1; i < 12; i++) jugadores.push(await joinPlayer(dueno.group.code, `J${i}`));

    // Todos han abierto la app hoy (entrar ya cuenta como presencia), pero
    // solo cuatro completan: todavia no.
    for (const j of jugadores.slice(0, 4)) await completarDia(j);
    let secreto = await secretoDe(dueno);
    expect(secreto.unlocked, 'con cuatro de doce todavia no').toBe(false);
    expect(secreto.neededCount, 'hacen falta cinco, no doce').toBe(5);

    // El quinto lo abre para todos.
    await completarDia(jugadores[4]);
    secreto = await secretoDe(dueno);
    expect(secreto.unlocked, 'con el quinto se abre').toBe(true);
  });

  it('en un grupo pequeno siguen haciendo falta todos', async () => {
    // Con tres personas el umbral se limita a las tres: no se regala nada.
    const dueno = await createPlayer('ELOI');
    const b = await joinPlayer(dueno.group.code, 'MARC');
    const c = await joinPlayer(dueno.group.code, 'KALI');

    await completarDia(dueno);
    await completarDia(b);
    let secreto = await secretoDe(dueno);
    expect(secreto.neededCount).toBe(3);
    expect(secreto.unlocked, 'faltando uno de tres, no').toBe(false);

    await completarDia(c);
    secreto = await secretoDe(dueno);
    expect(secreto.unlocked, 'con los tres, si').toBe(true);
  });

  it('quien no ha abierto hoy no bloquea al grupo', async () => {
    // Es la regla que ya existia y que no se debe romper al meter el umbral.
    const dueno = await createPlayer('ELOI');
    const b = await joinPlayer(dueno.group.code, 'MARC');
    await completarDia(dueno);
    await completarDia(b);
    const secreto = await secretoDe(dueno);
    expect(secreto.unlocked).toBe(true);
    expect(secreto.activeCount).toBe(2);
  });
});
