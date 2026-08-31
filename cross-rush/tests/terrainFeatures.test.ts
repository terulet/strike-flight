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

describe('Corte vertical: tres obstaculos y nada mas', () => {
  it('solo coloca tabletop, step-up y bajada, en ese orden', () => {
    const track = buildCanyonRun();
    // whoops y rockgarden estan CONGELADOS hasta aprobar la conduccion: el
    // tipo sigue existiendo en el codigo, pero la pista no los coloca.
    expect(track.terrainFeatures.map((feature) => feature.kind)).toEqual(['tabletop', 'stepup', 'dropoff']);
    for (let i = 0; i < track.terrainFeatures.length; i++) {
      const feature = track.terrainFeatures[i];
      expect(feature.endX).toBeGreaterThan(feature.startX);
      if (i > 0) expect(feature.startX).toBeGreaterThanOrEqual(track.terrainFeatures[i - 1].endX);
    }
  });

  it('los sectores tambien estan congelados: uno solo, de salida a meta', () => {
    const track = buildCanyonRun();
    expect(track.sectors).toHaveLength(1);
    expect(track.sectors[0].startX).toBe(0);
    expect(track.sectors[0].endX).toBe(track.finishX);
  });

  it('tabletop tiene meseta y vuelve a su cota de entrada', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'tabletop')!;
    const startY = track.terrain.surfaceY(feature.startX);
    expect(sampleExtents(feature).maxY).toBeGreaterThan(startY + 2.8);
    // Meseta de verdad: en el punto medio el terreno es plano, asi que
    // quedarse corto cae ENCIMA de la mesa y no en un hueco.
    expect(Math.abs(track.terrain.surfaceSlope((feature.startX + feature.endX) / 2))).toBeLessThan(0.08);
    expect(track.terrain.surfaceY(feature.endX)).toBeCloseTo(startY, 5);
  });

  it('step-up termina claramente por encima de su entrada, con hueco en medio', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'stepup')!;
    expect(track.terrain.surfaceY(feature.endX)).toBeGreaterThan(track.terrain.surfaceY(feature.startX) + 3.5);
    // El valle entre despegue y aterrizaje existe: si no, seria una rampa.
    expect(track.terrain.surfaceY(feature.startX + 15)).toBeLessThan(track.terrain.surfaceY(feature.startX + 11));
  });

  it('la bajada termina en una cota bastante inferior', () => {
    const track = buildCanyonRun();
    const feature = track.terrainFeatures.find((item) => item.kind === 'dropoff')!;
    expect(track.terrain.surfaceY(feature.startX) - track.terrain.surfaceY(feature.endX)).toBeGreaterThan(6);
  });

  it('la compresion inicial es una vaguada suave, no un bache', () => {
    const track = buildCanyonRun();
    const compression = track.labels.find((label) => label.name === 'COMPRESSION')!;
    const entryY = track.terrain.surfaceY(compression.x);
    const bottomY = track.terrain.surfaceY(compression.x + 12);
    expect(entryY - bottomY).toBeGreaterThan(1.2);
    // Suave: en ningun punto de la bajada la pendiente pasa de ~11 grados.
    for (let x = compression.x; x < compression.x + 24; x += 0.5) {
      expect(Math.abs(track.terrain.surfaceSlope(x))).toBeLessThan(0.2);
    }
  });

  it('el terreno es continuo y sin picos imposibles de punta a punta', () => {
    const track = buildCanyonRun();
    for (let x = track.terrain.startX; x < track.terrain.endX; x += 0.5) {
      const slope = track.terrain.surfaceSlope(x);
      expect(Number.isFinite(slope)).toBe(true);
      // Nada mas empinado que 45 grados: por encima de eso ninguna moto sube
      // ni baja de forma legible.
      expect(Math.abs(slope)).toBeLessThan(1.0);
    }
  });
});
