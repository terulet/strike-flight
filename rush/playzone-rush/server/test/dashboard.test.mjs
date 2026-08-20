/**
 * Metricas agregadas de la alfa. Se prueban con datos reales metidos por la
 * API (no filas inventadas a mano en SQL), para que lo que mide el dashboard
 * sea lo mismo que produce el juego.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createApi } from '../src/api.mjs';
import { createDashboard } from '../src/dashboard.mjs';
import { createStore, openDatabase } from '../src/db.mjs';

const DAY_MS = 24 * 3600 * 1000;
const START = Date.parse('2026-08-10T10:00:00+02:00');

let db;
let store;
let api;
let dashboard;
let clock;

function setup() {
  db = openDatabase(':memory:');
  store = createStore(db);
  clock = START;
  attemptSeq = 0;
  api = createApi(store, { now: () => clock, timezone: 'Europe/Madrid', publish: () => {} });
  dashboard = createDashboard(db);
}

beforeEach(setup);

const today = () => api.serverDay();
const metrics = () => dashboard.metrics(store.playersByGroup.all(groupId)[0].group_id, today());

let groupId;

function newGroup(name = 'Eloi') {
  const created = api.createGroup({ name });
  const player = store.playerById.get(created.player.id);
  groupId = player.group_id;
  return { created, player };
}

function join(code, name) {
  const joined = api.joinGroup({ code, name });
  return store.playerById.get(joined.player.id);
}

// Contador propio: si dos envios comparten attemptId el servidor los trata
// como el mismo intento (y hace bien), pero entonces el test no mide nada.
let attemptSeq = 0;

function play(player, { challengeId = 'c1', gameId = 'pulse', score = 1000, attemptsUsed = 1 } = {}) {
  return api.submitScore(player, {
    attemptId: `at-${player.id.slice(0, 6)}-${challengeId}-${++attemptSeq}`,
    gameId,
    challengeId,
    day: today(),
    score,
    durationMs: 30_000,
    attemptsUsed,
  });
}

function track(player, type, extra = {}) {
  api.recordEvents(player, {
    events: [{ type, day: today(), ts: clock, ...extra }],
  });
}

/* -------------------------------------------------------------------- */

describe('retencion', () => {
  it('no mete en el denominador a quien todavia no ha podido volver', () => {
    newGroup('Eloi');
    // Solo ha existido un dia: no se puede juzgar ni D1.
    const result = metrics().retention;
    expect(result.d1.eligible).toBe(0);
    expect(result.d1.rate).toBeNull();
    expect(result.d7.eligible).toBe(0);
  });

  it('cuenta D1 cuando el jugador vuelve justo al dia siguiente', () => {
    const { player } = newGroup('Eloi');
    clock += DAY_MS;
    api.snapshotFor(player); // abrir la app marca presencia

    const result = metrics().retention;
    expect(result.d1.eligible).toBe(1);
    expect(result.d1.returned).toBe(1);
    expect(result.d1.rate).toBe(1);
  });

  it('D1 es el dia siguiente exacto, no "volvio alguna vez"', () => {
    const { player } = newGroup('Eloi');
    clock += 2 * DAY_MS; // se salta el dia 1
    api.snapshotFor(player);

    const result = metrics().retention;
    expect(result.d1.eligible).toBe(1);
    expect(result.d1.returned).toBe(0);
    expect(result.d1.rate).toBe(0);
  });

  it('mide D3 y D7 con sus propias cohortes', () => {
    const { created, player } = newGroup('Eloi');
    const marc = join(created.group.code, 'Marc');

    // Eloi vuelve el dia 3 y el dia 7; Marc no vuelve nunca.
    for (const offset of [3, 7]) {
      clock = START + offset * DAY_MS;
      api.snapshotFor(player);
    }
    clock = START + 7 * DAY_MS;

    const result = metrics().retention;
    expect(result.d3.eligible).toBe(2);
    expect(result.d3.returned).toBe(1);
    expect(result.d3.rate).toBe(0.5);
    expect(result.d7.eligible).toBe(2);
    expect(result.d7.returned).toBe(1);
    expect(marc.id).toBeTruthy();
  });
});

describe('revenge rate', () => {
  it('divide revanchas pulsadas entre ofrecidas', () => {
    const { player } = newGroup('Eloi');
    track(player, 'revenge_available', { value: 120 });
    track(player, 'revenge_available', { value: 800 });
    track(player, 'revenge_clicked', { value: 120 });

    const result = metrics().revenge;
    expect(result.available).toBe(2);
    expect(result.clicked).toBe(1);
    expect(result.rate).toBe(0.5);
  });

  it('devuelve null (no cero) cuando no se ha ofrecido ninguna', () => {
    newGroup('Eloi');
    expect(metrics().revenge.rate).toBeNull();
  });

  it('separa por tramos de cuanto se pierde', () => {
    const { player } = newGroup('Eloi');
    track(player, 'revenge_available', { value: 50 });
    track(player, 'revenge_clicked', { value: 50 });
    track(player, 'revenge_available', { value: 5000 });

    const buckets = metrics().revenge.byLoss;
    expect(buckets.find((b) => b.id === '0-100').rate).toBe(1);
    expect(buckets.find((b) => b.id === '1000+').rate).toBe(0);
  });
});

