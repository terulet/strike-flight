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
  setChaosEnabled, resumirQueFaltan} from '../src/meta/secret';
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

/**
 * La lista de quien falta.
 *
 * Con cinco personas caben todos los nombres. Con veinticinco, la lista entera
 * es un muro de texto donde antes habia una frase.
 */
describe('resumen de quien falta', () => {
  it('sin nadie pendiente no dice nada', () => {
    expect(resumirQueFaltan([])).toBe('');
  });

  it('hasta tres se dicen todos', () => {
    expect(resumirQueFaltan(['MARC'])).toBe('MARC');
    expect(resumirQueFaltan(['MARC', 'KALI'])).toBe('MARC y KALI');
    expect(resumirQueFaltan(['MARC', 'KALI', 'YOLI'])).toBe('MARC, KALI y YOLI');
  });

  it('a partir de cuatro se cuenta el resto', () => {
    expect(resumirQueFaltan(['MARC', 'KALI', 'YOLI', 'NIL'])).toBe('MARC, KALI, YOLI y 1 mas');
  });

  it('un grupo lleno no escupe veintitantos nombres', () => {
    const muchos = Array.from({ length: 22 }, (_, i) => `JUGADOR${i}`);
    const texto = resumirQueFaltan(muchos);
    expect(texto).toBe('JUGADOR0, JUGADOR1, JUGADOR2 y 19 mas');
    expect(texto.length).toBeLessThan(60);
  });
})
