import { beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../src/core/clock';
import { listGames } from '../src/game/registry';
import { MUTATOR_IDS } from '../src/game/mutators';
import { CHALLENGES_PER_DAY, DAYS_PER_WEEK, buildDailyPlan, picksForDay } from '../src/meta/daily';
import { catalogFromRegistry } from '../src/meta/daily';
import { ensureGames } from './helpers';

beforeAll(ensureGames);

/** 7 dias x 3 retos: la semana entera cabe exactamente en el catalogo. */
const OBJETIVO = DAYS_PER_WEEK * CHALLENGES_PER_DAY;

describe('catalogo de minijuegos', () => {
  it('hay 21 juegos: los justos para una semana sin repetir', () => {
    expect(listGames()).toHaveLength(OBJETIVO);
  });

  it('ningun id repetido', () => {
    const ids = listGames().map((g) => g.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos se pueden presentar en la portada', () => {
    for (const juego of listGames()) {
      const meta = juego.meta;
      expect(meta.name, meta.id).toBeTruthy();
      expect(meta.tagline, meta.id).toBeTruthy();
      expect(meta.icon, meta.id).toBeTruthy();
      expect(meta.accent, meta.id).toMatch(/^#|^hsl/);
      expect(meta.instructions.length, meta.id).toBeGreaterThanOrEqual(2);
      expect(meta.defaultDurationMs, meta.id).toBeGreaterThan(0);
      expect(meta.scoreLabel, meta.id).toBeTruthy();
    }
  });

  it('las cuatro habilidades estan cubiertas', () => {
    const skills = new Set(listGames().map((g) => g.meta.skill));
    expect([...skills].sort()).toEqual(['memoria', 'precision', 'reflejos', 'supervivencia']);
  });

  it('ningun juego declara un mutador que no existe', () => {
    for (const juego of listGames()) {
      for (const id of juego.meta.supportedMutators ?? []) {
        expect(MUTATOR_IDS, `${juego.meta.id} declara "${id}"`).toContain(id);
      }
    }
  });
});

describe('una semana de verdad', () => {
  it('siete dias seguidos sacan los 21 juegos, uno por hueco', () => {
    const catalogo = catalogFromRegistry();
    const ids: string[] = [];
    // Lunes: es donde empieza la baraja semanal.
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      ids.push(...picksForDay(addDays('2026-09-14', i), catalogo).map((g) => g.id));
    }
    expect(ids).toHaveLength(OBJETIVO);
    expect(new Set(ids).size).toBe(OBJETIVO);
  });

  it('el plan del dia se construye entero con el catalogo real', () => {
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const plan = buildDailyPlan(addDays('2026-09-14', i));
      expect(plan.challenges).toHaveLength(CHALLENGES_PER_DAY);
      expect(plan.secret).toBeTruthy();
      expect(plan.chaos).toBeTruthy();
      // Los tres retos del dia son juegos distintos.
      expect(new Set(plan.challenges.map((c) => c.gameId)).size).toBe(CHALLENGES_PER_DAY);
    }
  });
});
