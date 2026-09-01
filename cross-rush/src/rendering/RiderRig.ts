/**
 * RiderRig.ts
 *
 * Piloto articulado: torso, brazo de dos huesos y pierna de dos huesos, con
 * las manos resueltas contra el manillar y los pies contra la estribera por
 * cinematica inversa.
 *
 * Por que IK y no una animacion: el mandato pide dos cosas que se contradicen
 * si el piloto es una imagen rigida. Pide que brazos y piernas REACCIONEN, y
 * pide que el piloto NUNCA se separe de la moto. Con el cuerpo entero pegado
 * al asiento, mover el cuerpo despega las manos del manillar; con las manos
 * clavadas al manillar, el cuerpo no se puede mover. La unica forma de tener
 * las dos cosas es que las extremidades apunten a donde estan los agarres, y
 * eso es exactamente lo que hace una cadena de dos huesos.
 *
 * El efecto secundario es el que se buscaba: al echar el cuerpo atras, el
 * brazo se estira; al agacharse, la rodilla se dobla. No hay que animar nada,
 * sale de la geometria.
 *
 * Geometria de agarre (manillar y estribera) medida sobre `bike_body.png` y
 * expresada en metros desde el centro de masas, igual que el resto de puntos
 * del chasis.
 */

import { Vec2, clamp, rotateVec } from '../physics/MathUtils';
import { SpriteCalibration, SpriteImages } from './SpriteAssets';
import { RiderPose } from '../physics/RiderPose';

/**
 * Puno del manillar, en espacio local del chasis (metros desde el centro de
 * masas). Medido sobre `bike_body.png`: el puno cae en el pixel (395, 30) y el
 * centro de masas en (341.7, 176.3), con la foto a 347 px/m.
 */
export const HANDLEBAR_GRIP_LOCAL: Vec2 = { x: 0.19, y: 0.40 };
/** Estribera, en el mismo espacio. Pixel (370, 330) de la foto del chasis. */
/**
 * Estribera en espacio local del chasis.
 *
 * Estaba a 0,42 m por debajo del centro de masas, que sobre este arte deja el
 * apoyo a 23 cm del suelo: mas abajo que el motor. La bota del piloto, que
 * sobresale por delante del tobillo, acababa colgando por debajo del carter,
 * flotando fuera de la moto. En una moto de verdad la estribera esta a la
 * altura del bajo del motor, no debajo.
 */
export const FOOTPEG_LOCAL: Vec2 = { x: 0.02, y: -0.27 };
/**
 * Cadera del piloto en reposo, en espacio local del chasis. Es el punto sobre
 * el que actua la pose (desplazamiento y agachado); las extremidades salen de
 * ahi y se resuelven contra los agarres.
 *
 * Queda por encima del asiento (que esta a y = -0.18) porque el arte del
 * piloto es una pose de ataque, de pie sobre las estriberas: en esa postura
 * las caderas van flotando sobre el asiento, no apoyadas en el.
 */
/**
 * Cadera del piloto en espacio local del chasis.
 *
 * Bajada de -0,09 a -0,17: con la anterior el cuerpo quedaba apoyado ENCIMA
 * del asiento en vez de metido en el, y el conjunto se leia como un muneco
 * colocado sobre la moto y no como alguien montado.
 */
export const RIDER_HIP_LOCAL: Vec2 = { x: -0.06, y: -0.17 };

/**
 * Desplazamiento de la pierna del lado LEJANO respecto a la cercana. La misma
 * pareja de piezas se dibuja dos veces: una detras del torso, corrida hacia
 * atras y oscurecida, y otra delante. Da profundidad sin un solo asset mas.
 */
const FAR_LEG_OFFSET: Vec2 = { x: -0.06, y: 0 };
const FAR_LIMB_FILTER = 'brightness(0.62) saturate(0.85)';

/**
 * Luz por pieza del lado CERCANO.
 *
 * El rig ya movia brazos y piernas de forma correcta, pero en pantalla el
 * piloto se leia como una mancha: las siete piezas salen de la misma foto y
 * llevan el mismo estampado, asi que el brazo no se distinguia del pecho, y
 * todo el trabajo de la cinematica inversa no se veia. (Que la pierna no se
 * confundiera con el carenado lo arregla ademas el color: el mono es azul y la
 * moto roja, ver assets-src/recolor_rider.py.)
 *
 * La solucion no es tocar la animacion, es separar las siluetas con luz. El
 * sol viene de arriba a la izquierda (ver TerrainPainter.LIGHT_DIRECTION):
 *  - El brazo va por delante y arriba, expuesto -> mas claro y con mas
 *    contraste, se recorta contra el pecho.
 *  - El muslo queda a la sombra del cuerpo y del deposito -> mas oscuro.
 *  - La espinilla, aun mas abajo y contra la moto -> algo mas oscuro todavia,
 *    lo justo para que la rodilla se lea como un doblez y no como una arruga
 *    del estampado.
 *
 * Es la misma escala de grises que ya separaba el lado lejano del cercano,
 * solo que con pasos mas finos, y se hornea una vez por pieza
 * (SpriteFilters.ts): en tiempo de dibujo no cuesta nada.
 */
