/**
 * RiderPose.ts
 *
 * El piloto deja de ser un sprite atornillado al asiento.
 *
 * El arte disponible es un unico PNG (rider.png), asi que no hay miembros
 * articulados que animar. Pero el 90% de lo que hace que un piloto "parezca
 * vivo" en un motocross 2D no son los codos: es que el cuerpo se adelante al
 * frenar, se eche atras al acelerar, se hunda cuando la suspension se come un
 * bache y se estire al despegar. Todo eso son tres numeros -desplazamiento
 * en x, en y, y rotacion del torso- y se pueden mover con el arte que hay.
 *
 * Los tres se mueven con muelles de SEGUNDO orden (posicion + velocidad), no
 * con un lerp: un lerp llega al destino frenando y nunca lo pasa, y eso es
 * justo lo que hace que un personaje parezca de madera. Un muelle amortiguado
 * por debajo del critico se pasa un poco, vuelve, y lee como peso.
 *
 * El inventario de piezas que haria falta para una pose realmente articulada
 * esta en docs/RIDER_RIG_ASSETS.md. Aqui no se inventa ningun collage: se
 * mueve la pieza que existe.
 */

import { clamp } from './MathUtils';
import { RiderConfig, SuspensionConfig } from '../config/GameConfig';

export interface RiderPose {
  /** Desplazamiento del cuerpo en el eje longitudinal del chasis (m). + = hacia el manillar. */
  shiftX: number;
  /** Desplazamiento vertical en espacio del chasis (m). + = se estira, - = se agacha. */
  shiftY: number;
  /** Rotacion del torso RESPECTO al chasis (rad). + = se echa atras. */
  torsoAngle: number;
  /** Velocidades internas de los muelles. No se dibujan; se integran. */
  shiftXVelocity: number;
  shiftYVelocity: number;
  torsoVelocity: number;
}

export interface RiderPoseInput {
  /** Lean suavizado del jugador en -1..1. */
  lean: number;
  /** Gas suavizado 0..1. */
  throttle: number;
  /** Freno suavizado 0..1. */
  brake: number;
  /** Compresion media de las dos suspensiones (m). */
  meanCompression: number;
  /** Velocidad vertical del chasis (m/s). */
  verticalSpeed: number;
  /** Velocidad angular del chasis (rad/s). */
  angularVelocity: number;
  airborne: boolean;
}

export function createRiderPose(): RiderPose {
  return { shiftX: 0, shiftY: 0, torsoAngle: 0, shiftXVelocity: 0, shiftYVelocity: 0, torsoVelocity: 0 };
}

export function cloneRiderPose(pose: RiderPose): RiderPose {
  return { ...pose };
}

export function lerpRiderPose(a: RiderPose, b: RiderPose, t: number): RiderPose {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    shiftX: mix(a.shiftX, b.shiftX),
    shiftY: mix(a.shiftY, b.shiftY),
    torsoAngle: mix(a.torsoAngle, b.torsoAngle),
    shiftXVelocity: mix(a.shiftXVelocity, b.shiftXVelocity),
    shiftYVelocity: mix(a.shiftYVelocity, b.shiftYVelocity),
    torsoVelocity: mix(a.torsoVelocity, b.torsoVelocity),
  };
}

/** Compresion media de referencia: media de los recorridos maximos de ambos ejes. */
const REFERENCE_TRAVEL =
  (SuspensionConfig.front.maxCompression + SuspensionConfig.rear.maxCompression) / 2;

/**
 * Un paso de muelle amortiguado de segundo orden, integrado semi-implicito
 * (se actualiza la velocidad y con ella la posicion: mas estable que Euler
 * explicito al mismo paso).
 */
function springStep(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  dampingRatio: number,
  dt: number,
): { value: number; velocity: number } {
  const omega = Math.sqrt(Math.max(0, stiffness));
  const damping = 2 * dampingRatio * omega;
  const accel = stiffness * (target - value) - damping * velocity;
  const nextVelocity = velocity + accel * dt;
  const nextValue = value + nextVelocity * dt;
  if (!Number.isFinite(nextValue) || !Number.isFinite(nextVelocity)) {
    return { value: target, velocity: 0 };
  }
  return { value: nextValue, velocity: nextVelocity };
}

