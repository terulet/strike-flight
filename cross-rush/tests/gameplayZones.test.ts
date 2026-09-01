import { describe, expect, it } from 'vitest';
import { computeGameplayZones } from '../src/gameplay/GameplayZones';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { Terrain } from '../src/physics/Terrain';
import { SectorLabel } from '../src/tracks/TrackBuilder';

/**
 * Las piezas de riesgo/recompensa -pad de velocidad, aro de flow, hueco de
 * riesgo, kicker y bache- estuvieron congeladas mientras se aprobaba la
 * sensacion basica de conducir. Ya no: el tramo de espectaculo las coloca
 * todas, y estos tests comprueban que caen donde la pista dice que caen.
 *
 * Importa que el mecanismo siga derivandolas de los LABELS y no de numeros
 * escritos a mano: es lo unico que garantiza que la pieza que se ve y la que
 * actua esten en el mismo sitio.
 */
describe('Piezas de riesgo/recompensa', () => {
  it('el corte vertical las coloca todas, dentro de la pista', () => {
    const track = buildCanyonRun();
    const zones = computeGameplayZones(track);
    expect(zones.speedPad).not.toBeNull();
    expect(zones.riskGap).not.toBeNull();
    expect(zones.flowRing).not.toBeNull();
    expect(zones.altRamp).not.toBeNull();
    expect(zones.bumpGate).not.toBeNull();

    for (const x of [zones.speedPad!.x, zones.altRamp!.x, zones.bumpGate!.x, zones.riskGap!.endX, zones.flowRing!.x]) {
      expect(x).toBeGreaterThan(track.terrain.startX);
      expect(x).toBeLessThan(track.finishX);
    }
  });

  it('van en el tramo de espectaculo y en el orden en que se juegan', () => {
    const track = buildCanyonRun();
    const zones = computeGameplayZones(track);
    const showStart = track.labels.find((label) => label.name === 'TECHNICAL')!.x;
    expect(zones.bumpGate!.x).toBeGreaterThanOrEqual(showStart);
    // bache -> pad -> kicker -> linea de riesgo -> aro del mega salto.
    expect(zones.bumpGate!.x).toBeLessThan(zones.speedPad!.x);
    expect(zones.speedPad!.x).toBeLessThan(zones.altRamp!.x);
    expect(zones.altRamp!.x).toBeLessThan(zones.riskGap!.startX);
    expect(zones.riskGap!.endX).toBeLessThan(zones.flowRing!.x);
  });

  it('el aro del mega salto esta a una altura que se puede atravesar volando', () => {
    const track = buildCanyonRun();
    const ring = computeGameplayZones(track).flowRing!;
    const megaJumpX = track.labels.find((label) => label.name === 'MEGA_JUMP')!.x;
    // Sobre el labio de despegue, no enterrado ni en la estratosfera: la moto
    // sale del kicker a unos 9 m/s de componente vertical, asi que en mitad
    // del hueco pasa un par de metros por encima. Un aro a 4 m no se podia
    // atravesar ni haciendolo todo bien, que era el fallo original.
    const lipY = track.terrain.surfaceY(megaJumpX + 9);
    expect(ring.y - lipY).toBeGreaterThan(1.2);
    expect(ring.y - lipY).toBeLessThan(3.2);
    expect(ring.radius).toBeGreaterThan(0);
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
