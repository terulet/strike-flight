import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/physics/Terrain';
import { BikeInput, BikeState, createInitialBikeState, stepBike } from '../src/physics/Bike';
import { createWheelSpinState, stepWheel } from '../src/physics/Wheel';
import { InputSmoother } from '../src/input/InputSmoothing';
import { BikeConfig, SIM_DT, WheelConfig } from '../src/config/GameConfig';

function flatTerrain(): Terrain {
  return new Terrain([
    { x: -60, y: 0 },
    { x: 0, y: 0 },
    { x: 2000, y: 0 },
  ]);
}

function bools(throttle: boolean, brake: boolean, lean = 0) {
  return { throttle, brake, lean, restartPressed: false };
}

/** Corre la simulacion con la entrada suavizada, igual que hace RaceManager. */
function drive(
  seconds: number,
  input: (t: number, state: BikeState) => { throttle: boolean; brake: boolean; lean: number; restartPressed: boolean },
  options: { terrain?: Terrain; startY?: number; onTick?: (t: number, next: BikeState, prev: BikeState) => void } = {},
): BikeState {
  const terrain = options.terrain ?? flatTerrain();
  const smoother = new InputSmoother();
  let state = createInitialBikeState(0, options.startY ?? 1.5);
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    const smoothed = smoother.update(input(t, state), SIM_DT);
    const bikeInput: BikeInput = {
      throttle: smoothed.throttle > 0.5,
      brake: smoothed.brake > 0.5,
      lean: smoothed.lean,
      smoothed,
    };
    const prev = state;
    state = stepBike(state, terrain, bikeInput, SIM_DT);
    options.onTick?.(t, state, prev);
  }
  return state;
}

/** Suma de incrementos de angulo desenrollados: el angulo guardado esta normalizado a (-PI, PI]. */
function unwrappedDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

describe('giro de rueda', () => {
  it('gira en proporcion a la distancia recorrida en llano, y en el sentido del avance', () => {
    let totalFrontSpin = 0;
    const final = drive(
      6,
      (t) => bools(t < 3, false),
      {
        onTick: (_t, next, prev) => {
          totalFrontSpin += unwrappedDelta(prev.front.wheel.spin, next.front.wheel.spin);
        },
      },
    );

    const distance = final.x;
    expect(distance).toBeGreaterThan(50); // se ha movido de verdad

    // Rodadura pura: giro = distancia / radio. La rueda delantera no recibe par
    // motor, asi que rueda limpia y la desviacion solo puede venir del
    // deslizamiento real, que en llano y sin frenar es minimo.
    const expected = distance / BikeConfig.wheelRadius;
    expect(totalFrontSpin).toBeGreaterThan(0); // avanzar en +x = spin positivo
    expect(Math.abs(totalFrontSpin - expected) / expected).toBeLessThan(0.05);
  });

  it('la rueda sigue girando a velocidad constante, no solo al acelerar', () => {
    // El fallo original: las ruedas se dibujaban con el angulo del CHASIS, asi
    // que conduciendo recto no se movian. Aqui se comprueba el estado, no el
    // dibujo: a velocidad de crucero la rueda tiene que seguir sumando vueltas.
    const spins: number[] = [];
    drive(
      6,
      () => bools(true, false),
      {
        onTick: (t, next) => {
          if (t > 4.5) spins.push(next.rear.wheel.spinRate);
        },
      },
    );
    expect(spins.length).toBeGreaterThan(10);
    for (const rate of spins) expect(rate).toBeGreaterThan(50); // rad/s
  });

  it('la rueda trasera patina al salir de parado y luego agarra', () => {
    let maxSlipEarly = 0;
    let maxSlipLate = 0;
    drive(
      6,
      () => bools(true, false),
      {
        onTick: (t, next) => {
          if (t < 0.6) maxSlipEarly = Math.max(maxSlipEarly, next.rear.wheel.slip);
          if (t > 4) maxSlipLate = Math.max(maxSlipLate, Math.abs(next.rear.wheel.slip));
        },
      },
    );
    // Patinaje claro y visible al arrancar...
    expect(maxSlipEarly).toBeGreaterThan(1.5);
    // ...y practicamente nulo una vez lanzada.
    expect(maxSlipLate).toBeLessThan(maxSlipEarly * 0.5);
  });
});

