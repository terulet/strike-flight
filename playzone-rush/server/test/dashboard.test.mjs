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

/**
 * "Por juego": de los 12, cuales enganchan de verdad.
 *
 * Aqui no se prueba "es un buen juego" -eso no lo puede decir un test-, se
 * prueba que la maquina que va a decirlo hace exactamente lo que dice: corta
 * bien por juego, no inventa una conclusion con cuatro partidas, y el orden
 * que produce responde a los numeros y no al azar.
 */
describe('por juego', () => {
  /** N finishes de un gameId para un jugador, con revancha y compartir opcionales. */
  function jugarVarias(player, gameId, n, { revancha = 0, comparte = 0, mejora = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      track(player, 'game_start', { gameId });
      track(player, 'game_finish', { gameId, value: 1000 + i });
      if (i < mejora) track(player, 'score_improved', { gameId, value: 50 });
    }
    for (let i = 0; i < revancha; i++) {
      track(player, 'revenge_available', { gameId, value: 200 });
      track(player, 'revenge_clicked', { gameId, value: 200 });
    }
    for (let i = 0; i < comparte; i++) track(player, 'share_completed', { gameId, meta: { resultado: 'imagen' } });
  }

  /** n filas de scores agotadas (3/3) para gameId, una por jugador nuevo. */
  function agotarIntentos(created, gameId, n, challengeId = 'c1') {
    for (let i = 0; i < n; i++) {
      const jugador = join(created.group.code, `J${gameId}${i}`);
      play(jugador, { challengeId, gameId, attemptsUsed: 3 });
    }
  }

  it('no mezcla las senales de dos juegos distintos', () => {
    const { player } = newGroup('Eloi');
    jugarVarias(player, 'pulse', 3, { revancha: 2 });
    jugarVarias(player, 'drift', 3, { revancha: 0 });
    track(player, 'revenge_available', { gameId: 'drift', value: 90 }); // ofrecida, NO pulsada

    const games = metrics().perGame.games;
    const pulse = games.find((g) => g.gameId === 'pulse');
    const drift = games.find((g) => g.gameId === 'drift');
    expect(pulse.revengeAvailable).toBe(2);
    expect(pulse.revengeClicked).toBe(2);
    expect(drift.revengeAvailable).toBe(1);
    expect(drift.revengeClicked).toBe(0);
    expect(pulse.finishes).toBe(3);
    expect(drift.finishes).toBe(3);
  });

  it('con menos partidas que la muestra minima, no hay indice: solo numeros crudos', () => {
    const { player } = newGroup('Eloi');
    jugarVarias(player, 'torre', 3, { revancha: 3 }); // 3 < MIN_FINISHES, aunque el 100% de revancha "se vea" perfecto

    const torre = metrics().perGame.games.find((g) => g.gameId === 'torre');
    expect(torre.insufficient).toBe(true);
    expect(torre.composite).toBeNull();
    expect(torre.finishes).toBe(3);
    expect(torre.revengeRate).toBe(1); // el numero crudo SI se ensena
  });

  it('con un solo juego por encima de la muestra minima, no hay con que comparar', () => {
    const { player } = newGroup('Eloi');
    jugarVarias(player, 'caza', 10, { revancha: 8, comparte: 4, mejora: 5 });

    const games = metrics().perGame.games;
    expect(games.every((g) => g.composite === null)).toBe(true);
  });

  it('ordena por el indice: un juego que engancha de verdad queda por delante de uno mediocre', () => {
    const { created, player } = newGroup('Eloi');
    const rival = join(created.group.code, 'Marc');

    // CARGA: casi todo el mundo quiere revancha, comparte y mejora su marca.
    jugarVarias(player, 'carga', 10, { revancha: 9, comparte: 6, mejora: 8 });
    agotarIntentos(created, 'carga', 10);

    // FRENO: se termina, pero ahi se queda. Ni revancha ni compartir ni mejora.
    jugarVarias(rival, 'freno', 10, { revancha: 1, comparte: 0, mejora: 0 });
    agotarIntentos(created, 'freno', 10);

    const games = metrics().perGame.games;
    const carga = games.find((g) => g.gameId === 'carga');
    const freno = games.find((g) => g.gameId === 'freno');
    expect(carga.insufficient).toBe(false);
    expect(freno.insufficient).toBe(false);
    expect(carga.composite).toBeGreaterThan(freno.composite);
    // Y la lista que se manda al panel ya viene ordenada: no hay que ordenarla en el cliente.
    expect(games.findIndex((g) => g.gameId === 'carga')).toBeLessThan(
      games.findIndex((g) => g.gameId === 'freno'),
    );
  });

  it('agotar intentos solo cuenta en los retos diarios, no en secreto ni CHAOS', () => {
    const { created, player } = newGroup('Eloi');
    void player;
    // Secreto: limite real de 1 intento. Si contara igual que un diario,
    // saldria "agotado" el 100% de las veces sin decir nada de verdad.
    for (let i = 0; i < 10; i++) {
      const jugador = join(created.group.code, `S${i}`);
      play(jugador, { challengeId: 'secret', gameId: 'snap', attemptsUsed: 1 });
    }
    jugarVarias(player, 'snap', 8, {});

    const snap = metrics().perGame.games.find((g) => g.gameId === 'snap');
    expect(snap.dailyRows).toBe(0);
    expect(snap.exhaustedRate).toBeNull();
  });

  it('una metrica sin base para un juego no lo hunde: se reparte el peso entre las demas', () => {
    const { created, player } = newGroup('Eloi');
    const rival = join(created.group.code, 'Marc');

    // Mismos numeros en todo salvo la revancha: a 'memory' nunca se le ha
    // OFRECIDO una (nadie fue nunca por delante ahi), a 'ritmo' si y siempre
    // se pulsa. Que a 'memory' le falte esa senal no debe dejarlo en el suelo.
    jugarVarias(player, 'memory', 8, { revancha: 0, comparte: 3, mejora: 4 });
    agotarIntentos(created, 'memory', 8);

    jugarVarias(rival, 'ritmo', 8, { revancha: 8, comparte: 3, mejora: 4 });
    agotarIntentos(created, 'ritmo', 8);

    const games = metrics().perGame.games;
    const memory = games.find((g) => g.gameId === 'memory');
    const ritmo = games.find((g) => g.gameId === 'ritmo');
    expect(memory.revengeRate).toBeNull();
    expect(memory.composite).not.toBeNull();
    // Con todo lo demas igual, a memory solo le falta el 30% de peso de la
    // revancha (que ritmo se lleva entero): se queda cerca, no por los suelos.
    expect(memory.composite).toBeGreaterThan(ritmo.composite - 40);
  });
});
