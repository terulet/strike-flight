/**
 * Wheel.ts
 *
 * Masa no suspendida: una rueda con su propio angulo, su propia velocidad
 * angular y su propio deslizamiento contra el suelo.
 *
 * Hasta ahora el gas empujaba el chasis directamente y las ruedas eran un
 * dibujo pegado al angulo de la moto. Aqui se invierte: el motor aplica PAR
 * a la rueda trasera, la rueda gira, y es el rozamiento del neumatico contra
 * el suelo -limitado por la carga vertical real de esa rueda- quien decide
 * cuanta de esa energia se convierte en avance y cuanta en patinaje.
 *
 * Consecuencias que se ven sin mirar el codigo:
 * - las ruedas giran, y giran en el sentido del avance;
 * - a fondo desde parado la trasera patina antes de agarrar;
 * - frenar fuerte bloquea la rueda (omega -> 0) y deja marca;
 * - en el aire la rueda sigue girando por inercia, y el gas la acelera.
 *
 * Convenio de signos: `spin` positivo = la rueda rueda HACIA ADELANTE (+x).
 * En rodadura pura, `spinRate = velocidadTangencial / radio`. El render
 * convierte ese signo al del canvas (ver Renderer.drawBike).
 */

import { clamp, normalizeAngle } from './MathUtils';
import { WheelConfig } from '../config/GameConfig';

export interface WheelSpinState {
  /** Angulo propio de la rueda, normalizado a (-PI, PI]. */
  spin: number;
  /** Velocidad angular propia (rad/s). Positiva = avanza. */
  spinRate: number;
  /**
   * Deslizamiento tangencial en m/s: `spinRate * R - velocidadDelSuelo`.
   * Positivo = patina acelerando; negativo = se bloquea frenando.
   */
  slip: number;
}

export interface WheelStepInput {
  /** Radio del neumatico (m). */
  radius: number;
  /** Fuerza normal de esa rueda contra el suelo (N). 0 si esta en el aire. */
  normalLoad: number;
  /** Velocidad del chasis proyectada sobre la tangente del terreno (m/s). */
  groundSpeed: number;
  /** Par motor aplicado a la rueda (N*m). Solo la trasera lo recibe. */
  driveTorque: number;
  /** Par de freno disponible (N*m, siempre >= 0). Se aplica en contra del giro. */
  brakeTorque: number;
  inContact: boolean;
  dt: number;
}

export interface WheelStepResult {
  state: WheelSpinState;
  /**
   * Fuerza tangencial que el neumatico ejerce sobre el CHASIS (N), con signo
   * en la direccion de la tangente. Es la traccion (o la frenada) real.
   */
  tractionForce: number;
}

export function createWheelSpinState(): WheelSpinState {
  return { spin: 0, spinRate: 0, slip: 0 };
}

export function cloneWheelSpinState(state: WheelSpinState): WheelSpinState {
  return { spin: state.spin, spinRate: state.spinRate, slip: state.slip };
}

/**
 * Interpolacion visual entre dos estados de rueda. El angulo va por el camino
 * corto: sin esto, una rueda que cruza +PI aparenta dar una vuelta entera
 * hacia atras en un solo frame.
 */
export function lerpWheelSpinState(a: WheelSpinState, b: WheelSpinState, t: number): WheelSpinState {
  return {
    spin: normalizeAngle(a.spin + normalizeAngle(b.spin - a.spin) * t),
    spinRate: a.spinRate + (b.spinRate - a.spinRate) * t,
    slip: a.slip + (b.slip - a.slip) * t,
  };
}

/**
 * Limite de estabilidad del acoplamiento neumatico-suelo.
 *
 * El termino de rozamiento se comporta como un muelle viscoso sobre el
 * deslizamiento: `dOmega/dt = -(k*R^2/I) * omega`. Integrado con Euler
 * explicito, eso solo es estable si `(k*R^2/I) * dt < 2`. Con los valores por
 * defecto queda holgadamente por debajo, pero el paso de simulacion es un
 * parametro y los tests barren dt distintos, asi que el coeficiente efectivo
 * se recorta aqui en vez de confiar en que nadie toque la config.
 */
