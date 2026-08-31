/**
 * CrashDetector.ts
 *
 * Ademas del crash derivado de un mal aterrizaje (ver LandingClassifier),
 * la moto puede estrellarse si el chasis (no las ruedas) llega a tocar el
 * terreno -por ejemplo, cayendo de morro o de espaldas- o si gira demasiado
 * rapido estando en contacto con el suelo.
 */

import { BikeState } from '../physics/Bike';
import { Terrain } from '../physics/Terrain';
import { angleDelta, rotateVec } from '../physics/MathUtils';
import { ChassisGeometry, CrashConfig } from '../config/GameConfig';

/**
 * ¿Esta la moto clavada en el suelo con la carroceria?
 *
 * Se comprueban las dos puntas del chasis -morro y cola-, transformadas al
 * mundo con el angulo real de la moto, contra el PLANO SOBRE EL QUE RUEDAN
 * LAS RUEDAS: la recta que une el punto de suelo bajo el eje trasero con el
 * de bajo el delantero.
 *
 * Esa recta, y no el terreno muestreado punto a punto, es la referencia
 * correcta. Una moto con 1.35 m entre ejes que aterriza en una vaguada -la
 * base de un step-up, por ejemplo- tiene las dos ruedas perfectamente
 * apoyadas y sin embargo su centro queda por debajo de la superficie medida
 * en su propia x, porque la moto va sobre la cuerda y el terreno va por el
 * arco. Comparar contra el terreno directamente declaraba "chasis clavado"
 * en aterrizajes impecables; comparar contra la cuerda mide lo que se queria
 * medir de verdad, que es la ACTITUD de la moto: si va de morro o de cola, la
 * punta baja por debajo del plano de rodadura y raspa.
 *
 * Las dos puntas van por encima del centro de masas (ver ChassisGeometry), de
 * forma que tocar fondo de suspension NO cuenta como clavar el chasis: solo lo
 * cuenta ir muy de morro o muy de cola.
 *
 * (La version original comparaba la altura del centro de masas contra una
 * constante. Solo funcionaba porque el centro de masas estaba colocado a
 * 1.45 m del suelo, casi el doble de lo que mide una moto real.)
 */
export function isChassisTouchingGround(state: BikeState, terrain: Terrain): boolean {
  const rearX = state.rear.contactX;
  const frontX = state.front.contactX;
  const span = frontX - rearX;

  // Degenerado (moto perfectamente vertical): se cae al terreno bajo el centro.
  const groundAt = (x: number): number => {
    if (Math.abs(span) < 1e-6) return terrain.surfaceY(x);
    const t = (x - rearX) / span;
    return state.rear.groundY + (state.front.groundY - state.rear.groundY) * t;
  };

  // Clavarse es una cuestion de ACTITUD, no de altura: la moto tiene que
  // llegar claramente cruzada respecto al plano sobre el que rueda. Un
  // aterrizaje duro pero bien orientado hunde la suspension hasta el tope y
  // baja mucho el chasis, y eso no es un crash: es aterrizar fuerte.
  const planeAngle =
    Math.abs(span) < 1e-6 ? state.angle : Math.atan2(state.front.groundY - state.rear.groundY, span);
  const crossed = Math.abs(angleDelta(state.angle, planeAngle)) >= CrashConfig.chassisAttitudeThreshold;

  for (const local of [ChassisGeometry.nose, ChassisGeometry.tail]) {
    const offset = rotateVec(local, state.angle);
    const tipX = state.x + offset.x;
    const tipY = state.y + offset.y;
    const clearance = tipY - groundAt(tipX);
    if (crossed && clearance < CrashConfig.chassisGroundMargin) return true;
    // Salvaguarda independiente de la actitud: la moto esta metida dentro del
    // terreno, no rozandolo (ver CrashConfig.chassisDeepPenetration).
    if (clearance < -CrashConfig.chassisDeepPenetration) return true;
  }
  return false;
}

export function isSpinningOutOnGround(state: BikeState): boolean {
  const grounded = state.front.inContact || state.rear.inContact;
  return grounded && Math.abs(state.angularVelocity) >= CrashConfig.crashAngularVelocity;
}
