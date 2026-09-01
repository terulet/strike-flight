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
    expect(zones.speedPads.length).toBeGreaterThanOrEqual(2);
    expect(zones.riskGap).not.toBeNull();
    expect(zones.flowRing).not.toBeNull();

    for (const x of [...zones.speedPads.map((pad) => pad.x), zones.riskGap!.endX, zones.flowRing!.x]) {
      expect(x).toBeGreaterThan(track.terrain.startX);
      expect(x).toBeLessThan(track.finishX);
    }
  });

  it('van en el tramo de espectaculo y en el orden en que se juegan', () => {
    const track = buildCanyonRun();
    const zones = computeGameplayZones(track);
    const showStart = track.labels.find((label) => label.name === 'TECHNICAL')!.x;
    // pad -> linea de riesgo -> segundo pad -> aro del mega salto.
    expect(zones.speedPads[0].x).toBeGreaterThan(showStart);
    expect(zones.speedPads[0].x).toBeLessThan(zones.riskGap!.startX);
    expect(zones.riskGap!.endX).toBeLessThan(zones.speedPads[1].x);
    expect(zones.speedPads[1].x).toBeLessThan(zones.flowRing!.x);
  });

  it('el aro del mega salto esta a una altura que se puede atravesar volando', () => {
    const track = buildCanyonRun();
    const ring = computeGameplayZones(track).flowRing!;
    const megaJumpX = track.labels.find((label) => label.name === 'MEGA_JUMP')!.x;
    // Sobre el labio de despegue, no enterrado ni en la estratosfera: la moto
    // sale del kicker a unos 9 m/s de componente vertical, asi que en mitad
    // del hueco pasa un par de metros por encima. Un aro a 4 m no se podia
    // atravesar ni haciendolo todo bien, que era el fallo original.
    const lipY = track.terrain.surfaceY(megaJumpX + 11);
    expect(ring.y - lipY).toBeGreaterThan(3.5);
    expect(ring.y - lipY).toBeLessThan(7);
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

    expect(zones.speedPads.map((pad) => pad.x)).toContain(362);
    // El hueco acaba en el labio lejano del valle (+19), no al final de la
    // recepcion (+24): con 24 el premio no se podia conseguir ni yendo a tope.
    expect(zones.riskGap).toEqual({ startX: 240, endX: 259 });
    expect(zones.flowRing?.x).toBe(504); // labio (MEGA_JUMP + 11) + 13
    expect(zones.flowRing?.radius).toBeGreaterThan(0);
    // El aro va por encima del terreno, no enterrado en el.
    expect(zones.flowRing!.y).toBeGreaterThan(0);
  });
});
