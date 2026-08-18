import { beforeAll, describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../src/meta/daily';
import { RIVALS } from '../src/meta/rivals';
import {
  evaluateSecretUnlock,
  forceSecretUnlock,
  haveIPlayedAll,
  isChaosEnabled,
  markAllRivalsPlayed,
  markRivalPlayed,
  secretStatus,
  setChaosEnabled,
} from '../src/meta/secret';
import { commitResult } from '../src/meta/scoring';
import { DAY, ensureGames, freshSave, makeResult } from './helpers';

beforeAll(ensureGames);

function playAll(save: ReturnType<typeof freshSave>, plan = buildDailyPlan(DAY)): void {
  for (const spec of plan.challenges) {
    commitResult({ plan, spec, save, secretUnlocked: false, result: makeResult(spec.gameId, 1000) });
  }
}

describe('reto secreto', () => {
  it('empieza bloqueado y con todo el grupo pendiente', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    const status = secretStatus(save, plan);
    expect(status.unlocked).toBe(false);
    expect(status.done).toBe(0);
    expect(status.total).toBe(RIVALS.length + 1);
    expect(status.missing).toContain('MARC');
  });

  it('no se abre solo porque jueguen los rivales', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    markAllRivalsPlayed(save, DAY);
    expect(evaluateSecretUnlock(save, plan)).toBe(false);
    expect(secretStatus(save, plan).done).toBe(RIVALS.length);
  });

  it('no se abre solo porque juegue yo', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    playAll(save, plan);
    expect(haveIPlayedAll(save, plan)).toBe(true);
    expect(evaluateSecretUnlock(save, plan)).toBe(false);
  });

  it('se abre cuando han jugado los cinco, y solo se celebra una vez', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    playAll(save, plan);
    markAllRivalsPlayed(save, DAY);
    expect(evaluateSecretUnlock(save, plan)).toBe(true);
    expect(secretStatus(save, plan).unlocked).toBe(true);
    expect(evaluateSecretUnlock(save, plan)).toBe(false);
  });

  it('el desbloqueo es por dia', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    playAll(save, plan);
    markAllRivalsPlayed(save, DAY);
    evaluateSecretUnlock(save, plan);
    const manana = buildDailyPlan('2026-08-19');
    expect(secretStatus(save, manana).unlocked).toBe(false);
  });

  it('marcar rivales uno a uno cuenta el progreso', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    markRivalPlayed(save, DAY, 'marc');
    markRivalPlayed(save, DAY, 'kali');
    expect(secretStatus(save, plan).done).toBe(2);
    markRivalPlayed(save, DAY, 'marc', false);
    expect(secretStatus(save, plan).done).toBe(1);
  });

  it('debug puede forzar el desbloqueo', () => {
    const save = freshSave();
    const plan = buildDailyPlan(DAY);
    forceSecretUnlock(save, DAY, true);
    expect(secretStatus(save, plan).unlocked).toBe(true);
  });

  it('el evento CHAOS se activa y desactiva por dia', () => {
    const save = freshSave();
    expect(isChaosEnabled(save, DAY)).toBe(false);
    setChaosEnabled(save, DAY, true);
    expect(isChaosEnabled(save, DAY)).toBe(true);
    expect(isChaosEnabled(save, '2026-08-19')).toBe(false);
  });
});
