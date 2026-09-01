/**
 * RigPoseCatalog.ts
 *
 * Las dieciseis poses canonicas del ensamblaje, en un solo sitio.
 *
 * Existe por un problema de fondo del banco anterior: sus poses eran estados
 * ESCRITOS A MANO. Cada una traia su `rider: { shiftX: -0.28, torsoAngle:
 * 0.24, ... }` teclado por alguien, asi que el banco dibujaba una postura
 * inventada y no la que produce el juego. Podia estar en verde con el sistema
 * de pose completamente roto, que es exactamente lo contrario de lo que sirve
 * un banco de comprobacion.
 *
 * Aqui cada pose describe una SITUACION FISICA -que hace la moto, que pide el
 * jugador, en que estado esta la suspension- y la postura del piloto se
 * resuelve con `riderPoseTargets`, el mismo codigo que corre en partida. Si
 * alguien rompe la pose, el banco y las pruebas se enteran a la vez.
 *
 * El catalogo lo comparten el banco visual (`rigCheck.ts`) y las pruebas de
 * geometria, para que no puedan desincronizarse.
 */

import { BikeState, createInitialBikeState } from '../physics/Bike';
import { riderPoseTargets } from '../physics/RiderPose';
import { BikeConfig, SuspensionConfig } from '../config/GameConfig';

export interface RigPose {
  label: string;
  /** Estado de la moto, con la pose del piloto ya resuelta por el sistema. */
  bike: BikeState;
  /** Si el piloto deberia estar en estado de choque al dibujarse. */
  crashed?: boolean;
  /** Segundos transcurridos desde el choque (decide si sigue montado). */
  crashElapsed?: number;
}

/** Compresion de reposo de cada eje con el reparto estatico de peso. */
function sagCompression(side: 'front' | 'rear'): number {
  const params = side === 'front' ? SuspensionConfig.front : SuspensionConfig.rear;
  const staticLoad = (BikeConfig.mass * 19.2) / 2;
  return Math.min(params.maxCompression, staticLoad / params.springStrength);
}

interface Situation {
  /** Intencion del jugador, ya suavizada (0..1 y -1..1). */
  lean?: number;
  throttle?: number;
  brake?: number;
  /** Estado del chasis. */
  angle?: number;
  vx?: number;
  vy?: number;
  angularVelocity?: number;
  /** Compresion de cada eje; si se omite, la de reposo. */
  frontCompression?: number;
  rearCompression?: number;
  frontInContact?: boolean;
  rearInContact?: boolean;
  /** Altura sobre el suelo. Solo importa en vuelo. */
  heightAboveGround?: number;
  /** Altura del centro de masas en vuelo (si no, se calcula para apoyar). */
  airY?: number;
  frontSpin?: number;
  rearSpin?: number;
  frontSpinRate?: number;
  rearSpinRate?: number;
  rearSlip?: number;
}

/**
 * Construye el estado a partir de la situacion, resolviendo la postura del
 * piloto con el sistema real. `heightAboveGround` se pasa tal cual porque es
 * lo que el piloto usa para preparar la recepcion.
 */
function poseFrom(situation: Situation): BikeState {
  const front = situation.frontCompression ?? sagCompression('front');
  const rear = situation.rearCompression ?? sagCompression('rear');
  const frontInContact = situation.frontInContact ?? true;
  const rearInContact = situation.rearInContact ?? true;
  const airborne = !frontInContact && !rearInContact;

  // Altura del centro de masas para que el suelo caiga en y = 0 cuando apoya.
  const drop = (SuspensionConfig.front.restLength - front + SuspensionConfig.rear.restLength - rear) / 2;
  const groundedY = drop + BikeConfig.anchorDropFromCom + BikeConfig.wheelRadius;
  const y = airborne ? (situation.airY ?? groundedY + 1.6) : groundedY;

  const base = createInitialBikeState(0, y);
  const targets = riderPoseTargets({
    lean: situation.lean ?? 0,
    throttle: situation.throttle ?? 0,
    brake: situation.brake ?? 0,
    meanCompression: (front + rear) / 2,
    verticalSpeed: situation.vy ?? 0,
    angularVelocity: situation.angularVelocity ?? 0,
    airborne,
    heightAboveGround: situation.heightAboveGround ?? (airborne ? 6 : 0),
  });

  return {
    ...base,
    angle: situation.angle ?? 0,
    vx: situation.vx ?? 0,
    vy: situation.vy ?? 0,
    angularVelocity: situation.angularVelocity ?? 0,
    throttleAmount: situation.throttle ?? 0,
    brakeAmount: situation.brake ?? 0,
    leanAmount: situation.lean ?? 0,
    rider: {
      shiftX: targets.shiftX,
      shiftY: targets.shiftY,
      torsoAngle: targets.torsoAngle,
      shiftXVelocity: 0,
      shiftYVelocity: 0,
      torsoVelocity: 0,
    },
    front: {
      ...base.front,
      compression: front,
      inContact: frontInContact,
      groundY: frontInContact ? 0 : y - 3,
      contactX: BikeConfig.wheelBase / 2,
      load: frontInContact ? 1700 : 0,
      wheel: { spin: situation.frontSpin ?? 0, spinRate: situation.frontSpinRate ?? 0, slip: 0 },
    },
    rear: {
      ...base.rear,
      compression: rear,
      inContact: rearInContact,
      groundY: rearInContact ? 0 : y - 3,
      contactX: -BikeConfig.wheelBase / 2,
      load: rearInContact ? 1700 : 0,
      wheel: {
        spin: situation.rearSpin ?? 0,
        spinRate: situation.rearSpinRate ?? 0,
        slip: situation.rearSlip ?? 0,
      },
    },
  };
}