describe('rueda en el aire', () => {
  it('conserva la inercia con drag y el gas hace girar la trasera', () => {
    const terrain = flatTerrain();
    // Muy por encima del suelo: nada de contacto durante toda la prueba.
    let state = createInitialBikeState(0, 40);
    state = { ...state, rear: { ...state.rear, wheel: { spin: 0, spinRate: 30, slip: 0 } } };

    // Sin gas: la rueda pierde vueltas poco a poco, pero conserva casi todo.
    let coasting = state;
    for (let i = 0; i < Math.round(1 / SIM_DT); i++) {
      coasting = stepBike(coasting, terrain, { throttle: false, brake: false, lean: 0 }, SIM_DT);
    }
    expect(coasting.rear.inContact).toBe(false);
    expect(coasting.rear.wheel.spinRate).toBeLessThan(30);
    expect(coasting.rear.wheel.spinRate).toBeGreaterThan(30 * Math.exp(-WheelConfig.airDrag) - 1);

    // Con gas: la rueda se embala en vuelo.
    let throttling = state;
    for (let i = 0; i < Math.round(1 / SIM_DT); i++) {
      throttling = stepBike(throttling, terrain, { throttle: true, brake: false, lean: 0 }, SIM_DT);
    }
    expect(throttling.rear.wheel.spinRate).toBeGreaterThan(coasting.rear.wheel.spinRate + 20);
  });

  it('dar gas en vuelo levanta el morro (reaccion del giro de rueda sobre el chasis)', () => {
    const terrain = flatTerrain();
    const airborne = createInitialBikeState(0, 40);

    let coasting = airborne;
    let throttling = airborne;
    for (let i = 0; i < Math.round(0.5 / SIM_DT); i++) {
      coasting = stepBike(coasting, terrain, { throttle: false, brake: false, lean: 0 }, SIM_DT);
      throttling = stepBike(throttling, terrain, { throttle: true, brake: false, lean: 0 }, SIM_DT);
    }
    expect(throttling.angularVelocity).toBeGreaterThan(coasting.angularVelocity);
    expect(throttling.angle).toBeGreaterThan(coasting.angle);
  });
});

describe('freno', () => {
  it('reduce la velocidad angular de la rueda sin invertirla', () => {
    let minFrontRate = Infinity;
    let minRearRate = Infinity;
    const brakeStart = 4;
    drive(
      8,
      (t) => bools(t < brakeStart, t >= brakeStart),
      {
        onTick: (t, next) => {
          if (t >= brakeStart) {
            minFrontRate = Math.min(minFrontRate, next.front.wheel.spinRate);
            minRearRate = Math.min(minRearRate, next.rear.wheel.spinRate);
          }
        },
      },
    );
    // Nunca gira del reves: el par de freno se recorta al que deja la rueda
    // exactamente parada dentro del tick (ver Wheel.stepWheel).
    expect(minFrontRate).toBeGreaterThanOrEqual(-1e-6);
    expect(minRearRate).toBeGreaterThanOrEqual(-1e-6);
    // Y la trasera, que se descarga al frenar, llega a bloquearse del todo.
    expect(minRearRate).toBeLessThan(1);
  });

  it('un par de freno enorme no puede hacer girar la rueda hacia atras en un solo tick', () => {
    // Prueba directa de la unidad: sin contacto, para aislar el freno del
    // rozamiento con el suelo.
    const result = stepWheel(
      { spin: 0, spinRate: 5, slip: 0 },
      {
        radius: BikeConfig.wheelRadius,
        normalLoad: 0,
        groundSpeed: 0,
        driveTorque: 0,
        brakeTorque: 1e9,
        inContact: false,
        dt: SIM_DT,
      },
    );
    expect(result.state.spinRate).toBeGreaterThanOrEqual(0);
    expect(result.state.spinRate).toBeLessThan(5);
  });

  it('frenar hunde la horquilla y descarga el eje trasero', () => {
    let cruiseFront = 0;
    let cruiseRear = 0;
    let brakingFront = 0;
    let brakingRearMin = Infinity;
    const brakeStart = 5;
    drive(
      8,
      (t) => bools(t < brakeStart, t >= brakeStart),
      {
        onTick: (t, next) => {
          if (t > brakeStart - 0.5 && t < brakeStart) {
            cruiseFront = next.front.compression;
            cruiseRear = next.rear.compression;
          }
          if (t > brakeStart && t < brakeStart + 0.7) {
            brakingFront = Math.max(brakingFront, next.front.compression);
            brakingRearMin = Math.min(brakingRearMin, next.rear.compression);
          }
        },
      },
    );
    // La delantera se hunde de forma bien visible...
    expect(brakingFront).toBeGreaterThan(cruiseFront + 0.05);
    // ...y la trasera se extiende respecto a como iba en crucero.
    expect(brakingRearMin).toBeLessThan(cruiseRear);
  });
});

describe('el neumatico y no el chasis es quien empuja', () => {
  it('sin carga vertical no hay traccion por mucho par que se aplique', () => {
    const result = stepWheel(createWheelSpinState(), {
      radius: BikeConfig.wheelRadius,
      normalLoad: 0,
      groundSpeed: 0,
      driveTorque: 5000,
      brakeTorque: 0,
      inContact: false,
      dt: SIM_DT,
    });
    expect(result.tractionForce).toBe(0);
    expect(result.state.spinRate).toBeGreaterThan(0); // pero la rueda si gira
  });

  it('la fuerza de traccion nunca supera el agarre disponible (mu * carga)', () => {
    const load = 1800;
    const result = stepWheel({ spin: 0, spinRate: 200, slip: 0 }, {
      radius: BikeConfig.wheelRadius,
      normalLoad: load,
      groundSpeed: 0,
      driveTorque: 0,
      brakeTorque: 0,
      inContact: true,
      dt: SIM_DT,
    });
    expect(Math.abs(result.tractionForce)).toBeLessThanOrEqual(WheelConfig.frictionCoefficient * load + 1e-6);
  });
});
