import { describe, expect, it } from 'vitest';
import { computeSuspension, SuspensionParams } from '../src/physics/Suspension';

const PARAMS: SuspensionParams = {
  restLength: 0.6,
  maxCompression: 0.35,
  springStrength: 9000,
  damping: 600,
  wheelRadius: 0.28,
};

describe('computeSuspension', () => {
  it('never produces NaN or Infinity across a range of compression/velocity inputs', () => {
    const anchorYs = [-5, -1, 0, 0.5, 1, 5, 50];
    const groundYs = [-10, -1, 0, 0.5, 2, 20];
    const prevCompressions = [-1, 0, 0.1, 0.35, 0.9, 1000];
    const dts = [0, 1e-9, 1 / 120, 0.05, 1];

    for (const anchorY of anchorYs) {
      for (const groundY of groundYs) {
        for (const prevCompression of prevCompressions) {
          for (const dt of dts) {
            const result = computeSuspension(PARAMS, anchorY, groundY, prevCompression, dt);
            expect(Number.isFinite(result.compression)).toBe(true);
            expect(Number.isFinite(result.force)).toBe(true);
            expect(result.compression).toBeGreaterThanOrEqual(0);
            expect(result.compression).toBeLessThanOrEqual(PARAMS.maxCompression);
            expect(result.force).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('reports no contact when fully extended, and contact when compressed', () => {
    const farAway = computeSuspension(PARAMS, 10, 0, 0, 1 / 120);
    expect(farAway.inContact).toBe(false);
    expect(farAway.force).toBe(0);

    const touching = computeSuspension(PARAMS, 0.5, 0, 0, 1 / 120);
    expect(touching.inContact).toBe(true);
    expect(touching.force).toBeGreaterThan(0);
  });
});
