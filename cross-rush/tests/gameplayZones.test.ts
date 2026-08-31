import { describe, expect, it } from 'vitest';
import { computeGameplayZones } from '../src/gameplay/GameplayZones';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { Terrain } from '../src/physics/Terrain';
import { SectorLabel } from '../src/tracks/TrackBuilder';

/**
 * Las piezas de riesgo/recompensa -pad de velocidad, aro de flow, hueco de
 * riesgo, kicker y bache- estan CONGELADAS en el corte vertical: primero hay
 * que aprobar la sensacion basica de conducir.
 *
 * El mecanismo, sin embargo, sigue vivo y probado: `computeGameplayZones` las
 * resuelve a partir de los labels de la pista, asi que basta con que una pista
 * los declare para que vuelvan. Estos tests cubren las dos mitades: que el
 * corte vertical no las trae, y que el mecanismo las coloca bien cuando si.
 */
describe('Piezas de riesgo/recompensa (congeladas en el corte vertical)', () => {
  it('el corte vertical no coloca ninguna', () => {
    const zones = computeGameplayZones(buildCanyonRun());
    expect(zones.speedPad).toBeNull();
    expect(zones.riskGap).toBeNull();
    expect(zones.flowRing).toBeNull();
    expect(zones.altRamp).toBeNull();
    expect(zones.bumpGate).toBeNull();
  });

  it('el mecanismo sigue resolviendolas cuando la pista declara sus labels', () => {
    const points = Array.from({ length: 60 }, (_, i) => ({ x: i * 10, y: Math.sin(i * 0.3) * 2 }));
    const labels: SectorLabel[] = [
      { x: 120, name: 'TECHNICAL' },
      { x: 240, name: 'RISK_LINE_JUMP' },
      { x: 360, name: 'UPHILL' },
      { x: 480, name: 'MEGA_JUMP' },
    ];
    const zones = computeGameplayZones({
      terrain: new Terrain(points),
      labels,
      terrainFeatures: [],
      sectors: [],
      startX: 0,
      startY: 0,
      finishX: 560,
      length: 590,
    });

    expect(zones.bumpGate?.x).toBe(122);
    expect(zones.speedPad?.x).toBe(362);
    expect(zones.altRamp?.x).toBe(370);
    expect(zones.riskGap).toEqual({ startX: 240, endX: 264 });
    expect(zones.flowRing?.x).toBe(500);
    expect(zones.flowRing?.radius).toBeGreaterThan(0);
    // El aro va por encima del terreno, no enterrado en el.
    expect(zones.flowRing!.y).toBeGreaterThan(0);
  });
});
