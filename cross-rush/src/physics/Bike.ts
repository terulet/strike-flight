/**
 * Bike.ts
 *
 * El chasis: masa puntual con rotacion, dos ruedas con su propia suspension,
 * traccion/freno en el suelo y control aereo. Es fisica "pura": no sabe nada
 * de flow, trucos, aterrizajes ni render. Solo avanza el estado un tick fijo.
 */

import { Terrain } from './Terrain';
import { computeSuspension, SuspensionParams } from './Suspension';
import { clamp, rotateVec } from './MathUtils';
import {
  BikeConfig,
  EngineConfig,
  BrakeConfig,
  SuspensionConfig,
  AirControlConfig,
  GravityConfig,
} from '../config/GameConfig';

export interface BikeInput {
  throttle: boolean;
  brake: boolean;
  /** -1 = inclinar atras (backflip), +1 = inclinar delante (frontflip). */
  lean: number;
}

export interface WheelRuntimeState {
  compression: number;
  inContact: boolean;
  groundY: number;
  contactX: number;
}

export interface BikeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  front: WheelRuntimeState;
  rear: WheelRuntimeState;
}

const FRONT_SUSPENSION: SuspensionParams = { ...SuspensionConfig.front, wheelRadius: BikeConfig.wheelRadius };
const REAR_SUSPENSION: SuspensionParams = { ...SuspensionConfig.rear, wheelRadius: BikeConfig.wheelRadius };

export function createInitialBikeState(x: number, y: number): BikeState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    front: { compression: 0, inContact: false, groundY: y, contactX: x },
    rear: { compression: 0, inContact: false, groundY: y, contactX: x },
  };
}

export function cloneBikeState(state: BikeState): BikeState {
  return {
    ...state,
    front: { ...state.front },
    rear: { ...state.rear },
  };
}

function frontOffset(): { x: number; y: number } {
  return { x: BikeConfig.wheelBase / 2, y: -BikeConfig.comHeight };
}

function rearOffset(): { x: number; y: number } {
  return { x: -BikeConfig.wheelBase / 2, y: -BikeConfig.comHeight };
}

function driveForceAtSpeed(speedAlongTangent: number): number {
  const top = EngineConfig.topSpeed;
  const start = top * EngineConfig.torqueFalloffStart;
  const s = Math.abs(speedAlongTangent);
  if (s <= start) return EngineConfig.maxDriveForce;
  if (s >= top) return 0;
  const t = (s - start) / (top - start);
  return EngineConfig.maxDriveForce * (1 - t);
}

/**
 * Avanza el estado de la moto un paso fijo `dt`. Devuelve un nuevo estado
 * (no muta el que se le pasa), para facilitar tests deterministas.
 */
