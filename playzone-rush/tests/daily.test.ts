import { beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../src/core/clock';
import {
  DAILY_ATTEMPTS,
  allChallenges,
  buildDailyPlan,
  findChallenge,
  formatDuration,
} from '../src/meta/daily';
import { resolveMutators } from '../src/game/mutators';
import { DAY, ensureGames } from './helpers';

beforeAll(ensureGames);

describe('rotacion diaria', () => {
  it('el mismo dia produce exactamente el mismo plan', () => {
    const a = buildDailyPlan(DAY);
    const b = buildDailyPlan(DAY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('dias distintos producen planes distintos', () => {
    const hoy = buildDailyPlan(DAY);
    const manana = buildDailyPlan(addDays(DAY, 1));
    expect(JSON.stringify(hoy)).not.toBe(JSON.stringify(manana));
  });

  it('hay 3 retos diarios, uno secreto y un evento CHAOS', () => {
    const plan = buildDailyPlan(DAY);
    expect(plan.challenges).toHaveLength(3);
    expect(plan.secret.kind).toBe('secret');
    expect(plan.chaos.kind).toBe('chaos');
    expect(allChallenges(plan)).toHaveLength(5);
  });

  it('los tres retos usan juegos distintos cuando hay catalogo suficiente', () => {
    const plan = buildDailyPlan(DAY);
    const ids = new Set(plan.challenges.map((c) => c.gameId));
    expect(ids.size).toBe(3);
  });

  it('la dificultad sube reto a reto y los mutadores tambien', () => {
    const plan = buildDailyPlan(DAY);
    const [c1, c2, c3] = plan.challenges;
    expect(c1!.difficulty).toBeLessThan(c2!.difficulty);
    expect(c2!.difficulty).toBeLessThan(c3!.difficulty);
    expect(c1!.mutatorIds).toHaveLength(0);
    expect(c2!.mutatorIds).toHaveLength(1);
    expect(c3!.mutatorIds).toHaveLength(2);
  });

  it('los mutadores del dia no se repiten entre retos', () => {
    for (let i = 0; i < 40; i++) {
      const plan = buildDailyPlan(addDays(DAY, i));
      const all = plan.challenges.flatMap((c) => c.mutatorIds);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('la duracion refleja el mutador de tiempo', () => {
    for (let i = 0; i < 60; i++) {
      const plan = buildDailyPlan(addDays(DAY, i));
      for (const spec of allChallenges(plan)) {
        const expected = Math.round(spec.baseDurationMs * resolveMutators(spec.mutatorIds).durationMultiplier);
        expect(spec.durationMs).toBe(expected);
      }
    }
  });

  it('intentos: 3 en los diarios, 1 en secreto y CHAOS', () => {
    const plan = buildDailyPlan(DAY);
    for (const spec of plan.challenges) expect(spec.attempts).toBe(DAILY_ATTEMPTS);
    expect(plan.secret.attempts).toBe(1);
    expect(plan.chaos.attempts).toBe(1);
  });

  it('el reto secreto es a oscuras y con puntos dobles', () => {
    const plan = buildDailyPlan(DAY);
    expect(plan.secret.mutatorIds).toContain('blackout');
    expect(plan.secret.mutatorIds).toContain('double');
    expect(plan.secret.scoreMultiplier).toBe(2);
  });

  it('CHAOS no puntua en el ranking diario', () => {
    const plan = buildDailyPlan(DAY);
    expect(plan.chaos.countsForRanking).toBe(false);
    expect(plan.chaos.mutatorIds).toContain('chaos');
    expect(plan.challenges.every((c) => c.countsForRanking)).toBe(true);
  });

  it('cada reto tiene una semilla propia y estable', () => {
    const plan = buildDailyPlan(DAY);
    const seeds = allChallenges(plan).map((c) => c.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(seeds[0]).toBe(buildDailyPlan(DAY).challenges[0]!.seed);
  });

  it('findChallenge encuentra por id', () => {
    const plan = buildDailyPlan(DAY);
    expect(findChallenge(plan, 'c2')?.id).toBe('c2');
    expect(findChallenge(plan, 'secret')?.kind).toBe('secret');
    expect(findChallenge(plan, 'nope')).toBeNull();
  });

  it('formatDuration da mm:ss', () => {
    expect(formatDuration(30_000)).toBe('00:30');
    expect(formatDuration(40_000)).toBe('00:40');
    expect(formatDuration(21_000)).toBe('00:21');
  });

  it('funciona aunque solo haya un juego en el catalogo', () => {
    const plan = buildDailyPlan(DAY, [
      { id: 'solo', name: 'SOLO', skill: 'reflejos', defaultDurationMs: 20_000 },
    ]);
    expect(plan.challenges).toHaveLength(3);
    expect(plan.challenges.every((c) => c.gameId === 'solo')).toBe(true);
  });
});
