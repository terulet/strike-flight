/** Pruebas de la logica del backend, sin abrir sockets. */
import { beforeEach, describe, expect, it } from 'vitest';
import { createApi } from '../src/api.mjs';
import { config } from '../src/config.mjs';
import { createStore, openDatabase } from '../src/db.mjs';

let store;
let api;
let clock;
let published;

function setup(startMs = Date.parse('2026-08-18T10:00:00+02:00')) {
  const db = openDatabase(':memory:');
  store = createStore(db);
  clock = startMs;
  published = [];
  api = createApi(store, {
    now: () => clock,
    timezone: 'Europe/Madrid',
    publish: (groupId, snapshot) => published.push({ groupId, snapshot }),
  });
}

const token = (player) => `${player.id}.${player.secret}`;

/** Los errores del backend llevan codigo maquina + mensaje humano: probamos el codigo. */
function expectError(fn, code) {
  try {
    fn();
  } catch (error) {
    expect(error.code).toBe(code);
    return error;
  }
  throw new Error(`Se esperaba el error "${code}" pero no fallo`);
}

function play(player, { challengeId = 'c1', gameId = 'pulse', score = 1000, attemptId, ghost } = {}) {
  return api.submitScore(player, {
    attemptId: attemptId ?? `at-${Math.random().toString(36).slice(2, 12)}-${score}`,
    gameId,
    challengeId,
    day: api.serverDay(),
    score,
    durationMs: 30_000,
    attemptsUsed: 1,
    ghost,
  });
}

beforeEach(() => setup());

describe('grupos', () => {
  it('crea un grupo con codigo legible y mete al creador dentro', () => {
    const { group, player, snapshot } = api.createGroup({ name: 'Eloi' });
    expect(group.code).toMatch(/^[34679ACDEFGHJKMNPQRTUVWXY]{4}$/);
    expect(player.name).toBe('Eloi');
    expect(player.secret).toHaveLength(48);
    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.group.maxPlayers).toBe(config.maxPlayersPerGroup);
  });

  it('los codigos no se repiten', () => {
    const codes = new Set();
    for (let i = 0; i < 40; i++) codes.add(api.createGroup({ name: `J${i}` }).group.code);
    expect(codes.size).toBe(40);
  });

  it('permite unirse con el codigo, en minusculas y con espacios', () => {
    const { group } = api.createGroup({ name: 'Eloi' });
    const joined = api.joinGroup({ code: ` ${group.code.toLowerCase()} `, name: 'Marc' });
    expect(joined.snapshot.members.map((m) => m.name).sort()).toEqual(['Eloi', 'Marc']);
  });

  it('rechaza un grupo que no existe', () => {
    expectError(() => api.joinGroup({ code: 'ZZZZ', name: 'Marc' }), 'group_not_found');
  });

  it('rechaza cuando el grupo esta lleno', () => {
    const { group } = api.createGroup({ name: 'J0' });
    for (let i = 1; i < config.maxPlayersPerGroup; i++) {
      api.joinGroup({ code: group.code, name: `J${i}` });
    }
    expectError(() => api.joinGroup({ code: group.code, name: 'Sobra' }), 'group_full');
  });

  it('limpia el nombre y rechaza el vacio', () => {
    const { player } = api.createGroup({ name: '  <b>Marc</b>   el   grande  ' });
    expect(player.name).not.toContain('<');
    expect(player.name).not.toContain('>');
    expect(player.name.length).toBeLessThanOrEqual(16);
    expect(player.name.startsWith('b Marc')).toBe(true);
    expectError(() => api.createGroup({ name: '   ' }), 'invalid_name');
  });

  it('permite cambiar el nombre', () => {
    const { player } = api.createGroup({ name: 'Eloi' });
    const full = store.playerById.get(player.id);
    const renamed = api.rename(full, 'ELOI2');
    expect(renamed.name).toBe('ELOI2');
    expect(renamed.snapshot.members[0].name).toBe('ELOI2');
  });
});

describe('identidad', () => {
  it('reconoce al jugador por su credencial', () => {
    const { player } = api.createGroup({ name: 'Eloi' });
    expect(api.authenticate(token(player)).id).toBe(player.id);
  });

  it('rechaza credenciales invalidas', () => {
    const { player } = api.createGroup({ name: 'Eloi' });
    expectError(() => api.authenticate(`${player.id}.otracosa`), 'unauthorized');
    expectError(() => api.authenticate('sinpunto'), 'unauthorized');
    expectError(() => api.authenticate(null), 'unauthorized');
  });
});

