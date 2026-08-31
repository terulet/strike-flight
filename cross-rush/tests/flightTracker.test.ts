import { describe, expect, it } from 'vitest';
import { FlightTracker } from '../src/gameplay/FlightTracker';
import { BikeState, createInitialBikeState } from '../src/physics/Bike';
import { Terrain } from '../src/physics/Terrain';
import { TrickConfig } from '../src/config/GameConfig';

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -50, y: 0 },
    { x: 200, y: 0 },
  ]);
}

function airborneState(angle: number): BikeState {
  const state = createInitialBikeState(0, 5);
  return { ...state, vx: 10, vy: -1, angle };
}

function landedState(angle: number, verticalSpeed: number, angularVelocity: number): BikeState {
  const state = createInitialBikeState(0, 0);
  return {
    ...state,
    vx: 10,
    vy: -verticalSpeed,
    angle,
    angularVelocity,
    front: { ...state.front, compression: 0.1, inContact: true },
    rear: { ...state.rear, compression: 0.1, inContact: true },
  };
}

describe('FlightTracker', () => {
  it('registers a trick only once accumulated air rotation reaches ~360 degrees or more', () => {
    const tracker = new FlightTracker();
    const dt = 1 / 60;
    const stepAngle = 0.66; // 10 pasos -> 6.6 rad, por encima de minRotationForTrick

    let angle = 0;
    // Primer tick establece el "vuelo".
    tracker.update(airborneState(angle), flatTerrain(), 1, dt);
    for (let i = 0; i < 9; i++) {
      angle += stepAngle;
      tracker.update(airborneState(angle), flatTerrain(), 1, dt);
    }
    angle += stepAngle; // total acumulado ~6.6 rad
    const finalAngle = angle % (Math.PI * 2);
    const landing = tracker.update(landedState(finalAngle, 1.5, 0.2), flatTerrain(), 1, dt);

    expect(landing).not.toBeNull();
    expect(landing!.quality).not.toBe('CRASH');
    expect(landing!.trick).not.toBeNull();
    expect(landing!.trick!.type).toBe('FRONTFLIP');
    expect(landing!.trick!.rotations).toBeGreaterThanOrEqual(TrickConfig.minRotationForTrick / (Math.PI * 2));
  });

  it('does not register a trick when accumulated rotation stays below the threshold', () => {
    const tracker = new FlightTracker();
    const dt = 1 / 60;
    const stepAngle = 0.5; // 10 pasos -> 5.0 rad, por debajo de minRotationForTrick (~5.78 rad)

    let angle = 0;
    tracker.update(airborneState(angle), flatTerrain(), 1, dt);
    for (let i = 0; i < 9; i++) {
      angle += stepAngle;
      tracker.update(airborneState(angle), flatTerrain(), 1, dt);
    }
    const landing = tracker.update(landedState(angle % (Math.PI * 2), 1.5, 0.2), flatTerrain(), 1, dt);

    expect(landing).not.toBeNull();
    expect(landing!.trick).toBeNull();
  });

  it('does not validate a trick when the landing itself is a crash', () => {
    const tracker = new FlightTracker();
    const dt = 1 / 60;
    const stepAngle = 0.66;

    let angle = 0;
    tracker.update(airborneState(angle), flatTerrain(), 1, dt);
    for (let i = 0; i < 9; i++) {
      angle += stepAngle;
      tracker.update(airborneState(angle), flatTerrain(), 1, dt);
    }
    angle += stepAngle;
    // Aterrizaje catastrofico: angulo totalmente desalineado con el suelo.
    const landing = tracker.update(landedState(2.5, 25, 10), flatTerrain(), 1, dt);

    expect(landing).not.toBeNull();
    expect(landing!.quality).toBe('CRASH');
    expect(landing!.trick).toBeNull();
  });
});