const NEAR_ARM_FILTER = 'brightness(1.12) contrast(1.08)';
const NEAR_THIGH_FILTER = 'brightness(0.86) saturate(0.96)';
const NEAR_SHIN_FILTER = 'brightness(0.78) saturate(0.94)';

/** El tobillo se apoya un poco por encima de la estribera, no clavado en ella. */
const ANKLE_OVER_PEG: Vec2 = { x: -0.02, y: 0.1 };

export interface TwoBoneSolution {
  /** Angulo del hueso proximal, en convenio de mundo. */
  rootAngle: number;
  /** Angulo del hueso distal. */
  midAngle: number;
  /** Posicion de la articulacion intermedia (codo o rodilla). */
  joint: Vec2;
}

/**
 * Cadena de dos huesos. `bend` decide hacia que lado se dobla la articulacion:
 * +1 y -1 dan las dos soluciones simetricas del triangulo.
 *
 * Si el objetivo queda mas lejos de lo que la cadena alcanza, se apunta hacia
 * el con la cadena estirada en vez de fallar: es preferible un brazo estirado
 * al maximo a un brazo que desaparece.
 */
export function solveTwoBone(root: Vec2, target: Vec2, boneA: number, boneB: number, bend: number): TwoBoneSolution {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const rawDistance = Math.hypot(dx, dy);
  const minReach = Math.abs(boneA - boneB) + 1e-4;
  const maxReach = boneA + boneB - 1e-4;
  const distance = clamp(rawDistance, minReach, maxReach);
  const baseAngle = Math.atan2(dy, dx);

  const cosAngle = clamp((distance * distance + boneA * boneA - boneB * boneB) / (2 * distance * boneA), -1, 1);
  const rootAngle = baseAngle + bend * Math.acos(cosAngle);
  const joint = { x: root.x + Math.cos(rootAngle) * boneA, y: root.y + Math.sin(rootAngle) * boneA };
  const midAngle = Math.atan2(target.y - joint.y, target.x - joint.x);
  return { rootAngle, midAngle, joint };
}

export interface RiderRigGeometry {
  hipWorld: Vec2;
  shoulderWorld: Vec2;
  arm: TwoBoneSolution;
  leg: TwoBoneSolution;
  /** Misma cadena, resuelta para la pierna del lado lejano. */
  farLeg: TwoBoneSolution;
  farHipWorld: Vec2;
  torsoWorldAngle: number;
  /** Escala de dibujo de las piezas del piloto. */
  scale: number;
}

/**
 * Resuelve toda la postura en coordenadas de mundo a partir del estado de la
 * moto. Separado del dibujo para que se pueda probar y para que el banco de
 * ensamblaje pueda pintar los huesos por encima.
 */