describe('resultados', () => {
  let eloi;
  let marc;
  beforeEach(() => {
    const created = api.createGroup({ name: 'Eloi' });
    eloi = store.playerById.get(created.player.id);
    const joined = api.joinGroup({ code: created.group.code, name: 'Marc' });
    marc = store.playerById.get(joined.player.id);
  });

  it('guarda la marca y la deja en el snapshot', () => {
    const response = play(eloi, { score: 6200 });
    expect(response.bestScore).toBe(6200);
    expect(response.improved).toBe(true);
    expect(response.snapshot.scores).toHaveLength(1);
  });

  it('el mejor resultado nunca baja', () => {
    play(eloi, { score: 6200 });
    const worse = play(eloi, { score: 100 });
    expect(worse.bestScore).toBe(6200);
    expect(worse.improved).toBe(false);
  });

  it('el mejor resultado sube si mejoras', () => {
    play(eloi, { score: 5800 });
    expect(play(eloi, { score: 6500 }).bestScore).toBe(6500);
  });

  it('el mismo attemptId dos veces se procesa una sola vez', () => {
    const first = play(eloi, { score: 4000, attemptId: 'repetido-0001' });
    const second = play(eloi, { score: 9999, attemptId: 'repetido-0001' });
    expect(second.duplicate).toBe(true);
    expect(second.bestScore).toBe(first.bestScore);
    expect(store.scoreRow.get(api.serverDay(), eloi.id, 'c1').plays).toBe(1);
  });

  it('cuenta los intentos y corta al tercero', () => {
    expect(play(eloi, { score: 100 }).attemptsLeft).toBe(2);
    expect(play(eloi, { score: 200 }).attemptsLeft).toBe(1);
    expect(play(eloi, { score: 300 }).attemptsLeft).toBe(0);
    expectError(() => play(eloi, { score: 400 }), 'attempts_exhausted');
  });

  it('el reto secreto y CHAOS solo tienen un intento', () => {
    play(eloi, { challengeId: 'secret', score: 500 });
    expectError(() => play(eloi, { challengeId: 'secret', score: 900 }), 'attempts_exhausted');
    play(eloi, { challengeId: 'chaos', score: 500 });
    expectError(() => play(eloi, { challengeId: 'chaos', score: 900 }), 'attempts_exhausted');
  });

  it('no se ganan intentos jugando sin conexion', () => {
    // El cliente dice que lleva 3 intentos gastados en su primer envio.
    const response = api.submitScore(eloi, {
      attemptId: 'offline-0001',
      gameId: 'pulse',
      challengeId: 'c1',
      day: api.serverDay(),
      score: 3000,
      durationMs: 30_000,
      attemptsUsed: 3,
    });
    expect(response.attemptsUsed).toBe(3);
    // Y aun asi puede subir las otras dos partidas que jugo sin red.
    expect(play(eloi, { score: 3200 }).bestScore).toBe(3200);
    expect(play(eloi, { score: 3400 }).bestScore).toBe(3400);
    expectError(() => play(eloi, { score: 1 }), 'attempts_exhausted');
  });

  it('rechaza puntuaciones imposibles', () => {
    expectError(() => play(eloi, { score: 99_999_999 }), 'invalid_field');
    expectError(() => play(eloi, { score: -5 }), 'invalid_field');
  });

  it('rechaza juegos y retos desconocidos', () => {
    expectError(() => play(eloi, { gameId: 'trampa' }), 'unknown_game');
    expectError(() => play(eloi, { challengeId: 'c9' }), 'unknown_challenge');
  });

  it('rechaza payloads invalidos', () => {
    expectError(() => api.submitScore(eloi, null), 'invalid_body');
    expectError(() => api.submitScore(eloi, { attemptId: 'x' }), 'invalid_field');
    expectError(() => api.submitScore(eloi, {
        attemptId: 'valido-0001',
        gameId: 'pulse',
        challengeId: 'c1',
        day: '2020-01-01',
        score: 10,
        durationMs: 30_000,
      }), 'stale_day');
    expectError(() => api.submitScore(eloi, {
        attemptId: 'valido-0002',
        gameId: 'pulse',
        challengeId: 'c1',
        day: api.serverDay(),
        score: 10,
        durationMs: 50,
      }), 'invalid_field');
  });

  it('cada jugador ve las marcas de todo el grupo', () => {
    play(eloi, { score: 6200 });
    play(marc, { score: 6350 });
    const snapshot = api.snapshotFor(eloi);
    const totals = Object.fromEntries(snapshot.scores.map((s) => [s.playerId, s.bestScore]));
    expect(totals[eloi.id]).toBe(6200);
    expect(totals[marc.id]).toBe(6350);
  });

  it('avisa por SSE a cada cambio', () => {
    published = [];
    play(eloi, { score: 1000 });
    expect(published).toHaveLength(1);
    expect(published[0].snapshot.scores[0].bestScore).toBe(1000);
  });
});

