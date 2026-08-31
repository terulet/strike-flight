/**
 * Capa de red vista desde el cliente: codec del ghost, cola de envios,
 * conciliacion con el servidor y ranking con personas reales.
 *
 * Aqui no se abre ningun socket: el servidor de verdad ya tiene sus propias
 * pruebas. Lo que se comprueba es que el movil se comporta.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GHOST_SAMPLE_MS, decodeTrace, encodeTrace, sampleAt, traceBytes } from '../src/net/ghost';
import { ApiError, NetworkError } from '../src/net/client';
import { SyncEngine } from '../src/net/sync';
import { colorForPlayer, myBestFor, remoteStandings } from '../src/meta/contenders';
import { buildDailyPlan } from '../src/meta/daily';
import { buildLeaderboard } from '../src/meta/ranking';
import type { GroupSnapshot } from '../src/net/types';
import { DAY, ensureGames, freshSave } from './helpers';

beforeAll(ensureGames);

/* -------------------------------------------------------------------- */
/* Ghost                                                                 */
/* -------------------------------------------------------------------- */

describe('traza del ghost', () => {
  it('ida y vuelta sin perder la forma', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1];
    const decoded = decodeTrace(encodeTrace(samples));
    expect(decoded).toHaveLength(samples.length);
    for (let i = 0; i < samples.length; i++) {
      expect(decoded[i]).toBeCloseTo(samples[i] as number, 2);
    }
  });

  it('una partida de 40 s ocupa unos pocos cientos de bytes', () => {
    const samples = Array.from({ length: 400 }, (_, i) => (Math.sin(i / 8) + 1) / 2);
    const trace = encodeTrace(samples);
    expect(traceBytes(trace)).toBeLessThan(700);
    expect(traceBytes(trace)).toBeGreaterThan(400);
  });

  it('interpola entre muestras', () => {
    const samples = [0, 1];
    expect(sampleAt(samples, 0, 100)).toBeCloseTo(0);
    expect(sampleAt(samples, 50, 100)).toBeCloseTo(0.5);
  });

  it('devuelve null cuando el fantasma ya ha terminado', () => {
    expect(sampleAt([0, 0.5, 1], 400, GHOST_SAMPLE_MS)).toBeNull();
    expect(sampleAt([], 0)).toBeNull();
  });

  it('una traza corrupta no revienta', () => {
    expect(decodeTrace('esto no es base64 !!!')).toEqual([]);
  });
});

/* -------------------------------------------------------------------- */
/* Cola de envios                                                        */
/* -------------------------------------------------------------------- */

function groupSave() {
  const save = freshSave();
  save.update((data) => {
    data.account = {
      mode: 'group',
      playerId: 'p-eloi',
      secret: 'secreto',
      groupCode: 'AB12',
      joinedAt: 1,
    };
  });
  return save;
}

function fakeSnapshot(overrides: Partial<GroupSnapshot> = {}): GroupSnapshot {
  return {
    serverTime: 1,
    day: DAY,
    group: { code: 'AB12', maxPlayers: 8, timezone: 'Europe/Madrid', season: 's1' },
    members: [
      {
        id: 'p-eloi',
        name: 'Eloi',
        joinedAt: 1,
        lastSeenAt: 1,
        online: true,
        activeToday: true,
        completedDaily: false,
      },
      {
        id: 'p-marc',
        name: 'Marc',
        joinedAt: 2,
        lastSeenAt: 2,
        online: false,
        activeToday: true,
        completedDaily: true,
      },
    ],
    scores: [],
    secret: { unlocked: false, activeCount: 2, readyCount: 1, missing: ['Eloi'] },
    ghosts: [],
    ...overrides,
  };
}

/** Espera activa corta: la cola se vacia en microtareas, no en segundos. */
async function waitFor(condition: () => boolean, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('la condicion no se ha cumplido a tiempo');
}