describe('intentos usados', () => {
  it('reparte entre 1, 2 y 3 intentos y calcula el agotamiento', () => {
    const { created, player } = newGroup('Eloi');
    const marc = join(created.group.code, 'Marc');

    play(player, { challengeId: 'c1', attemptsUsed: 1 });
    play(marc, { challengeId: 'c1', attemptsUsed: 1 });
    play(marc, { challengeId: 'c1', attemptsUsed: 2 });
    play(marc, { challengeId: 'c1', attemptsUsed: 3 });

    const result = metrics().attempts;
    expect(result.retosJugados).toBe(2); // una fila por (jugador, reto)
    expect(result.one).toBe(1); // Eloi se quedo en 1
    expect(result.three).toBe(1); // Marc llego a 3
    expect(result.exhaustedRate).toBe(0.5);
  });
});

describe('reto diario completado', () => {
  it('solo cuenta completado cuando estan los tres retos jugados', () => {
    const { created, player } = newGroup('Eloi');
    const marc = join(created.group.code, 'Marc');

    for (const challengeId of ['c1', 'c2', 'c3']) play(player, { challengeId });
    play(marc, { challengeId: 'c1' });

    const result = metrics().dailyCompletion;
    expect(result.activeDays).toBe(2);
    expect(result.startedDays).toBe(2);
    expect(result.completedDays).toBe(1);
    expect(result.completionRate).toBe(0.5);
  });
});

describe('organic reopen rate', () => {
  it('no cuenta el dia de hoy: la sesion sigue abierta', () => {
    const { player } = newGroup('Eloi');
    play(player);
    track(player, 'game_finish', { gameId: 'pulse', value: 1000 });

    expect(metrics().organicReopen.closedSessions).toBe(0);
    expect(metrics().organicReopen.organicReopenRate).toBeNull();
  });

  it('cuenta como reapertura organica volver despues de que un rival jugara', () => {
    const { created, player } = newGroup('Eloi');
    const marc = join(created.group.code, 'Marc');

    track(player, 'app_open');
    play(player, { score: 1000 });
    track(player, 'game_finish', { gameId: 'pulse', value: 1000 });

    // El rival juega media hora despues: el ranking se mueve.
    clock += 30 * 60_000;
    play(marc, { score: 4000 });

    // Y Eloi vuelve a abrir justo despues.
    clock += 10 * 60_000;
    track(player, 'app_open');

    clock += DAY_MS; // cerramos el dia para que entre en la cuenta
    const result = metrics().organicReopen;
    expect(result.closedSessions).toBe(1);
    expect(result.reopened).toBe(1);
    expect(result.organic).toBe(1);
    expect(result.organicReopenRate).toBe(1);
  });

  it('volver sin que nadie haya jugado cuenta como reapertura pero NO como organica', () => {
    const { player } = newGroup('Eloi');

    track(player, 'app_open');
    play(player, { score: 1000 });
    track(player, 'game_finish', { gameId: 'pulse', value: 1000 });

    clock += 40 * 60_000;
    track(player, 'app_open'); // vuelve solo, sin que el ranking se mueva

    clock += DAY_MS;
    const result = metrics().organicReopen;
    expect(result.reopened).toBe(1);
    expect(result.organic).toBe(0);
    expect(result.reopenRate).toBe(1);
    expect(result.organicReopenRate).toBe(0);
  });

  it('seguir navegando justo despues de jugar no es volver', () => {
    const { player } = newGroup('Eloi');

    track(player, 'app_open');
    play(player, { score: 1000 });
    track(player, 'game_finish', { gameId: 'pulse', value: 1000 });

    clock += 60_000; // un minuto: sigue en la app
    track(player, 'app_open');

    clock += DAY_MS;
    const result = metrics().organicReopen;
    expect(result.closedSessions).toBe(1);
    expect(result.reopened).toBe(0);
    expect(result.organicReopenRate).toBe(0);
  });
});

describe('solo lectura', () => {
  it('el dashboard no expone ninguna forma de escribir', () => {
    newGroup('Eloi');
    // La superficie publica es exactamente una funcion de lectura.
    expect(Object.keys(dashboard)).toEqual(['metrics']);
  });

  it('pedir metricas no cambia ni una fila', () => {
    const { created, player } = newGroup('Eloi');
    const marc = join(created.group.code, 'Marc');
    play(player, { score: 1000 });
    play(marc, { score: 2000 });

    const snapshotBefore = JSON.stringify({
      scores: store.scoresForGroupDay.all(groupId, today()),
      players: store.playersByGroup.all(groupId),
    });

    dashboard.metrics(groupId, today());
    dashboard.metrics(groupId, today());

    const snapshotAfter = JSON.stringify({
      scores: store.scoresForGroupDay.all(groupId, today()),
      players: store.playersByGroup.all(groupId),
    });
    expect(snapshotAfter).toBe(snapshotBefore);
  });

  it('solo devuelve datos del grupo que se pide', () => {
    const primero = newGroup('Eloi');
    const groupA = groupId;
    play(primero.player, { score: 1000 });

    const segundo = newGroup('Ajeno');
    const groupB = groupId;
    play(segundo.player, { score: 9000 });

    expect(groupA).not.toBe(groupB);
    expect(dashboard.metrics(groupA, today()).players).toBe(1);
    expect(dashboard.metrics(groupB, today()).players).toBe(1);
  });
});
