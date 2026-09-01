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
/**
 * Estribera en espacio local del chasis.
 *
 * Sale del arte, no de una estimacion: en `bike_body.png` la estribera cae en
 * el pixel (370, 330), y con el centro de masas en (341.7, 176.3) y la foto a
 * 347 px/m eso son (+0.08, -0.44) m. Queda a la altura del bajo del motor,
 * que es donde esta en una moto de verdad.
 *
 * Estuvo subida a -0,27 para arreglar una bota que colgaba por debajo del
 * carter, y fue un error de diagnostico: la bota colgaba porque la CADERA
 * estaba demasiado baja y la pierna salia doblada del todo, no porque la
 * estribera estuviera mal. Subirla ademas dejaba el apoyo dentro del motor,
 * a 10 cm de la cadera, y remataba de plegar la pierna.
 */
export const FOOTPEG_LOCAL: Vec2 = { x: 0.08, y: -0.44 };
/**
 * Cadera del piloto en reposo, en espacio local del chasis. Es el punto sobre
 * el que actua la pose (desplazamiento y agachado); las extremidades salen de
 * ahi y se resuelven contra los agarres.
 *
 * Es el numero que hacia que el piloto se viera "pegado" a la moto. Estuvo en
 * -0,17, o sea 20 cm por debajo del asiento: la cadera caia DENTRO del motor,
 * a 6 cm del tobillo, y con 52 cm de pierna disponible la cinematica inversa
 * no tenia mas remedio que plegarla entera. La rodilla salia a 7 grados -una
 * navaja cerrada- y el muslo, la espinilla y la bota se amontonaban en una
 * mancha sobre el carenado. No habia postura, habia bulto.
 *
 * Ahora sale de una medida, no de una estimacion: se graban las 3.167 poses
 * de una vuelta completa (desplazamiento del cuerpo y giro de torso reales) y
 * se busca el par cadera/escala que sobre ESAS poses deja la rodilla cerca de
 * los 90 grados en reposo y mantiene pegados el pie a la estribera y las manos
 * al manillar el mayor numero de fotogramas.
 *
 * Sobre la misma vuelta, antes y despues:
 *
 *   antes    rodilla 0-70 grados (mediana 37), manos FUERA del manillar en el
 *            65% de los fotogramas, hasta 19 cm
 *   ahora    rodilla 76-180 (mediana 97), manos fuera en el 2,4% (peor 5 cm) y
 *            pie fuera de la estribera en el 3,1% (peor 10 cm), y solo en el
 *            pico de extension de un salto grande
 *
 * O sea que el problema no era solo que la pierna se viera plegada: durante
 * dos tercios de la vuelta el piloto ni siquiera se agarraba al manillar.
 */
export const RIDER_HIP_LOCAL: Vec2 = { x: -0.22, y: -0.03 };

/**
 * Envolvente del ASIENTO, en espacio local del chasis: hasta donde puede
 * llegar la cadera DIBUJADA.
 *
 * Es un limite visual, distinto a proposito del limite fisico. La pose del
 * piloto mueve la cadera hasta 0,36 m adelante y atras porque ese recorrido es
 * el que genera la transferencia de peso, y esa parte es correcta y esta
 * probada. Pero DIBUJARLA entera saca al piloto del asiento: medido sobre las
 * poses del banco, en caballito fuerte la cadera se iba a x = -0,58, o sea 23
 * cm por detras del final del asiento, sentada sobre la rueda trasera.
 *
 * El limite recorta solo el dibujo. La fisica sigue recibiendo el
 * desplazamiento completo, asi que la moto se comporta igual y lo unico que
 * cambia es que el cuerpo se queda donde cabe un cuerpo.
 */
const HIP_ENVELOPE = { minX: -0.40, maxX: 0.06, minY: -0.24, maxY: 0.26 };

/**
 * Cuanto del cabeceo del chasis ARRASTRA al torso.
 *
 * Valia 1: el torso copiaba el angulo entero de la moto y el piloto giraba con
 * el carenado como una pegatina. Se veia sobre todo en caballito -el usuario
 * lo describio como "el piloto parece pegado a la moto"- porque con el morro a
 * 40 grados la cabeza se iba con el, y una persona no hace eso: mantiene la
 * vista donde va.
 *
 * Con 0,62 el cuerpo acompana claramente a la moto -sigue siendo un sistema
 * unico, que es lo que pide el mandato- pero conserva algo mas de un tercio de
 * su orientacion respecto al mundo. No es cero a proposito: un piloto
 * desacoplado del todo parece flotar al lado de la moto en vez de montado en
 * ella.
 */
const TORSO_CHASSIS_FOLLOW = 0.62;

/**
 * Margen de seguridad sobre el alcance de cada cadena: la cadera se recoloca
 * hasta que el objetivo queda a este porcentaje del alcance total. No se
 * apura al 100% porque una cadena exactamente estirada se dibuja como un palo
 * y pierde el doblez del codo o de la rodilla.
 */
const REACH_MARGIN = 0.97;

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
export const ANKLE_OVER_PEG: Vec2 = { x: -0.02, y: 0.1 };

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

/** Recorta la cadera a la envolvente del asiento, en espacio local del chasis. */
function clampToSeat(hipLocal: Vec2): Vec2 {
  return {
    x: clamp(hipLocal.x, HIP_ENVELOPE.minX, HIP_ENVELOPE.maxX),
    y: clamp(hipLocal.y, HIP_ENVELOPE.minY, HIP_ENVELOPE.maxY),
  };
}