describe('reto secreto', () => {
  let eloi;
  let marc;
  beforeEach(() => {
    const created = api.createGroup({ name: 'Eloi' });
    eloi = store.playerById.get(created.player.id);
    const joined = api.joinGroup({ code: created.group.code, name: 'Marc' });
    marc = store.playerById.get(joined.player.id);
  });

  const completeDay = (player) => {
    play(player, { challengeId: 'c1', score: 1000 });
    play(player, { challengeId: 'c2', score: 1000 });
    play(player, { challengeId: 'c3', score: 1000 });
  };

  it('no se abre si solo termina uno', () => {
    completeDay(eloi);
    const snapshot = api.snapshotFor(eloi);
    expect(snapshot.secret.unlocked).toBe(false);
    expect(snapshot.secret.readyCount).toBe(1);
    expect(snapshot.secret.missing).toContain('Marc');
  });

  it('se abre cuando lo terminan todos los que han abierto hoy', () => {
    completeDay(eloi);
    completeDay(marc);
    const snapshot = api.snapshotFor(eloi);
    expect(snapshot.secret.unlocked).toBe(true);
    expect(snapshot.secret.activeCount).toBe(2);
  });

  it('quien no ha abierto hoy no bloquea al grupo', () => {
    const created = api.createGroup({ name: 'A' });
    const a = store.playerById.get(created.player.id);
    const b = store.playerById.get(api.joinGroup({ code: created.group.code, name: 'B' }).player.id);
    const dormido = store.playerById.get(
      api.joinGroup({ code: created.group.code, name: 'Dormido' }).player.id,
    );
    // Pasa un dia: el dormido no vuelve a aparecer.
    clock += 26 * 3600 * 1000;
    api.touch(a);
    api.touch(b);
    completeDay(a);
    completeDay(b);
    const snapshot = api.snapshotFor(a);
    expect(snapshot.secret.activeCount).toBe(2);
    expect(snapshot.secret.unlocked).toBe(true);
    expect(snapshot.members.find((m) => m.id === dormido.id).activeToday).toBe(false);
  });
});

describe('ghost', () => {
  let eloi;
  let marc;
  let ajeno;
  beforeEach(() => {
    const created = api.createGroup({ name: 'Eloi' });
    eloi = store.playerById.get(created.player.id);
    marc = store.playerById.get(
      api.joinGroup({ code: created.group.code, name: 'Marc' }).player.id,
    );
    ajeno = store.playerById.get(api.createGroup({ name: 'Otro' }).player.id);
  });

  const trace = (n) => Buffer.from(new Uint8Array(n).fill(128)).toString('base64');

  it('guarda la traza junto al mejor resultado', () => {
    const response = play(marc, {
      gameId: 'drift',
      score: 5000,
      ghost: { trace: trace(200), durationMs: 20_000 },
    });
    expect(response.ghostStored).toBe(true);
    const fetched = api.getGhost(eloi, { playerId: marc.id, gameId: 'drift' });
    expect(fetched.ghost.score).toBe(5000);
    expect(fetched.ghost.playerName).toBe('Marc');
  });

  it('solo reemplaza la traza si la marca mejora', () => {
    play(marc, { gameId: 'drift', score: 5000, ghost: { trace: trace(200), durationMs: 20_000 } });
    play(marc, { gameId: 'drift', score: 100, ghost: { trace: trace(40), durationMs: 4_000 } });
    const fetched = api.getGhost(eloi, { playerId: marc.id, gameId: 'drift' });
    expect(fetched.ghost.score).toBe(5000);
    expect(fetched.ghost.durationMs).toBe(20_000);
  });

  it('devuelve null si el rival no tiene traza', () => {
    expect(api.getGhost(eloi, { playerId: marc.id, gameId: 'drift' }).ghost).toBeNull();
  });

  it('no deja mirar el ghost de otro grupo', () => {
    expectError(() => api.getGhost(eloi, { playerId: ajeno.id, gameId: 'drift' }), 'forbidden');
  });

  it('rechaza trazas gigantes', () => {
    expectError(() => play(marc, { gameId: 'drift', score: 900, ghost: { trace: trace(8000), durationMs: 10_000 } }), 'invalid_field');
  });
});

describe('telemetria', () => {
  it('almacena eventos del grupo y calcula el revenge rate', () => {
    const created = api.createGroup({ name: 'Eloi' });
    const eloi = store.playerById.get(created.player.id);
    api.recordEvents(eloi, {
      events: [
        { type: 'revenge_available', day: api.serverDay(), gameId: 'pulse', value: 150 },
        { type: 'revenge_available', day: api.serverDay(), gameId: 'pulse', value: 90 },
        { type: 'revenge_clicked', day: api.serverDay(), gameId: 'pulse', value: 150 },
        { type: 'basura'.repeat(20), day: api.serverDay() },
      ],
    });
    const stats = api.groupStats(eloi);
    expect(stats.counts.revenge_available).toBe(2);
    expect(stats.counts.revenge_clicked).toBe(1);
    expect(stats.revengeRate).toBeCloseTo(0.5);
    expect(stats.recent.length).toBeGreaterThan(0);
  });
});