export function solveRiderRig(
  bikePosition: Vec2,
  bikeAngle: number,
  rider: RiderPose,
  pixelsPerMeter: number,
): RiderRigGeometry {
  const rig = SpriteCalibration.riderRig;
  const metersPerPx = 1 / rig.pxPerMeter;

  const toWorld = (local: Vec2): Vec2 => {
    const rotated = rotateVec(local, bikeAngle);
    return { x: bikePosition.x + rotated.x, y: bikePosition.y + rotated.y };
  };

  // Cadera: punto de reposo del chasis mas la pose del jugador.
  const hipLocal: Vec2 = {
    x: RIDER_HIP_LOCAL.x + rider.shiftX,
    y: RIDER_HIP_LOCAL.y + rider.shiftY,
  };
  const hipWorld = toWorld(hipLocal);

  // El torso gira con el chasis mas su propio angulo; el hombro cuelga del
  // torso, asi que se mueve con el.
  const torsoWorldAngle = bikeAngle + rider.torsoAngle;
  const shoulderOffsetPx = {
    x: rig.torso.shoulderPx.x - rig.torso.pivotPx.x,
    y: rig.torso.shoulderPx.y - rig.torso.pivotPx.y,
  };
  // La imagen tiene Y hacia abajo; el mundo, hacia arriba.
  const shoulderLocalToTorso: Vec2 = {
    x: shoulderOffsetPx.x * metersPerPx,
    y: -shoulderOffsetPx.y * metersPerPx,
  };
  const shoulderRotated = rotateVec(shoulderLocalToTorso, torsoWorldAngle);
  const shoulderWorld = { x: hipWorld.x + shoulderRotated.x, y: hipWorld.y + shoulderRotated.y };

  const gripWorld = toWorld(HANDLEBAR_GRIP_LOCAL);
  const ankleTargetWorld = toWorld({
    x: FOOTPEG_LOCAL.x + ANKLE_OVER_PEG.x,
    y: FOOTPEG_LOCAL.y + ANKLE_OVER_PEG.y,
  });

  // El codo se dobla hacia arriba y la rodilla hacia adelante: son las dos
  // soluciones que corresponden a como se sienta una persona en una moto.
  const arm = solveTwoBone(
    shoulderWorld,
    gripWorld,
    rig.armUpper.lengthPx * metersPerPx,
    rig.armFore.lengthPx * metersPerPx,
    -1,
  );
  const leg = solveTwoBone(
    hipWorld,
    ankleTargetWorld,
    rig.thigh.lengthPx * metersPerPx,
    rig.shin.lengthPx * metersPerPx,
    1,
  );

  // Pierna del lado lejano: misma cadena, cadera y estribera corridas hacia
  // atras. Se resuelve aparte para que tambien siga la estribera al agacharse.
  const farOffsetWorld = rotateVec(FAR_LEG_OFFSET, bikeAngle);
  const farHipWorld = { x: hipWorld.x + farOffsetWorld.x, y: hipWorld.y + farOffsetWorld.y };
  const farAnkleTarget = { x: ankleTargetWorld.x + farOffsetWorld.x, y: ankleTargetWorld.y + farOffsetWorld.y };
  const farLeg = solveTwoBone(
    farHipWorld,
    farAnkleTarget,
    rig.thigh.lengthPx * metersPerPx,
    rig.shin.lengthPx * metersPerPx,
    1,
  );

  return {
    hipWorld,
    shoulderWorld,
    arm,
    leg,
    farLeg,
    farHipWorld,
    torsoWorldAngle,
    scale: pixelsPerMeter / rig.pxPerMeter,
  };
}

export interface RiderPieceDraw {
  image: HTMLImageElement;
  world: Vec2;
  angle: number;
  pivotPx: { x: number; y: number };
  /** Filtro de canvas propio de la pieza (las del lado lejano van mas oscuras). */
  filter?: string;
}

/**
 * Lista de piezas a dibujar, de atras hacia adelante: pierna del lado lejano,
 * torso, pierna cercana y brazo. El orden importa: las extremidades del lado
 * cercano tapan al torso y el torso tapa a las del lado lejano, que es como se
 * ve un piloto desde el lateral.
 */
export function riderPieceDraws(geometry: RiderRigGeometry): RiderPieceDraw[] {
  const rig = SpriteCalibration.riderRig;
  return [
    {
      image: SpriteImages.riderThigh,
      world: geometry.farHipWorld,
      angle: geometry.farLeg.rootAngle - rig.thigh.restAngle,
      pivotPx: rig.thigh.pivotPx,
      filter: FAR_LIMB_FILTER,
    },
    {
      image: SpriteImages.riderShin,
      world: geometry.farLeg.joint,
      angle: geometry.farLeg.midAngle - rig.shin.restAngle,
      pivotPx: rig.shin.pivotPx,
      filter: FAR_LIMB_FILTER,
    },
    {
      image: SpriteImages.riderTorso,
      world: geometry.hipWorld,
      angle: geometry.torsoWorldAngle,
      pivotPx: rig.torso.pivotPx,
    },
    {
      image: SpriteImages.riderThigh,
      world: geometry.hipWorld,
      angle: geometry.leg.rootAngle - rig.thigh.restAngle,
      pivotPx: rig.thigh.pivotPx,
      filter: NEAR_THIGH_FILTER,
    },
    {
      image: SpriteImages.riderShin,
      world: geometry.leg.joint,
      angle: geometry.leg.midAngle - rig.shin.restAngle,
      pivotPx: rig.shin.pivotPx,
      filter: NEAR_SHIN_FILTER,
    },
    {
      image: SpriteImages.riderArmUpper,
      world: geometry.shoulderWorld,
      angle: geometry.arm.rootAngle - rig.armUpper.restAngle,
      pivotPx: rig.armUpper.pivotPx,
      filter: NEAR_ARM_FILTER,
    },
    {
      image: SpriteImages.riderArmFore,
      world: geometry.arm.joint,
      angle: geometry.arm.midAngle - rig.armFore.restAngle,
      pivotPx: rig.armFore.pivotPx,
      filter: NEAR_ARM_FILTER,
    },
  ];
}
