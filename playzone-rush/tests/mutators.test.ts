import { describe, expect, it } from 'vitest';
import {
  DAILY_MUTATOR_POOL,
  MUTATORS,
  MUTATOR_IDS,
  describeMutators,
  neutralMutators,
  resolveMutators,
} from '../src/game/mutators';

describe('mutadores', () => {
  it('sin mutadores todo es neutro', () => {
    expect(resolveMutators([])).toEqual(neutralMutators());
  });

  it('ACELERON sube velocidad y ritmo', () => {
    const state = resolveMutators(['rush']);
    expect(state.speed).toBeCloseTo(1.5);
    expect(state.spawnRate).toBeCloseTo(1.35);
  });

  it('PUNTOS X2 multiplica la puntuacion', () => {
    expect(resolveMutators(['double']).scoreMultiplier).toBe(2);
  });

  it('SPRINT recorta la duracion', () => {
    expect(resolveMutators(['sprint']).durationMultiplier).toBeCloseTo(0.7);
  });

  it('UNA VIDA fuerza una sola vida', () => {
    expect(resolveMutators(['onelife']).lives).toBe(1);
  });

  it('se combinan entre si', () => {
    const state = resolveMutators(['rush', 'double', 'blackout']);
    expect(state.speed).toBeCloseTo(1.5);
    expect(state.scoreMultiplier).toBe(2);
    expect(state.darkness).toBeGreaterThan(0.7);
  });

  it('ESPEJO dos veces se anula (los mutadores son datos, no parches)', () => {
    expect(resolveMutators(['mirror', 'mirror']).invertControls).toBe(false);
  });

  it('ninguna combinacion deja el juego injugable', () => {
    const state = resolveMutators([...MUTATOR_IDS, ...MUTATOR_IDS]);
    expect(state.speed).toBeLessThanOrEqual(3);
    expect(state.durationMultiplier).toBeGreaterThanOrEqual(0.4);
    expect(state.sizeMultiplier).toBeGreaterThanOrEqual(0.45);
    expect(state.darkness).toBeLessThanOrEqual(0.85);
    expect(state.scoreMultiplier).toBeLessThanOrEqual(5);
  });

  it('ignora ids desconocidos en vez de reventar', () => {
    expect(resolveMutators(['no-existe'])).toEqual(neutralMutators());
  });

  it('CHAOS activa el modo caos y sube los puntos', () => {
    const state = resolveMutators(['chaos']);
    expect(state.chaos).toBe(true);
    expect(state.scoreMultiplier).toBe(2.5);
  });

  it('el pool diario no incluye CHAOS (se reserva al evento)', () => {
    expect(DAILY_MUTATOR_POOL).not.toContain('chaos');
    expect(DAILY_MUTATOR_POOL.every((id) => MUTATORS[id])).toBe(true);
  });

  it('describeMutators devuelve fichas para la UI', () => {
    const defs = describeMutators(['double', 'no-existe']);
    expect(defs).toHaveLength(1);
    expect(defs[0]?.name).toBe('PUNTOS X2');
  });
});