/** Objetivos de pose para un estado dado. Separado del muelle para poder testearlo solo. */
export function riderPoseTargets(input: RiderPoseInput): { shiftX: number; shiftY: number; torsoAngle: number } {
  const lean = clamp(input.lean, -1, 1);
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);

  // Adelante/atras: el lean del jugador manda, el gas y el freno matizan.
  // Frenar empuja el cuerpo sobre el manillar; acelerar lo echa atras.
  const shiftX = clamp(
    lean * RiderConfig.leanToShiftX + brake * RiderConfig.brakeToShiftX + throttle * RiderConfig.throttleToShiftX,
    -RiderConfig.maxShiftX,
    RiderConfig.maxShiftX,
  );

  // Vertical: el cuerpo acompana a la suspension (se agacha cuando esta se
  // comprime) y ademas absorbe el golpe al aterrizar / se estira al despegar.
  const compressionRatio = REFERENCE_TRAVEL > 0 ? clamp(input.meanCompression / REFERENCE_TRAVEL, 0, 1.4) : 0;
  let shiftY = -compressionRatio * RiderConfig.compressionToShiftY * REFERENCE_TRAVEL;

  if (input.airborne && input.verticalSpeed > 0) {
    // Despegando: el cuerpo se estira, como quien "tira" de la moto hacia arriba.
    shiftY += Math.min(RiderConfig.maxTakeoffExtension, input.verticalSpeed * RiderConfig.takeoffExtension);
  } else if (!input.airborne && input.verticalSpeed < 0) {
    // Recibiendo: el cuerpo se hunde para tragarse el impacto.
    shiftY -= Math.min(RiderConfig.maxLandingAbsorb, -input.verticalSpeed * RiderConfig.landingAbsorb);
  }
  shiftY = clamp(shiftY, -RiderConfig.maxShiftY, RiderConfig.maxShiftY);

  // Torso: inclinacion del cuerpo respecto a la moto.
  let torsoAngle = lean * RiderConfig.leanToTorso + brake * RiderConfig.brakeToTorso + throttle * RiderConfig.throttleToTorso;
  if (input.airborne) {
    // En vuelo el cuerpo contrarresta el cabeceo del chasis: si la moto gira
    // hacia atras, el piloto se adelanta. Es lo que hace legible el giro.
    torsoAngle -= clamp(
      input.angularVelocity * RiderConfig.airPitchCounter,
      -RiderConfig.maxAirPitchCounter,
      RiderConfig.maxAirPitchCounter,
    );
  }
  torsoAngle = clamp(torsoAngle, -RiderConfig.maxTorsoAngle, RiderConfig.maxTorsoAngle);

  return { shiftX, shiftY, torsoAngle };
}

/** Avanza la pose del piloto un paso fijo. Pura: devuelve una pose nueva. */
export function stepRiderPose(pose: RiderPose, input: RiderPoseInput, dt: number): RiderPose {
  const targets = riderPoseTargets(input);

  const x = springStep(
    pose.shiftX,
    pose.shiftXVelocity,
    targets.shiftX,
    RiderConfig.torsoStiffness,
    RiderConfig.torsoDampingRatio,
    dt,
  );
  const y = springStep(
    pose.shiftY,
    pose.shiftYVelocity,
    targets.shiftY,
    RiderConfig.torsoStiffness,
    RiderConfig.torsoDampingRatio,
    dt,
  );
  const torso = springStep(
    pose.torsoAngle,
    pose.torsoVelocity,
    targets.torsoAngle,
    RiderConfig.torsoStiffness,
    RiderConfig.torsoDampingRatio,
    dt,
  );

  return {
    shiftX: clamp(x.value, -RiderConfig.maxShiftX * 1.35, RiderConfig.maxShiftX * 1.35),
    shiftXVelocity: x.velocity,
    shiftY: clamp(y.value, -RiderConfig.maxShiftY * 1.35, RiderConfig.maxShiftY * 1.35),
    shiftYVelocity: y.velocity,
    torsoAngle: clamp(torso.value, -RiderConfig.maxTorsoAngle * 1.3, RiderConfig.maxTorsoAngle * 1.3),
    torsoVelocity: torso.velocity,
  };
}
