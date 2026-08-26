/**
 * Suspension.ts
 *
 * Modelo de suspension por rueda: un muelle amortiguado que se comprime
 * cuando la rueda esta mas cerca del suelo de lo que su longitud de reposo
 * permite. Funcion pura, sin estado propio (el estado -compresion anterior-
 * lo guarda el llamador, normalmente WheelState en Bike.ts).
 */

import { clamp } from './MathUtils';

export interface SuspensionParams {
  restLength: number;
  maxCompression: number;
  springStrength: number;
  damping: number;
  wheelRadius: number;
}

export interface SuspensionResult {
  /** Compresion actual, en [0, maxCompression]. 0 = totalmente extendida. */
  compression: number;
  /** Fuerza vertical resultante (N), siempre >= 0, aplicada hacia arriba. */
  force: number;
  /** Si la rueda esta tocando el suelo (compresion > 0). */
  inContact: boolean;
  /** Punto Y del suelo bajo la rueda (para depuracion/render). */
  groundY: number;
}

/**
 * Calcula la compresion y fuerza de una rueda dado:
 * - anchorY: altura del punto de anclaje de la rueda sobre el chasis (mundo).
 * - groundY: altura del terreno bajo esa rueda (mundo).
 * - prevCompression: compresion del tick anterior (para el termino de amortiguacion).
 * - dt: paso de tiempo de la simulacion.
 */
/**
 * Rigidez extra que entra en juego cuando la rueda se queda sin recorrido
 * (compresion por encima de maxCompression: "tope duro"). Sin esto, un
 * impacto lo bastante fuerte simplemente satura la fuerza del muelle normal
 * y el chasis puede terminar atravesando el terreno visualmente.
 */
const BOTTOM_OUT_STIFFNESS_MULTIPLIER = 6;

export function computeSuspension(
  params: SuspensionParams,
  anchorY: number,
  groundY: number,
  prevCompression: number,
  dt: number,
): SuspensionResult {
  const extendedGap = anchorY - groundY - params.wheelRadius;
  const rawCompression = params.restLength - extendedGap;
  const safeRawCompression = Number.isFinite(rawCompression) ? rawCompression : 0;
  const compression = clamp(safeRawCompression, 0, params.maxCompression);
  const inContact = compression > 1e-6;

  let force = 0;
  if (inContact) {
    const springForce = compression * params.springStrength;
    const safeDt = dt > 1e-6 ? dt : 1 / 120;
    const compressionVelocity = (compression - prevCompression) / safeDt;
    const damperForce = compressionVelocity * params.damping;
    force = Math.max(0, springForce + damperForce);

    // Tope duro: si la penetracion real supera el recorrido maximo de la
    // suspension, anadimos una fuerza de muelle mucho mas rigida sobre el
    // exceso para frenar en seco antes de que el chasis atraviese el suelo.
    const overshoot = safeRawCompression - params.maxCompression;
    if (overshoot > 0) {
      force += overshoot * params.springStrength * BOTTOM_OUT_STIFFNESS_MULTIPLIER;
    }
  }

  return {
    compression,
    force: Number.isFinite(force) ? force : 0,
    inContact,
    groundY,
  };
}
