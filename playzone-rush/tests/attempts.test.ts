import { beforeAll, describe, expect, it } from 'vitest';
import {
  attemptDots,
  attemptsLeft,
  attemptsUsed,
  beginAttempt,
  canPlay,
  refundAttempt,
  restoreAttempts,
} from '../src/meta/attempts';
import { buildDailyPlan } from '../src/meta/daily';
import { DAY, ensureGames, freshSave } from './helpers';

beforeAll(ensureGames);

describe('intentos', () => {
  it('empieza con los tres intentos del reto', () => {
    const save = freshSave();
    const spec = buildDailyPlan(DAY).challenges[0]!;
    expect(attemptsLeft(save, DAY, spec)).toBe(3);
    expect(canPlay(save, DAY, spec)).toBe(true);
  });

  it('cada partida consume uno y al agotarse no se puede jugar', () => {
    const save = freshSave();
    const spec = buildDailyPlan(DAY).challenges[0]!;
    expect(beginAttempt(save, DAY, spec)).toBe(true);
    expect(beginAttempt(save, DAY, spec)).toBe(true);
    expect(beginAttempt(save, DAY, spec)).toBe(true);
    expect(attemptsLeft(save, DAY, spec)).toBe(0);
    expect(beginAttempt(save, DAY, spec)).toBe(false);
    expect(canPlay(save, DAY, spec)).toBe(false);
    expect(attemptsUsed(save, DAY, spec.id)).toBe(3);
  });

  it('el abandono inmediato devuelve el intento', () => {
    const save = freshSave();
    const spec = buildDailyPlan(DAY).challenges[0]!;
    beginAttempt(save, DAY, spec);
    refundAttempt(save, DAY, spec);
    expect(attemptsLeft(save, DAY, spec)).toBe(3);
  });

  it('los intentos son por reto, no globales', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    beginAttempt(save, DAY, plan.challenges[0]!);
    expect(attemptsLeft(save, DAY, plan.challenges[0]!)).toBe(2);
    expect(attemptsLeft(save, DAY, plan.challenges[1]!)).toBe(3);
  });

  it('los intentos son por dia', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    beginAttempt(save, DAY, plan.challenges[0]!);
    expect(attemptsLeft(save, '2026-08-19', plan.challenges[0]!)).toBe(3);
  });

  it('el secreto y CHAOS solo tienen un intento', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    expect(attemptsLeft(save, DAY, plan.secret)).toBe(1);
    beginAttempt(save, DAY, plan.secret);
    expect(canPlay(save, DAY, plan.secret)).toBe(false);
    expect(attemptsLeft(save, DAY, plan.chaos)).toBe(1);
  });

  it('debug puede restaurarlos (uno o todos)', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    beginAttempt(save, DAY, plan.challenges[0]!);
    beginAttempt(save, DAY, plan.challenges[1]!);

    restoreAttempts(save, DAY, plan.challenges[0]!.id);
    expect(attemptsLeft(save, DAY, plan.challenges[0]!)).toBe(3);
    expect(attemptsLeft(save, DAY, plan.challenges[1]!)).toBe(2);

    restoreAttempts(save, DAY);
    expect(attemptsLeft(save, DAY, plan.challenges[1]!)).toBe(3);
  });

  it('los puntitos de la UI reflejan lo que queda', () => {
    expect(attemptDots(0, 3)).toBe('● ● ●');
    expect(attemptDots(1, 3)).toBe('● ● ○');
    expect(attemptDots(3, 3)).toBe('○ ○ ○');
  });
});
