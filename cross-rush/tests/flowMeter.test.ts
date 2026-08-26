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

  it('enters REDLINE once it reaches the max, granting a boost and score multiplier', () => {
    const flow = new FlowMeter();
    for (let i = 0; i < 200; i++) {
      flow.tick(0.05, { groundedFast: true, airControlActive: true });
    }
    expect(flow.value).toBe(FlowConfig.max);
    expect(flow.isRedline).toBe(true);
    expect(flow.boostMultiplier).toBeGreaterThan(1);
    expect(flow.scoreMultiplier).toBeGreaterThan(1);
  });

  it('clears redline immediately on a crash', () => {
    const flow = new FlowMeter();
    for (let i = 0; i < 200; i++) flow.tick(0.05, { groundedFast: true, airControlActive: true });
    expect(flow.isRedline).toBe(true);
    flow.onLanding('CRASH');
    expect(flow.isRedline).toBe(false);
  });
});
