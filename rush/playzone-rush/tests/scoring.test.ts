import { beforeAll, describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../src/meta/daily';
import { buildLeaderboard } from '../src/meta/ranking';
import { commitResult, headlineFor } from '../src/meta/scoring';
import { RIVALS } from '../src/meta/rivals';
import { DAY, ensureGames, freshSave, makeResult } from './helpers';

beforeAll(ensureGames);

describe('cierre de partida', () => {
  it('guarda solo la mejor de las tres marcas', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    const base = { plan, spec, save, secretUnlocked: false };

    commitResult({ ...base, result: makeResult(spec.gameId, 3000) });
    commitResult({ ...base, result: makeResult(spec.gameId, 1200) });
    const third = commitResult({ ...base, result: makeResult(spec.gameId, 4500) });

    expect(save.get().days[DAY]?.challenges[spec.id]?.bestScore).toBe(4500);
    expect(save.get().days[DAY]?.challenges[spec.id]?.plays).toBe(3);
    expect(third.isChallengeBest).toBe(true);
  });

  it('una marca peor no baja la mejor ni miente al jugador', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    commitResult({ plan, spec, save, secretUnlocked: false, result: makeResult(spec.gameId, 5000) });
    const worse = commitResult({
      plan,
      spec,
      save,
      secretUnlocked: false,
      result: makeResult(spec.gameId, 900),
    });
    expect(worse.isChallengeBest).toBe(false);
    expect(worse.previousBest).toBe(5000);
    expect(save.get().days[DAY]?.challenges[spec.id]?.bestScore).toBe(5000);
    expect(headlineFor(worse).title).toBe('NO HAS MEJORADO');
  });

  it('detecta el record personal del juego', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    // Primera marca: aun no hay record que batir.
    const first = commitResult({ plan, spec, save, secretUnlocked: false, result: makeResult(spec.gameId, 3000) });
    expect(first.isPersonalRecord).toBe(false);
    expect(save.get().records.bestByGame[spec.gameId]).toBe(3000);

    const better = commitResult({
      plan,
      spec,
      save,
      secretUnlocked: false,
      result: makeResult(spec.gameId, 6000),
    });
    expect(better.isPersonalRecord).toBe(true);
    expect(headlineFor(better).title).toBe('RECORD PERSONAL');
  });

  it('avisa de a quien has adelantado y de que pasas a ser primero', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    const outcome = commitResult({
      plan,
      spec,
      save,
      secretUnlocked: false,
      result: makeResult(spec.gameId, 999_999),
    });
    expect(outcome.rankBefore).toBeGreaterThan(1);
    expect(outcome.rankAfter).toBe(1);
    expect(outcome.becameLeader).toBe(true);
    expect(outcome.overtook.map((s) => s.name).sort()).toEqual(RIVALS.map((r) => r.name).sort());
    expect(headlineFor(outcome).tone).not.toBe('neutral');
  });

  it('cuando no adelantas a nadie dice cuanto te falta', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    const outcome = commitResult({ plan, spec, save, secretUnlocked: false, result: makeResult(spec.gameId, 10) });
    expect(outcome.overtook).toHaveLength(0);
    expect(outcome.challengeTarget).not.toBeNull();
    expect(outcome.challengeTarget!.gap).toBeGreaterThan(0);
    expect(outcome.challengeTarget!.entry.isMe).toBe(false);
  });

  it('consume el intento y lo refleja en el resultado', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    save.update(() => {
      save.challenge(DAY, spec.id).attemptsUsed = 1;
    });
    const outcome = commitResult({ plan, spec, save, secretUnlocked: false, result: makeResult(spec.gameId, 100) });
    expect(outcome.attemptsLeft).toBe(2);
  });

  it('CHAOS puntua aparte: no toca el ranking ni los records normales', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.chaos;
    const outcome = commitResult({ plan, spec, save, secretUnlocked: false, result: makeResult(spec.gameId, 20_000) });
    expect(outcome.chaos).toBe(true);
    expect(save.get().records.bestChaos).toBe(20_000);
    expect(save.get().records.bestByGame[spec.gameId]).toBeUndefined();
    expect(buildLeaderboard(plan, save, false).me.total).toBe(0);
  });

  it('guarda el record de total diario', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    commitResult({
      plan,
      spec: plan.challenges[0]!,
      save,
      secretUnlocked: false,
      result: makeResult(plan.challenges[0]!.gameId, 2500),
    });
    expect(save.get().records.bestDailyTotal).toBe(2500);
  });

  it('propaga si se ha superado el fantasma', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const spec = plan.challenges[0]!;
    const outcome = commitResult({
      plan,
      spec,
      save,
      secretUnlocked: false,
      result: makeResult(spec.gameId, 1000),
      ghostPassed: true,
    });
    expect(outcome.ghostPassed).toBe(true);
  });
});