export function stepBike(state: BikeState, terrain: Terrain, input: BikeInput, dt: number): BikeState {
  const next = cloneBikeState(state);

  // --- Gravedad ---
  next.vy -= GravityConfig.g * dt;

  const mass = BikeConfig.mass;
  const inertia = BikeConfig.inertia;

  let sumForceX = 0;
  let sumForceY = 0;
  let sumTorque = 0;

  const fOffsetLocal = frontOffset();
  const rOffsetLocal = rearOffset();
  const fOffsetWorld = rotateVec(fOffsetLocal, state.angle);
  const rOffsetWorld = rotateVec(rOffsetLocal, state.angle);

  const frontAnchor = { x: state.x + fOffsetWorld.x, y: state.y + fOffsetWorld.y };
  const rearAnchor = { x: state.x + rOffsetWorld.x, y: state.y + rOffsetWorld.y };

  const frontGroundY = terrain.surfaceY(frontAnchor.x);
  const rearGroundY = terrain.surfaceY(rearAnchor.x);

  const frontResult = computeSuspension(FRONT_SUSPENSION, frontAnchor.y, frontGroundY, state.front.compression, dt);
  const rearResult = computeSuspension(REAR_SUSPENSION, rearAnchor.y, rearGroundY, state.rear.compression, dt);

  next.front = {
    compression: frontResult.compression,
    inContact: frontResult.inContact,
    groundY: frontGroundY,
    contactX: frontAnchor.x,
  };
  next.rear = {
    compression: rearResult.compression,
    inContact: rearResult.inContact,
    groundY: rearGroundY,
    contactX: rearAnchor.x,
  };

  // --- Fuerzas de suspension, aplicadas a lo largo de la normal del terreno ---
  if (frontResult.inContact) {
    const n = terrain.surfaceNormal(frontAnchor.x);
    const fx = n.x * frontResult.force;
    const fy = n.y * frontResult.force;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += fOffsetWorld.x * fy - fOffsetWorld.y * fx;
  }
  if (rearResult.inContact) {
    const n = terrain.surfaceNormal(rearAnchor.x);
    const fx = n.x * rearResult.force;
    const fy = n.y * rearResult.force;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += rOffsetWorld.x * fy - rOffsetWorld.y * fx;
  }

  // --- Traccion (rueda trasera) y freno (ambas ruedas si hay contacto) ---
  const anyGrounded = frontResult.inContact || rearResult.inContact;

  if (rearResult.inContact && input.throttle) {
    const n = terrain.surfaceNormal(rearAnchor.x);
    const tangent = { x: n.y, y: -n.x };
    const speedAlongTangent = state.vx * tangent.x + state.vy * tangent.y;
    const drive = driveForceAtSpeed(speedAlongTangent);
    const fx = tangent.x * drive;
    const fy = tangent.y * drive;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += rOffsetWorld.x * fy - rOffsetWorld.y * fx;
  }

  if (input.brake && anyGrounded) {
    for (const [result, offsetWorld, factor] of [
      [frontResult, fOffsetWorld, 1] as const,
      [rearResult, rOffsetWorld, BrakeConfig.rearBrakeFactor] as const,
    ]) {
      if (!result.inContact) continue;
      const n = terrain.surfaceNormal(result === frontResult ? frontAnchor.x : rearAnchor.x);
      const tangent = { x: n.y, y: -n.x };
      const speedAlongTangent = state.vx * tangent.x + state.vy * tangent.y;
      const brakeForceMag = Math.min(BrakeConfig.maxBrakeForce * factor, Math.abs(speedAlongTangent) * mass / dt);
      const sign = speedAlongTangent > 0 ? -1 : speedAlongTangent < 0 ? 1 : 0;
      const fx = tangent.x * brakeForceMag * sign;
      const fy = tangent.y * brakeForceMag * sign;
      sumForceX += fx;
      sumForceY += fy;
      sumTorque += offsetWorld.x * fy - offsetWorld.y * fx;
    }
  }

  // --- Integracion lineal ---
  next.vx += (sumForceX / mass) * dt;
  next.vy += (sumForceY / mass) * dt;
  next.x += next.vx * dt;
  next.y += next.vy * dt;

  // --- Rotacion: en el suelo, la suspension ya genera par realista.
  // En el aire, el jugador controla el "pitch" directamente. ---
  if (!anyGrounded) {
    next.angularVelocity += input.lean * AirControlConfig.airControlStrength * dt;
    const dampingFactor = Math.max(0, 1 - AirControlConfig.airAngularDamping * dt);
    next.angularVelocity *= dampingFactor;
  } else {
    next.angularVelocity += (sumTorque / inertia) * dt;
    // Ligero amortiguamiento en el suelo para que no oscile eternamente.
    next.angularVelocity *= Math.max(0, 1 - 2.0 * dt);
  }

  next.angularVelocity = clamp(
    next.angularVelocity,
    -AirControlConfig.maxAngularVelocity,
    AirControlConfig.maxAngularVelocity,
  );

  next.angle += next.angularVelocity * dt;

  return next;
}

export function isAirborne(state: BikeState): boolean {
  return !state.front.inContact && !state.rear.inContact;
}
