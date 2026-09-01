/**
 * rigMetrics.ts
 *
 * Las medidas del ensamblaje, calculadas sobre las mismas poses que dibuja el
 * banco visual. Una captura ensena si algo parece mal; esto dice cuanto.
 */

import { BikeState } from '../../src/physics/Bike';
import { rotateVec } from '../../src/physics/MathUtils';
import { SpriteCalibration } from '../../src/rendering/SpriteAssets';
import {
  ANKLE_OVER_PEG,
  FOOTPEG_LOCAL,
  HANDLEBAR_GRIP_LOCAL,
  RIDER_HIP_LOCAL,
  solveRiderRig,
} from '../../src/rendering/RiderRig';

export interface RigMetrics {
  /** Distancia de la mano al puno del manillar (m). 0 = enganchada. */
  handToGrip: number;
  /** Distancia del tobillo a su objetivo sobre la estribera (m). */
  footToPeg: number;
  /** Desplazamiento de la cadera respecto a su punto de reposo (m). */
  hipTravel: number;
  /** Cadera en espacio local del chasis, para comprobar que sigue en el asiento. */
  hipLocal: { x: number; y: number };
  /** Angulo del torso en el MUNDO (rad). 0 = vertical como en la foto. */
  torsoWorldAngle: number;
  /**
   * Cuanto del cabeceo del chasis copia el torso, de 0 a 1. Solo tiene sentido
   * con el chasis claramente inclinado: con la moto casi plana el cociente
   * divide por casi cero y da numeros sin significado.
   */
  torsoFollowsChassis: number | null;
  /** Desviacion del torso respecto al chasis (rad). Vale siempre. */
  torsoVsChassis: number;
  /** Angulo interior de rodilla y codo en grados (180 = estirado). */
  kneeDegrees: number;
  elbowDegrees: number;
}

function jointAngle(a: number, b: number, distance: number): number {
  const d = Math.min(distance, a + b);
  const cos = (a * a + b * b - d * d) / (2 * a * b);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export function measureRig(bike: BikeState): RigMetrics {
  const rig = SpriteCalibration.riderRig;
  const geometry = solveRiderRig({ x: bike.x, y: bike.y }, bike.angle, bike.rider, 100);

  const toWorld = (local: { x: number; y: number }) => {
    const r = rotateVec(local, bike.angle);
    return { x: bike.x + r.x, y: bike.y + r.y };
  };
  const grip = toWorld(HANDLEBAR_GRIP_LOCAL);
  const ankleTarget = toWorld({
    x: FOOTPEG_LOCAL.x + ANKLE_OVER_PEG.x,
    y: FOOTPEG_LOCAL.y + ANKLE_OVER_PEG.y,
  });

  const forearm = rig.armFore.lengthPx / rig.pxPerMeter;
  const shin = rig.shin.lengthPx / rig.pxPerMeter;
  const hand = {
    x: geometry.arm.joint.x + Math.cos(geometry.arm.midAngle) * forearm,
    y: geometry.arm.joint.y + Math.sin(geometry.arm.midAngle) * forearm,
  };
  const ankle = {
    x: geometry.leg.joint.x + Math.cos(geometry.leg.midAngle) * shin,
    y: geometry.leg.joint.y + Math.sin(geometry.leg.midAngle) * shin,
  };

  const hipRest = toWorld(RIDER_HIP_LOCAL);
  // La cadera DIBUJADA, devuelta a espacio local del chasis. Se mide la que se
  // ve, no la que pide la pose: el rig la recorta al asiento y la recoloca
  // para que las cadenas alcancen, asi que son numeros distintos y el que
  // importa aqui es el segundo.
  const dx = geometry.hipWorld.x - bike.x;
  const dy = geometry.hipWorld.y - bike.y;
  const cos = Math.cos(-bike.angle);
  const sin = Math.sin(-bike.angle);
  const hipLocal = { x: dx * cos - dy * sin, y: dx * sin + dy * cos };

  const shoulderToGrip = Math.hypot(grip.x - geometry.shoulderWorld.x, grip.y - geometry.shoulderWorld.y);
  const hipToAnkle = Math.hypot(ankleTarget.x - geometry.hipWorld.x, ankleTarget.y - geometry.hipWorld.y);

  return {
    handToGrip: Math.hypot(hand.x - grip.x, hand.y - grip.y),
    footToPeg: Math.hypot(ankle.x - ankleTarget.x, ankle.y - ankleTarget.y),
    hipTravel: Math.hypot(geometry.hipWorld.x - hipRest.x, geometry.hipWorld.y - hipRest.y),
    hipLocal,
    torsoWorldAngle: geometry.torsoWorldAngle,
    // Cuanto del cabeceo copia el torso. Con el torso pegado al chasis vale 1
    // exacto y el piloto gira como una pegatina; el mandato pide que sea
    // MENOR que 1 para que la cabeza conserve parte de su orientacion.
    torsoFollowsChassis: Math.abs(bike.angle) < 0.2 ? null : geometry.torsoWorldAngle / bike.angle,
    torsoVsChassis: geometry.torsoWorldAngle - bike.angle,
    kneeDegrees: jointAngle(rig.thigh.lengthPx / rig.pxPerMeter, shin, hipToAnkle),
    elbowDegrees: jointAngle(rig.armUpper.lengthPx / rig.pxPerMeter, forearm, shoulderToGrip),
  };
}
