import { describe, expect, it } from 'vitest';
import { RaceManager } from '../src/gameplay/RaceManager';
import { InputState } from '../src/input/InputManager';
import { isAirborne } from '../src/physics/Bike';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { SIM_DT } from '../src/config/GameConfig';

const neutral = (): InputState => ({ throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });

function angleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

describe('Ritmo del corte vertical', () => {
  it('la compresion, el tabletop y el step-up se enlazan con gas y correccion aerea sencilla', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());
    const target = track.terrainFeatures.find((feature) => feature.kind === 'stepup')!.endX;
    while (race.state === 'RACING' && race.raceTime < 40 && race.bike.x < target) {
      let lean = 0;
      if (isAirborne(race.bike)) {
        const targetX = Math.min(target, race.bike.x + Math.max(2, race.bike.vx * 0.32));
        const delta = angleDelta(race.bike.angle, Math.atan(track.terrain.surfaceSlope(targetX)));
        if (delta > 0.055) lean = 1;
        else if (delta < -0.055) lean = -1;
      }
      race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false });
    }
    expect(race.state).toBe('RACING');
    expect(race.bike.x).toBeGreaterThanOrEqual(target);
  });

  it('el tabletop se pasa con gas mantenido, sin tocar el aire', () => {
    // Es la promesa de una mesa: quedarse corto cae ENCIMA, no en un hueco.
    // Un jugador que solo sabe acelerar tiene que poder cruzarla.
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    race.begin();
    while (race.state === 'COUNTDOWN') race.step(SIM_DT, neutral());
    const tabletop = track.terrainFeatures.find((feature) => feature.kind === 'tabletop')!;
    while (race.state === 'RACING' && race.raceTime < 30 && race.bike.x < tabletop.endX + 6) {
      race.step(SIM_DT, { throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false });
    }
    expect(race.state).toBe('RACING');
    expect(race.bike.x).toBeGreaterThan(tabletop.endX);
  });
});
