import { describe, expect, it } from 'vitest';
import { FlowMeter } from '../src/gameplay/FlowMeter';
import { FlowConfig } from '../src/config/GameConfig';

describe('FlowMeter', () => {
  it('stays clamped within [0, 100] under repeated increments and decrements', () => {
    const flow = new FlowMeter();
    for (let i = 0; i < 500; i++) {
      flow.tick(0.05, { groundedFast: true, airControlActive: true });
      expect(flow.value).toBeGreaterThanOrEqual(FlowConfig.min);
      expect(flow.value).toBeLessThanOrEqual(FlowConfig.max);
    }
    for (let i = 0; i < 50; i++) {
      flow.onLanding('CRASH');
      expect(flow.value).toBeGreaterThanOrEqual(FlowConfig.min);
      expect(flow.value).toBeLessThanOrEqual(FlowConfig.max);
    }
    for (let i = 0; i < 500; i++) {
      flow.tick(0.05, { groundedFast: false, airControlActive: false });
      expect(flow.value).toBeGreaterThanOrEqual(FlowConfig.min);
      expect(flow.value).toBeLessThanOrEqual(FlowConfig.max);
    }
  });

  it('al llenarse queda ARMADO, no arranca el turbo solo', () => {
    const flow = new FlowMeter();
    for (let i = 0; i < 200; i++) {
      flow.tick(0.05, { groundedFast: true, airControlActive: true });
    }
    expect(flow.value).toBe(FlowConfig.max);
    // Lo importante del cambio: lleno NO es turbo. El turbo lo gasta el
    // jugador cuando quiere, que es lo que convierte el medidor en una
    // decision en vez de en algo que te pasa.
    expect(flow.isBoostReady).toBe(true);
    expect(flow.isRedline).toBe(false);
    expect(flow.boostMultiplier).toBe(1);
  });

  it('gastarlo arranca el REDLINE y vacia el medidor; gastarlo en vacio no hace nada', () => {
    const flow = new FlowMeter();
    expect(flow.fireBoost()).toBe(false); // en vacio no consume ni miente

    for (let i = 0; i < 200; i++) flow.tick(0.05, { groundedFast: true, airControlActive: true });
    expect(flow.fireBoost()).toBe(true);
    expect(flow.isRedline).toBe(true);
    expect(flow.value).toBe(FlowConfig.min);
    expect(flow.boostMultiplier).toBeGreaterThan(1);
    expect(flow.scoreMultiplier).toBeGreaterThan(1);

    // Con un turbo EN CURSO no se puede encadenar otro aunque el medidor se
    // vuelva a llenar. Se rellena de golpe con un bonus para que la prueba
    // mida el bloqueo por turbo activo y no por falta de FLOW.
    flow.bonus(FlowConfig.max);
    expect(flow.value).toBe(FlowConfig.max);
    expect(flow.isRedline).toBe(true);
    expect(flow.isBoostReady).toBe(false);
  });

  it('clears redline immediately on a crash', () => {
    const flow = new FlowMeter();
    for (let i = 0; i < 200; i++) flow.tick(0.05, { groundedFast: true, airControlActive: true });
    flow.fireBoost();
    expect(flow.isRedline).toBe(true);
    flow.onLanding('CRASH');
    expect(flow.isRedline).toBe(false);
  });
});
