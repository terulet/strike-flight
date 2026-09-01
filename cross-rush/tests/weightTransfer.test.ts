import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/physics/Terrain';
import {
  BikeInput,
  BikeState,
  createInitialBikeState,
  normalizedAxleLoad,
  stepBike,
} from '../src/physics/Bike';
import { createRiderPose, riderPoseTargets, stepRiderPose } from '../src/physics/RiderPose';
import { InputSmoother } from '../src/input/InputSmoothing';
import { InputState } from '../src/input/InputManager';
import { RiderConfig, SIM_DT } from '../src/config/GameConfig';

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -60, y: 0 },
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
  ]);
}

function raw(throttle: boolean, brake: boolean, lean = 0): InputState {
  return { throttle, brake, lean, restartPressed: false, boostPressed: false };
}

/** Media de carga de cada eje durante la ultima parte de un recorrido en llano. */
function steadyLoads(lean: number): { front: number; rear: number } {
  const terrain = flatTerrain();
  const smoother = new InputSmoother();
  let state = createInitialBikeState(0, 1.5);
  let front = 0;
  let rear = 0;
  let samples = 0;
  const steps = Math.round(7 / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    const smoothed = smoother.update(raw(true, false, t > 3 ? lean : 0), SIM_DT);
    const input: BikeInput = { throttle: true, brake: false, lean: smoothed.lean, smoothed };
    state = stepBike(state, terrain, input, SIM_DT);
    if (t > 5.5) {
      front += state.front.load;
      rear += state.rear.load;
      samples += 1;
    }
  }
  return { front: front / samples, rear: rear / samples };
}

describe('transferencia de peso por el cuerpo del piloto', () => {
  it('echarse atras descarga el eje delantero y carga el trasero', () => {
    const neutral = steadyLoads(0);
    const back = steadyLoads(1); // +1 = morro arriba = peso atras

    expect(back.front).toBeLessThan(neutral.front);
    expect(back.rear).toBeGreaterThan(neutral.rear);
    // Y no es un efecto simbolico: mueve mas de un 10% de la carga del eje.
    expect((neutral.front - back.front) / neutral.front).toBeGreaterThan(0.1);
  });

  it('adelantarse carga el eje delantero y descarga el trasero', () => {
    const neutral = steadyLoads(0);
    const forward = steadyLoads(-1); // -1 = morro abajo = peso delante

    expect(forward.front).toBeGreaterThan(neutral.front);
    expect(forward.rear).toBeLessThan(neutral.rear);
    expect((forward.front - neutral.front) / neutral.front).toBeGreaterThan(0.1);
  });

  it('el mando de inclinacion hace lo mismo en el suelo que en el aire', () => {
    // El bug que esto vigila: con el signo equivocado, la MISMA tecla levantaba
    // el morro en vuelo y lo hundia en el suelo.
    const terrain = flatTerrain();

    // En el aire: +1 debe aumentar el angulo (morro arriba).
    let air = createInitialBikeState(0, 40);
    for (let i = 0; i < Math.round(0.5 / SIM_DT); i++) {
      air = stepBike(air, terrain, { throttle: false, brake: false, lean: 1 }, SIM_DT);
    }
    expect(air.angularVelocity).toBeGreaterThan(0);

    // En el suelo: +1 debe mover el cuerpo hacia ATRAS (shiftX negativo) y
    // aligerar el eje delantero, que es la version terrestre del mismo gesto.
    const back = steadyLoads(1);
    const neutral = steadyLoads(0);
    expect(back.front).toBeLessThan(neutral.front);
    expect(RiderConfig.leanToShiftX).toBeLessThan(0);
  });

  it('acelerar carga el eje trasero y frenar carga el delantero', () => {
    const terrain = flatTerrain();
    const smoother = new InputSmoother();
    let state = createInitialBikeState(0, 1.5);
    let acceleratingRear = 0;
    let brakingFront = 0;
    let brakingRear = Infinity;

    const brakeStart = 5;
    const steps = Math.round(7 / SIM_DT);
    for (let i = 0; i < steps; i++) {
      const t = i * SIM_DT;
      const braking = t >= brakeStart;
      const smoothed = smoother.update(raw(!braking, braking), SIM_DT);
      state = stepBike(
        state,
        terrain,
        { throttle: !braking, brake: braking, lean: 0, smoothed },
        SIM_DT,
      );
      if (t > 1 && t < 2) acceleratingRear = Math.max(acceleratingRear, normalizedAxleLoad(state, 'rear'));
      if (t > brakeStart && t < brakeStart + 0.6) {
        brakingFront = Math.max(brakingFront, normalizedAxleLoad(state, 'front'));
        brakingRear = Math.min(brakingRear, normalizedAxleLoad(state, 'rear'));
      }
    }

    // Acelerando, la trasera lleva bastante mas que su reparto estatico.
    expect(acceleratingRear).toBeGreaterThan(1.2);
    // Frenando, la delantera se lleva la carga y la trasera se queda sin ella.
    expect(brakingFront).toBeGreaterThan(1.2);
    expect(brakingRear).toBeLessThan(0.8);
  });
});