const pending = (attemptId: string, score = 1000) => ({
  attemptId,
  day: DAY,
  challengeId: 'c1',
  gameId: 'pulse',
  gameVersion: 1,
  isTest: false,
  score,
  durationMs: 30_000,
  attemptsUsed: 1,
  countsForRanking: true,
  ghost: null,
  queuedAt: 1,
  tries: 0,
});

describe('cola de envios', () => {
  it('guarda lo jugado aunque no haya red y no duplica intentos', async () => {
    const save = groupSave();
    const client = {
      hasSession: true,
      setCredentials: vi.fn(),
      submitScore: vi.fn().mockRejectedValue(new NetworkError('sin red')),
      streamUrl: () => null,
    } as never;
    const sync = new SyncEngine(save, client);

    sync.queueScore(pending('a-1'));
    sync.queueScore(pending('a-1')); // el mismo intento otra vez
    await sync.flush();

    expect(save.get().outbox).toHaveLength(1);
    expect(sync.pendingCount).toBe(1);
    expect(sync.status).toBe('offline');
  });

  it('vacia la cola cuando el servidor responde', async () => {
    const save = groupSave();
    const snapshot = fakeSnapshot();
    const submitScore = vi.fn().mockResolvedValue({ ok: true, snapshot, bestScore: 1000 });
    const client = {
      hasSession: true,
      setCredentials: vi.fn(),
      submitScore,
      streamUrl: () => null,
    } as never;
    const sync = new SyncEngine(save, client);

    // queueScore ya dispara el envio por su cuenta: esperamos a que termine.
    sync.queueScore(pending('a-1'));
    sync.queueScore(pending('a-2', 2000));
    await waitFor(() => sync.pendingCount === 0);

    expect(submitScore).toHaveBeenCalledTimes(2);
    expect(sync.snapshot?.day).toBe(DAY);
    expect(sync.status).toBe('online');
  });

  it('descarta lo que el servidor rechaza para siempre, y avisa', async () => {
    const save = groupSave();
    const client = {
      hasSession: true,
      setCredentials: vi.fn(),
      submitScore: vi.fn().mockRejectedValue(new ApiError(400, 'stale_day', 'dia cerrado')),
      streamUrl: () => null,
    } as never;
    const sync = new SyncEngine(save, client);
    const dropped: string[] = [];
    sync.on('dropped', ({ reason }) => dropped.push(reason));

    sync.queueScore(pending('a-1'));
    await sync.flush();

    expect(sync.pendingCount).toBe(0);
    expect(dropped).toEqual(['stale_day']);
  });

  it('un 429 no se descarta: se reintenta luego', async () => {
    const save = groupSave();
    const client = {
      hasSession: true,
      setCredentials: vi.fn(),
      submitScore: vi.fn().mockRejectedValue(new ApiError(429, 'rate_limited', 'espera')),
      streamUrl: () => null,
    } as never;
    const sync = new SyncEngine(save, client);
    sync.queueScore(pending('a-1'));
    await sync.flush();
    expect(sync.pendingCount).toBe(1);
  });

  it('en modo solitario no se encola nada', () => {
    const save = freshSave();
    save.update((data) => {
      data.account = { ...data.account, mode: 'solo' };
    });
    const sync = new SyncEngine(save, { hasSession: false, setCredentials: vi.fn() } as never);
    sync.queueScore(pending('a-1'));
    expect(sync.pendingCount).toBe(0);
    expect(sync.status).toBe('solo');
  });
});

/* -------------------------------------------------------------------- */
/* Ranking con personas                                                  */
/* -------------------------------------------------------------------- */