const MAX_FRONT = SuspensionConfig.front.maxCompression;
const MAX_REAR = SuspensionConfig.rear.maxCompression;

export const RIG_POSES: RigPose[] = [
  { label: '1. PARADA', bike: poseFrom({}) },
  {
    label: '2. ACELERANDO',
    bike: poseFrom({ throttle: 1, angle: 0.16, vx: 12, frontCompression: 0.05, rearCompression: 0.3, rearSpinRate: 90, rearSlip: 3.4, rearSpin: 1.2 }),
  },
  {
    label: '3. FRENANDO',
    bike: poseFrom({ brake: 1, angle: -0.12, vx: 18, frontCompression: 0.34, rearCompression: 0.02, frontSpin: -0.6, frontSpinRate: 20 }),
  },
  {
    label: '4. CABALLITO SUAVE',
    bike: poseFrom({ throttle: 1, lean: 0.5, angle: 0.34, vx: 9, frontCompression: 0, rearCompression: 0.24, frontInContact: false, rearSpinRate: 80, rearSpin: 1.8 }),
  },
  {
    label: '5. CABALLITO FUERTE',
    bike: poseFrom({ throttle: 1, lean: 1, angle: 0.72, vx: 9, frontCompression: 0, rearCompression: 0.3, frontInContact: false, rearSpinRate: 96, rearSpin: 2.4, rearSlip: 2.1 }),
  },
  {
    label: '6. DESPEGUE',
    bike: poseFrom({ throttle: 1, angle: 0.3, vx: 20, vy: 9, frontCompression: 0, rearCompression: 0.04, frontInContact: false, angularVelocity: 1.4, frontSpinRate: 70, rearSpinRate: 118 }),
  },
  {
    label: '7. VUELO ASCENDENTE',
    bike: poseFrom({ throttle: 1, angle: 0.28, vx: 20, vy: 7, frontInContact: false, rearInContact: false, frontCompression: 0, rearCompression: 0, angularVelocity: 1.2, heightAboveGround: 5, frontSpinRate: 70, rearSpinRate: 118 }),
  },
  {
    label: '8. VERTICE',
    bike: poseFrom({ throttle: 1, angle: 0.05, vx: 21, vy: 0, frontInContact: false, rearInContact: false, frontCompression: 0, rearCompression: 0, heightAboveGround: 7, airY: 3.4, frontSpinRate: 66, rearSpinRate: 100 }),
  },
  {
    label: '9. DESCENSO',
    bike: poseFrom({ throttle: 1, angle: -0.22, vx: 21, vy: -9, frontInContact: false, rearInContact: false, frontCompression: 0, rearCompression: 0, heightAboveGround: 1.1, airY: 2.2, angularVelocity: -0.6, frontSpinRate: 64, rearSpinRate: 96 }),
  },
  {
    label: '10. RECEPCION SUAVE',
    bike: poseFrom({ angle: 0.0, vx: 18, vy: -4, frontCompression: 0.16, rearCompression: 0.2, frontSpinRate: 58, rearSpinRate: 60 }),
  },
  {
    label: '11. RECEPCION FUERTE',
    bike: poseFrom({ angle: 0.02, vx: 19, vy: -12, frontCompression: MAX_FRONT, rearCompression: MAX_REAR, frontSpinRate: 58, rearSpinRate: 62 }),
  },
  {
    label: '12. SUSPENSION EXTENDIDA DEL TODO',
    bike: poseFrom({ vx: 16, vy: 2, frontInContact: false, rearInContact: false, frontCompression: 0, rearCompression: 0, heightAboveGround: 4, frontSpinRate: 52, rearSpinRate: 52 }),
  },
  {
    label: '13. SUSPENSION AL TOPE',
    bike: poseFrom({ vx: 4, vy: -14, frontCompression: MAX_FRONT, rearCompression: MAX_REAR }),
  },
  {
    label: '14. IMPACTO — piloto AUN montado',
    bike: poseFrom({ angle: -0.62, vx: 6, frontCompression: 0.34, rearCompression: 0.05 }),
    crashed: true,
    crashElapsed: 0.1,
  },
  {
    label: '15. CAIDA — piloto separado',
    bike: poseFrom({ angle: -0.9, vx: 3, frontCompression: 0.2, rearCompression: 0.1 }),
    crashed: true,
    crashElapsed: 0.5,
  },
  {
    label: '16. GIRO DE RUEDA',
    bike: poseFrom({ frontSpin: Math.PI / 2, rearSpin: Math.PI / 2 }),
  },
];