interface ReachConstraint {
  /** Centro de la corona circular en la que tiene que caer la cadera. */
  centre: Vec2;
  /** Alcance minimo de la cadena (con la articulacion cerrada del todo). */
  min: number;
  /** Alcance maximo utilizable. */
  max: number;
}

/**
 * Coloca la cadera en el punto mas cercano al deseado que satisface TODAS las
 * restricciones de alcance.
 *
 * Cada cadena de dos huesos solo llega a su agarre si la cadera esta dentro de
 * una corona circular alrededor de el: mas cerca que el alcance maximo y mas
 * lejos que el minimo (una cadena tampoco puede plegarse por debajo de la
 * diferencia de sus huesos). Con dos cadenas son dos coronas, y la cadera
 * tiene que caer en la interseccion.
 *
 * Se resuelve proyectando alternativamente sobre una y otra. Es el metodo de
 * proyecciones alternas de toda la vida: con conjuntos convexos converge, y
 * aunque una corona no lo sea del todo, en la practica basta con una decena de
 * pasadas porque la cadera parte de un punto ya casi valido. Si aun asi no
 * convergiera, el resultado es el mejor compromiso encontrado, que sigue
 * estando mucho mas cerca de los agarres que rendirse y estirar el brazo.
 */
function solveHipPlacement(desired: Vec2, constraints: ReachConstraint[]): Vec2 {
  let hip = desired;
  for (let pass = 0; pass < 10; pass += 1) {
    let moved = false;
    for (const constraint of constraints) {
      const dx = hip.x - constraint.centre.x;
      const dy = hip.y - constraint.centre.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1e-6) {
        // Degenerado: la cadera esta justo en el centro. Se aparta hacia
        // arriba lo justo para que la direccion este definida.
        hip = { x: constraint.centre.x, y: constraint.centre.y + constraint.min };
        moved = true;
        continue;
      }
      const target = clamp(distance, constraint.min, constraint.max);
      if (Math.abs(target - distance) < 1e-5) continue;
      const scale = target / distance;
      hip = { x: constraint.centre.x + dx * scale, y: constraint.centre.y + dy * scale };
      moved = true;
    }
    if (!moved) break;
  }
  return hip;
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

  // El torso NO copia el cabeceo entero del chasis.
  //
  // Lo copiaba, y ese es el defecto que el usuario describio como "el piloto
  // parece pegado a la moto": con el morro arriba la cabeza se iba con el
  // carenado, cosa que una persona no hace. Ahora arrastra una fraccion (ver
  // TORSO_CHASSIS_FOLLOW) y el resto lo conserva respecto al mundo, asi que en
  // caballito el cuerpo acompana pero la vista se queda donde va.
  const torsoWorldAngle = bikeAngle * TORSO_CHASSIS_FOLLOW + rider.torsoAngle;

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

  const gripWorld = toWorld(HANDLEBAR_GRIP_LOCAL);
  const ankleTargetWorld = toWorld({
    x: FOOTPEG_LOCAL.x + ANKLE_OVER_PEG.x,
    y: FOOTPEG_LOCAL.y + ANKLE_OVER_PEG.y,
  });

  // Cadera DIBUJADA: la que pide la pose, recortada al asiento y despues
  // recolocada hasta que las dos cadenas alcancen sus agarres.
  //
  // Este es el arreglo de fondo del rig. Antes la cadera iba donde dijera la
  // pose y, si la mano no llegaba al manillar, la cinematica inversa se
  // rendia: estiraba el brazo del todo y lo dejaba apuntando al puno desde
  // lejos. Medido sobre el banco, en caballito fuerte la mano acababa a 29 cm
  // del manillar y el pie a 10 cm de la estribera; es literalmente lo que el
  // usuario vio como "el piloto se mueve sin acompanar a la moto".
  //
  // El orden importa: primero el asiento, porque un cuerpo fuera del asiento
  // esta mal aunque llegue a los agarres; y despues el alcance, porque
  // desconectar una mano se ve muchisimo peor que recortar el recorrido del
  // cuerpo. Es la regla que pide el mandato -limitar la cadera antes que
  // soltar la extremidad- convertida en codigo.
  const armReach = (rig.armUpper.lengthPx + rig.armFore.lengthPx) * metersPerPx;
  const armMin = Math.abs(rig.armUpper.lengthPx - rig.armFore.lengthPx) * metersPerPx;
  const legReach = (rig.thigh.lengthPx + rig.shin.lengthPx) * metersPerPx;
  const legMin = Math.abs(rig.thigh.lengthPx - rig.shin.lengthPx) * metersPerPx;

  // El hombro es un desplazamiento rigido de la cadera una vez fijado el
  // angulo del torso, asi que la restriccion del brazo tambien se puede
  // expresar sobre la CADERA: su centro es el puno menos ese desplazamiento.
  const armCentre = { x: gripWorld.x - shoulderRotated.x, y: gripWorld.y - shoulderRotated.y };

  const hipWorld = solveHipPlacement(
    toWorld(clampToSeat({ x: RIDER_HIP_LOCAL.x + rider.shiftX, y: RIDER_HIP_LOCAL.y + rider.shiftY })),
    [
      { centre: armCentre, min: armMin, max: armReach * REACH_MARGIN },
      { centre: ankleTargetWorld, min: legMin, max: legReach * REACH_MARGIN },
    ],
  );
  const shoulderWorld = { x: hipWorld.x + shoulderRotated.x, y: hipWorld.y + shoulderRotated.y };

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