describe('ranking con jugadores reales', () => {
  it('convierte la foto del grupo en contendientes, sin incluirme', () => {
    const plan = buildDailyPlan(DAY);
    const snapshot = fakeSnapshot({
      scores: [
        {
          playerId: 'p-marc',
          challengeId: plan.challenges[0]!.id,
          gameId: plan.challenges[0]!.gameId,
          bestScore: 6350,
          attemptsUsed: 1,
          plays: 1,
          countsForRanking: true,
          updatedAt: 1,
        },
      ],
    });
    const others = remoteStandings(snapshot, 'p-eloi', plan, false);
    expect(others).toHaveLength(1);
    expect(others[0]?.name).toBe('Marc');
    expect(others[0]?.total).toBe(6350);
    expect(others[0]?.played).toBe(true);
  });

  it('el evento CHAOS no suma al total del grupo', () => {
    const plan = buildDailyPlan(DAY);
    const snapshot = fakeSnapshot({
      scores: [
        {
          playerId: 'p-marc',
          challengeId: 'chaos',
          gameId: plan.chaos.gameId,
          bestScore: 20_000,
          attemptsUsed: 1,
          plays: 1,
          countsForRanking: false,
          updatedAt: 1,
        },
      ],
    });
    expect(remoteStandings(snapshot, 'p-eloi', plan, false)[0]?.total).toBe(0);
  });

  it('mi marca es siempre el maximo entre local y servidor', () => {
    const save = groupSave();
    save.update(() => {
      save.challenge(DAY, 'c1').bestScore = 5000;
    });
    const snapshot = fakeSnapshot({
      scores: [
        {
          playerId: 'p-eloi',
          challengeId: 'c1',
          gameId: 'pulse',
          bestScore: 4000,
          attemptsUsed: 2,
          plays: 2,
          countsForRanking: true,
          updatedAt: 1,
        },
      ],
    });
    // El servidor va por detras (envio en cola): manda lo local.
    expect(myBestFor(save, DAY, 'c1', snapshot, 'p-eloi')).toBe(5000);
    // Y al reves: si el servidor sabe mas (otro movil), manda el servidor.
    expect(myBestFor(save, DAY, 'c2', { ...snapshot, scores: [
      { playerId: 'p-eloi', challengeId: 'c2', gameId: 'snap', bestScore: 999, attemptsUsed: 1, plays: 1, countsForRanking: true, updatedAt: 1 },
    ] }, 'p-eloi')).toBe(999);
  });

  it('tras perder DOBLE O NADA no resucita la marca remota anterior', () => {
    const save = groupSave();
    save.update(() => {
      const progress = save.challenge(DAY, 'c1');
      progress.bestScore = 700;
      progress.apuesta = 'cayo';
    });
    const snapshot = fakeSnapshot({ scores: [{
      playerId: 'p-eloi', challengeId: 'c1', gameId: 'pulse', bestScore: 1400,
      attemptsUsed: 3, plays: 3, countsForRanking: true, updatedAt: 1,
    }] });
    expect(myBestFor(save, DAY, 'c1', snapshot, 'p-eloi')).toBe(700);
  });

  it('el ranking mezcla mis marcas con las del grupo', () => {
    const save = groupSave();
    const plan = buildDailyPlan(DAY);
    save.update(() => {
      save.challenge(DAY, plan.challenges[0]!.id).bestScore = 7000;
    });
    const snapshot = fakeSnapshot({
      scores: [
        {
          playerId: 'p-marc',
          challengeId: plan.challenges[0]!.id,
          gameId: plan.challenges[0]!.gameId,
          bestScore: 6350,
          attemptsUsed: 1,
          plays: 1,
          countsForRanking: true,
          updatedAt: 1,
        },
      ],
    });
    const board = buildLeaderboard(plan, save, false, {
      others: remoteStandings(snapshot, 'p-eloi', plan, false),
      myBest: (id) => myBestFor(save, DAY, id, snapshot, 'p-eloi'),
    });
    expect(board.standings.map((s) => s.name)).toEqual(['ELOI', 'Marc']);
    expect(board.myRank).toBe(1);
    expect(board.standings[1]?.total).toBe(6350);
  });

  it('el color de cada jugador es estable', () => {
    expect(colorForPlayer('p-marc')).toBe(colorForPlayer('p-marc'));
    expect(colorForPlayer('p-marc')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
