import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/physics/Terrain';
import { buildCanyonRun } from '../src/tracks/CanyonRun';

describe('Terrain', () => {
  it('produces finite surfaceY and surfaceNormal across the whole track range, including boundaries', () => {
    const { terrain } = buildCanyonRun();
    const step = 0.37; // paso "raro" para pisar limites de segmento con distintas fases
    for (let x = terrain.startX; x <= terrain.endX; x += step) {
      const y = terrain.surfaceY(x);
      const n = terrain.surfaceNormal(x);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      const len = Math.hypot(n.x, n.y);
      expect(len).toBeGreaterThan(0.99);
      expect(len).toBeLessThan(1.01);
    }
    // Limites exactos.
    expect(Number.isFinite(terrain.surfaceY(terrain.startX))).toBe(true);
    expect(Number.isFinite(terrain.surfaceY(terrain.endX))).toBe(true);
    // Fuera de rango: se clampa, no debe explotar.
    expect(Number.isFinite(terrain.surfaceY(terrain.startX - 500))).toBe(true);
    expect(Number.isFinite(terrain.surfaceY(terrain.endX + 500))).toBe(true);
  });

  it('has no seams: surfaceY is continuous across control-point boundaries', () => {
    const terrain = new Terrain([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: -3 },
      { x: 30, y: 2 },
    ]);
    for (const boundaryX of [10, 20]) {
      const left = terrain.surfaceY(boundaryX - 0.0001);
      const right = terrain.surfaceY(boundaryX + 0.0001);
      expect(Math.abs(left - right)).toBeLessThan(0.01);
    }
  });
});