function stableSlipStiffness(inertia: number, radius: number, dt: number): number {
  const requested = WheelConfig.slipStiffness;
  if (dt <= 0 || radius <= 0) return requested;
  const maxStiffness = (1.6 * inertia) / (radius * radius * dt);
  return Math.min(requested, maxStiffness);
}

/**
 * Avanza una rueda un paso fijo. Funcion pura: no muta la entrada.
 */
export function stepWheel(state: WheelSpinState, input: WheelStepInput): WheelStepResult {
  const { radius, dt } = input;
  const inertia = WheelConfig.inertia;
  const safeDt = dt > 1e-6 ? dt : 1 / 120;

  let spinRate = Number.isFinite(state.spinRate) ? state.spinRate : 0;
  let tractionForce = 0;
  let slip = 0;

  // --- Par motor: acelera la rueda, con contacto o sin el (por eso el gas
  // hace girar la trasera en pleno vuelo). ---
  let torque = Number.isFinite(input.driveTorque) ? input.driveTorque : 0;

  if (input.inContact && input.normalLoad > 0) {
    // Deslizamiento: diferencia entre la velocidad periferica del neumatico y
    // la del suelo que pasa por debajo.
    const slipVelocity = spinRate * radius - input.groundSpeed;
    const stiffness = stableSlipStiffness(inertia, radius, safeDt);
    const gripLimit = WheelConfig.frictionCoefficient * input.normalLoad;

    // Fuerza que el neumatico "querria" hacer para eliminar el deslizamiento,
    // recortada por el agarre disponible. Cuando se satura es exactamente
    // cuando el neumatico patina o se bloquea: el excedente de par se queda
    // acelerando (o frenando) la rueda en vez de mover la moto.
    tractionForce = clamp(stiffness * slipVelocity, -gripLimit, gripLimit);

    // Reaccion sobre la rueda.
    torque -= tractionForce * radius;

    // Rozamiento de rodadura: pequeno, proporcional a la carga, siempre en
    // contra del giro. Es lo que hace que la moto se pare sola si sueltas.
    const rolling = WheelConfig.rollingResistance * input.normalLoad * radius;
    torque -= Math.sign(spinRate) * rolling;

    slip = clamp(slipVelocity, -WheelConfig.maxReportedSlip, WheelConfig.maxReportedSlip);
  } else {
    // Rueda libre: solo pierde vueltas poco a poco.
    torque -= spinRate * inertia * WheelConfig.airDrag;
    slip = 0;
  }

  spinRate += (torque / inertia) * safeDt;

  // --- Freno: par puro en contra del giro, nunca capaz de invertirlo. ---
  const brakeTorque = Math.max(0, Number.isFinite(input.brakeTorque) ? input.brakeTorque : 0);
  if (brakeTorque > 0 && spinRate !== 0) {
    // Par maximo que, en este paso, deja la rueda exactamente parada. Pasar de
    // ahi haria girar la rueda del reves, que es un artefacto numerico feo y
    // muy visible (la rueda "rebobina" al frenar).
    const stoppingTorque = (Math.abs(spinRate) * inertia) / safeDt;
    const applied = Math.min(brakeTorque, stoppingTorque);
    spinRate -= Math.sign(spinRate) * (applied / inertia) * safeDt;
  }

  if (!Number.isFinite(spinRate)) spinRate = 0;

  const spin = normalizeAngle((Number.isFinite(state.spin) ? state.spin : 0) + spinRate * safeDt);

  return {
    state: { spin, spinRate, slip: Number.isFinite(slip) ? slip : 0 },
    tractionForce: Number.isFinite(tractionForce) ? tractionForce : 0,
  };
}