describe('pose del piloto', () => {
  it('el objetivo de pose responde al mando, al freno y al gas', () => {
    const base = {
      lean: 0,
      throttle: 0,
      brake: 0,
      meanCompression: 0,
      verticalSpeed: 0,
      angularVelocity: 0,
      airborne: false,
    };
    const neutral = riderPoseTargets(base);
    expect(neutral.shiftX).toBeCloseTo(0, 6);
    expect(neutral.torsoAngle).toBeCloseTo(0, 6);

    // Pedir morro arriba manda el cuerpo hacia atras y gira el torso hacia atras.
    const leanBack = riderPoseTargets({ ...base, lean: 1 });
    expect(leanBack.shiftX).toBeLessThan(0);
    expect(leanBack.torsoAngle).toBeGreaterThan(0);

    // Frenar lanza el cuerpo sobre el manillar.
    const braking = riderPoseTargets({ ...base, brake: 1 });
    expect(braking.shiftX).toBeGreaterThan(0);

    // Acelerar lo echa atras.
    const throttling = riderPoseTargets({ ...base, throttle: 1 });
    expect(throttling.shiftX).toBeLessThan(0);
  });

  it('el cuerpo se hunde al comprimirse la suspension y se estira al despegar', () => {
    const base = {
      lean: 0,
      throttle: 0,
      brake: 0,
      meanCompression: 0,
      verticalSpeed: 0,
      angularVelocity: 0,
      airborne: false,
    };
    const compressed = riderPoseTargets({ ...base, meanCompression: 0.3 });
    expect(compressed.shiftY).toBeLessThan(-0.05);

    const takingOff = riderPoseTargets({ ...base, airborne: true, verticalSpeed: 10 });
    expect(takingOff.shiftY).toBeGreaterThan(0);

    const landing = riderPoseTargets({ ...base, verticalSpeed: -12 });
    expect(landing.shiftY).toBeLessThan(0);
  });

  it('la pose llega al objetivo con un muelle estable, sin oscilar sin fin', () => {
    const input = {
      lean: 1,
      throttle: 0,
      brake: 0,
      meanCompression: 0,
      verticalSpeed: 0,
      angularVelocity: 0,
      airborne: false,
    };
    const target = riderPoseTargets(input);
    let pose = createRiderPose();
    for (let i = 0; i < Math.round(2 / SIM_DT); i++) {
      pose = stepRiderPose(pose, input, SIM_DT);
      expect(Number.isFinite(pose.shiftX)).toBe(true);
      expect(Number.isFinite(pose.torsoAngle)).toBe(true);
    }
    expect(pose.shiftX).toBeCloseTo(target.shiftX, 2);
    expect(pose.torsoAngle).toBeCloseTo(target.torsoAngle, 2);
    expect(Math.abs(pose.shiftXVelocity)).toBeLessThan(0.02);
  });

  it('se pasa un poco del objetivo antes de asentarse: tiene peso, no es un lerp', () => {
    // Un lerp nunca sobrepasa el destino. Un muelle amortiguado por debajo del
    // critico si, y es justo lo que hace que un cuerpo parezca un cuerpo.
    const input = {
      lean: 1,
      throttle: 0,
      brake: 0,
      meanCompression: 0,
      verticalSpeed: 0,
      angularVelocity: 0,
      airborne: false,
    };
    const target = riderPoseTargets(input);
    let pose = createRiderPose();
    let peak = 0;
    for (let i = 0; i < Math.round(1 / SIM_DT); i++) {
      pose = stepRiderPose(pose, input, SIM_DT);
      peak = Math.min(peak, pose.shiftX); // el objetivo es negativo
    }
    expect(peak).toBeLessThan(target.shiftX);
    expect(RiderConfig.torsoDampingRatio).toBeLessThan(1);
  });

  it('la pose viaja dentro del estado de la moto y sobrevive a un tick completo', () => {
    const terrain = flatTerrain();
    let state: BikeState = createInitialBikeState(0, 1.5);
    for (let i = 0; i < Math.round(1.5 / SIM_DT); i++) {
      state = stepBike(state, terrain, { throttle: false, brake: true, lean: 0 }, SIM_DT);
    }
    // Frenando, el piloto tiene que estar claramente sobre el manillar.
    expect(state.rider.shiftX).toBeGreaterThan(0.02);
    expect(Math.abs(state.rider.shiftX)).toBeLessThanOrEqual(RiderConfig.maxShiftX * 1.35);
  });
});
