import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/physics/Terrain';
import { BikeInput, BikeState, createInitialBikeState, stepBike } from '../src/physics/Bike';
import { AirControlConfig, SIM_DT } from '../src/config/GameConfig';

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -50, y: 0 },
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ]);
}

describe('stepBike', () => {
  it('does not tunnel through the ground during standard driving over several seconds', () => {
    const terrain = flatTerrain();
    let state: BikeState = createInitialBikeState(0, 1.5);
    const input: BikeInput = { throttle: true, brake: false, lean: 0 };
    const seconds = 6;
    const steps = Math.round(seconds / SIM_DT);
    let minClearance = Infinity;
    for (let i = 0; i < steps; i++) {
      state = stepBike(state, terrain, input, SIM_DT);
      const groundY = terrain.surfaceY(state.x);
      minClearance = Math.min(minClearance, state.y - groundY);
      expect(Number.isFinite(state.x)).toBe(true);
      expect(Number.isFinite(state.y)).toBe(true);
    }
    // El centro de masas nunca debe caer por debajo del suelo local.
    expect(minClearance).toBeGreaterThan(-0.05);
  });

  it('respects the maxAngularVelocity cap under sustained air-control input', () => {
    const terrain = flatTerrain();
    // Empezamos muy alto para garantizar que la moto esta en el aire todo el tiempo.
    let state: BikeState = createInitialBikeState(0, 50);
    const input: BikeInput = { throttle: false, brake: false, lean: 1 };
    for (let i = 0; i < 500; i++) {
      state = stepBike(state, terrain, input, SIM_DT);
      expect(Math.abs(state.angularVelocity)).toBeLessThanOrEqual(AirControlConfig.maxAngularVelocity + 1e-9);
    }
  });

  it('produces stable, near-deterministic results independent of how frames are chunked', () => {
    const terrain = flatTerrain();
    const input: BikeInput = { throttle: true, brake: false, lean: 0 };
    const totalSteps = 240; // 2 segundos a 120Hz

    let stateA: BikeState = createInitialBikeState(0, 1.5);
    for (let i = 0; i < totalSteps; i++) {
      stateA = stepBike(stateA, terrain, input, SIM_DT);
    }

    // Mismo numero total de pasos fijos, solo que "conceptualmente" repartidos
    // en grupos distintos (simulando distintos patrones de frames variables
    // que igualmente delegan en el mismo paso fijo SIM_DT).
    let stateB: BikeState = createInitialBikeState(0, 1.5);
    const chunkSizes = [1, 2, 3, 5, 7];
    let done = 0;
    let chunkIdx = 0;
    while (done < totalSteps) {
      const chunk = Math.min(chunkSizes[chunkIdx % chunkSizes.length], totalSteps - done);
      for (let i = 0; i < chunk; i++) {
        stateB = stepBike(stateB, terrain, input, SIM_DT);
      }
      done += chunk;
      chunkIdx += 1;
    }

    expect(stateA.x).toBeCloseTo(stateB.x, 9);
    expect(stateA.y).toBeCloseTo(stateB.y, 9);
    expect(stateA.angle).toBeCloseTo(stateB.angle, 9);
    expect(stateA.vx).toBeCloseTo(stateB.vx, 9);
  });

  it('never produces NaN/Infinity across a fuzz sweep of plausible inputs', () => {
    const terrain = flatTerrain();
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let trial = 0; trial < 40; trial++) {
      let state: BikeState = createInitialBikeState(rand() * 20 - 10, rand() * 10 + 1);
      state.vx = rand() * 30 - 15;
      state.vy = rand() * 20 - 10;
      state.angle = rand() * Math.PI - Math.PI / 2;
      state.angularVelocity = rand() * 10 - 5;

      for (let i = 0; i < 120; i++) {
        const input: BikeInput = {
          throttle: rand() > 0.5,
          brake: rand() > 0.7,
          lean: rand() > 0.66 ? 1 : rand() > 0.33 ? -1 : 0,
        };
        state = stepBike(state, terrain, input, SIM_DT);
        expect(Number.isFinite(state.x)).toBe(true);
        expect(Number.isFinite(state.y)).toBe(true);
        expect(Number.isFinite(state.vx)).toBe(true);
        expect(Number.isFinite(state.vy)).toBe(true);
        expect(Number.isFinite(state.angle)).toBe(true);
        expect(Number.isFinite(state.angularVelocity)).toBe(true);
      }
    }
  });
});
