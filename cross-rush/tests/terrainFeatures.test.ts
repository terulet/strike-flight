import { describe, expect, it } from 'vitest';
import { buildCanyonRun, TerrainFeature } from '../src/tracks/CanyonRun';

function sampleExtents(feature: TerrainFeature): { minY: number; maxY: number } {
  const { terrain } = buildCanyonRun();
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const x = feature.startX + ((feature.endX - feature.startX) * i) / 200;
    const y = terrain.surfaceY(x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minY, maxY };
}

describe('Terrain features de Canyon Run', () => {
  it('define cuatro sectores contiguos que cubren de salida a meta', () => {
    const track = buildCanyonRun();
    expect(track.sectors.map((sector) => sector.name)).toEqual(['OPENING', 'AIR LINE', 'TECHNICAL', 'FINAL CLIMB']);
    expect(track.sectors[0].startX).toBe(0);
    expect(track.sectors.at(-1)!.endX).toBe(track.finishX);
    for (let i = 1; i < track.sectors.length; i++) expect(track.sectors[i].startX).toBeCloseTo(track.sectors[i - 1].endX, 8);
  });

  it('las cinco piezas aparecen una sola vez y en orden', () => {
    const track = buildCanyonRun();
    expect(track.terrainFeatures.map((feature) => feature.kind)).toEqual(['tabletop', 'stepup', 'dropoff', 'whoops', 'rockgarden']);
    for (let i = 0; i < track.terrainFeatures.length; i++) {
      const feature = track.terrainFeatures[i];
      expect(feature.endX).toBeGreaterThan(feature.startX);
      if (i > 0) expect(feature.startX).toBeGreaterThan(track.terrainFeatures[i - 1].endX);
    }
  });

  it('tabletop tiene meseta y vuelve a su cota de entrada', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'tabletop')!;
    const startY = track.terrain.surfaceY(feature.startX);
    expect(sampleExtents(feature).maxY).toBeGreaterThan(startY + 2.8);
    expect(Math.abs(track.terrain.surfaceSlope((feature.startX + feature.endX) / 2))).toBeLessThan(0.08);
    expect(track.terrain.surfaceY(feature.endX)).toBeCloseTo(startY, 5);
  });

  it('step-up termina claramente por encima de su entrada', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'stepup')!;
    expect(track.terrain.surfaceY(feature.endX)).toBeGreaterThan(track.terrain.surfaceY(feature.startX) + 4);
    expect(track.terrain.surfaceY(feature.startX + 9)).toBeLessThan(track.terrain.surfaceY(feature.startX + 6) - 1);
  });

  it('drop-off termina en una cota inferior', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'dropoff')!;
    expect(track.terrain.surfaceY(feature.startX) - track.terrain.surfaceY(feature.endX)).toBeGreaterThan(2.8);
  });

  it('whoops conserva siete apoyos y vuelve a su cota', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'whoops')!;
    const { minY, maxY } = sampleExtents(feature);
    expect(feature.endX - feature.startX).toBeCloseTo(7 * 3.2, 5);
    expect(maxY - minY).toBeGreaterThan(0.5);
    expect(track.terrain.surfaceY(feature.endX)).toBeCloseTo(track.terrain.surfaceY(feature.startX), 5);
  });

  it('rockgarden es irregular y vuelve a su cota', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'rockgarden')!;
    const { minY, maxY } = sampleExtents(feature);
    expect(feature.endX - feature.startX).toBeCloseTo(22, 5);
    expect(maxY - minY).toBeGreaterThan(0.9);
    expect(maxY - minY).toBeLessThan(1.3);
    expect(track.terrain.surfaceY(feature.endX)).toBeCloseTo(track.terrain.surfaceY(feature.startX), 5);
  });
});
