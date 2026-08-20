import { beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../src/core/clock';
import { buildDailyPlan } from '../src/meta/daily';
import { commitResult } from '../src/meta/scoring';
import { computeStreak, resolveDay, resolvePendingDays, winnerOfDay } from '../src/meta/streaks';
import { DAY, ensureGames, freshSave, makeResult } from './helpers';

beforeAll(ensureGames);

describe('ganador del dia, corona y racha', () => {
  it('en un dia que no jugue gana el mejor rival (y no aparezco yo)', () => {
    const save = freshSave();
    const winner = winnerOfDay(save, addDays(DAY, -1));
    expect(winner.iPlayed).toBe(false);
    expect(winner.id).not.toBe('me');
    expect(winner.total).toBeGreaterThan(0);
  });

  it('el ganador de un dia es determinista', () => {
    const save = freshSave();
    const key = addDays(DAY, -3);
    expect(winnerOfDay(save, key).id).toBe(winnerOfDay(save, key).id);
  });

  it('si machaco, el ganador del dia soy yo', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    commitResult({
      plan,
      spec: plan.challenges[0]!,
      save,
      secretUnlocked: false,
      result: makeResult(plan.challenges[0]!.gameId, 999_999),
    });
    const winner = winnerOfDay(save, DAY, plan);
    expect(winner.id).toBe('me');
    expect(winner.iPlayed).toBe(true);
  });

  it('resolveDay guarda el ganador y es idempotente', () => {
    const save = freshSave();
    const key = addDays(DAY, -1);
    const first = resolveDay(save, key);
    expect(save.get().days[key]?.resolvedWinner).toBe(first.id);
    expect(resolveDay(save, key).id).toBe(first.id);
  });

  it('la racha cuenta dias seguidos del mismo ganador', () => {
    const save = freshSave();
    const streak = computeStreak(save, DAY);
    expect(streak.holderId).not.toBeNull();
    expect(streak.days).toBeGreaterThanOrEqual(1);
    // El titular es quien gano ayer.
    expect(streak.holderId).toBe(winnerOfDay(save, addDays(DAY, -1)).id);
  });

  it('la racha se corta cuando cambia el ganador', () => {
    const save = freshSave();
    const streak = computeStreak(save, DAY, 30);
    // Comprobamos a mano que el dia anterior al inicio de la racha lo gano otro.
    const beforeStreak = addDays(DAY, -(streak.days + 1));
    expect(winnerOfDay(save, beforeStreak).id).not.toBe(streak.holderId);
  });

  it('cerrar dias pendientes actualiza la racha guardada', () => {
    const save = freshSave();
    const ayer = addDays(DAY, -1);
    const plan = buildDailyPlan(ayer);
    commitResult({
      plan,
      spec: plan.challenges[0]!,
      save,
      secretUnlocked: false,
      result: makeResult(plan.challenges[0]!.gameId, 999_999),
    });
    const resolved = resolvePendingDays(save, DAY);
    expect(resolved.map((r) => r.dayKey)).toContain(ayer);
    expect(save.get().days[ayer]?.resolvedWinner).toBe('me');
    expect(save.get().streak.holder).toBe('me');
    expect(save.get().streak.days).toBe(1);
  });

  it('no cierra el dia de hoy (aun se esta jugando)', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    commitResult({
      plan,
      spec: plan.challenges[0]!,
      save,
      secretUnlocked: false,
      result: makeResult(plan.challenges[0]!.gameId, 1000),
    });
    resolvePendingDays(save, DAY);
    expect(save.get().days[DAY]?.resolvedWinner).toBeNull();
  });
});
