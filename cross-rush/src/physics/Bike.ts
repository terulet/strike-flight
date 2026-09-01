/**
 * Bike.ts
 *
 * El chasis: masa puntual con rotacion, dos ruedas con masa no suspendida y
 * su propia suspension, y un piloto que es a la vez una masa movil y una
 * pose. Es fisica "pura": no sabe nada de flow, trucos, aterrizajes ni
 * render. Solo avanza el estado un tick fijo, sin mutar el que recibe.
 *
 * Cambios de fondo respecto al prototipo inicial, todos dirigidos a que la
 * moto deje de sentirse como un sprite rigido desplazandose sobre un perfil:
 *
 * 1. El motor NO empuja el chasis. Aplica par a la rueda trasera (ver
 *    Wheel.ts); el avance sale del rozamiento del neumatico, limitado por la
 *    carga vertical de esa rueda. De ahi el patinaje al salir y el bloqueo al
 *    frenar, y de ahi que las ruedas giren de verdad.
 * 2. Las fuerzas se aplican en la HUELLA DE CONTACTO, no en el anclaje de la
 *    horquilla. El brazo de palanca real (~1.45 m) es casi el triple del que
 *    se usaba (0.55 m): es la diferencia entre una moto que cabecea y una
 *    tabla.
 * 3. El piloto es una masa desplazable. Moverlo genera par de verdad, y
 *    agacharse/estirarse carga y descarga la suspension (preload).
 * 4. Todo el estado necesario para dibujar -angulos de rueda, compresiones,
 *    pose del piloto- vive dentro de BikeState, para que el render pueda
 *    interpolarlo entre ticks con el alpha del GameLoop.
 */

import { Terrain } from './Terrain';
import { computeSuspension, SuspensionParams } from './Suspension';
import { clamp, rotateVec, angleDelta, normalizeAngle, lerp, Vec2 } from './MathUtils';
import {
  WheelSpinState,
  cloneWheelSpinState,
  createWheelSpinState,
  lerpWheelSpinState,
  stepWheel,
} from './Wheel';
import { RiderPose, cloneRiderPose, createRiderPose, lerpRiderPose, stepRiderPose } from './RiderPose';
import { SmoothedInput } from '../input/InputSmoothing';
import {
  BikeConfig,
  EngineConfig,
  SuspensionConfig,
  AirControlConfig,
  GravityConfig,
  GroundBalanceConfig,
  WheelConfig,
  WeightTransferConfig,
} from '../config/GameConfig';

/**
 * Entrada de la fisica. Sigue aceptando los booleanos de siempre para no
 * romper tests ni fuentes de entrada existentes, pero lo que de verdad usa la
 * simulacion son los valores continuos (ver InputSmoothing.ts). Si solo
 * llegan los booleanos se convierten a 0/1.
 */
export interface BikeInput {
  throttle: boolean;
  brake: boolean;
  /** +1 = levantar el morro (peso atras / backflip), -1 = hundirlo (peso delante / frontflip). */
  lean: number;
  /** Valores continuos 0..1 / -1..1. Opcionales: si faltan se derivan de los flags. */
  smoothed?: SmoothedInput;
}

export interface WheelRuntimeState {
  compression: number;
  /** Velocidad de compresion (m/s). + = comprimiendose. Alimenta polvo y pose. */
  compressionVelocity: number;
  inContact: boolean;
  groundY: number;
  contactX: number;
  /** Carga vertical actual del neumatico (N). 0 en el aire. */
  load: number;
  /** Giro propio de la rueda: angulo, velocidad angular y deslizamiento. */
  wheel: WheelSpinState;
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
  /** Pose del piloto, integrada con la fisica para que el render la interpole. */
  rider: RiderPose;
  /** Entrada continua efectivamente aplicada este tick (para audio, HUD y pose). */
  throttleAmount: number;
  brakeAmount: number;
  leanAmount: number;
  /**
   * Segundos que el jugador lleva pidiendo el MISMO gesto de aire a fondo, con
   * signo. Se pone a cero al soltar, al cambiar de sentido o al tocar suelo.
   * De aqui sale el compromiso que permite completar un mortal (ver
   * AirControlConfig.committedRotationRate).
   */
  airControlHold: number;
}

const FRONT_SUSPENSION: SuspensionParams = { ...SuspensionConfig.front, wheelRadius: BikeConfig.wheelRadius };
const REAR_SUSPENSION: SuspensionParams = { ...SuspensionConfig.rear, wheelRadius: BikeConfig.wheelRadius };

/**
 * Tope de la fuerza de preload del piloto (N). El muelle del cuerpo es rapido
 * a proposito, y sin tope un cambio de pose brusco podria meter un pico de
 * fuerza mayor que el peso entero de la moto.
 */
const RIDER_PRELOAD_FORCE_LIMIT = 2400;

/**
 * Tope de la reaccion de giro de rueda sobre el chasis (N*m). Un aterrizaje
 * que frena la rueda de golpe puede producir un pico de dOmega/dt enorme en un
 * unico tick; sin tope, ese pico se convierte en un latigazo de cabeceo que no
 * corresponde a nada que el jugador haya hecho.
 */
const WHEEL_REACTION_TORQUE_LIMIT = 1100;

/** Altura del eje de ruedas en reposo por debajo del centro de masas, por eje. */
const FRONT_AXLE_DROP = BikeConfig.anchorDropFromCom + SuspensionConfig.front.restLength;
const REAR_AXLE_DROP = BikeConfig.anchorDropFromCom + SuspensionConfig.rear.restLength;

/**
 * Altura del centro de masas sobre el suelo con la moto en reposo (m). Es el
 * `h` de la transferencia de peso longitudinal m*a*h/L, y el numero que decide
 * lo facil que es hacer un caballito.
 */
export const COM_HEIGHT_ABOVE_GROUND = (FRONT_AXLE_DROP + REAR_AXLE_DROP) / 2 + BikeConfig.wheelRadius;

function createWheelRuntimeState(y: number, x: number): WheelRuntimeState {
  return {
    compression: 0,
    compressionVelocity: 0,
    inContact: false,
    groundY: y,
    contactX: x,
    load: 0,
    wheel: createWheelSpinState(),
  };
}

export function createInitialBikeState(x: number, y: number): BikeState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    front: createWheelRuntimeState(y, x),
    rear: createWheelRuntimeState(y, x),
    rider: createRiderPose(),
    throttleAmount: 0,
    brakeAmount: 0,
    leanAmount: 0,
    airControlHold: 0,
  };
}

function cloneWheelRuntimeState(state: WheelRuntimeState): WheelRuntimeState {
  return { ...state, wheel: cloneWheelSpinState(state.wheel) };
}

export function cloneBikeState(state: BikeState): BikeState {
  return {
    ...state,
    front: cloneWheelRuntimeState(state.front),
    rear: cloneWheelRuntimeState(state.rear),
    rider: cloneRiderPose(state.rider),
  };
}

function frontOffset(): Vec2 {
  return { x: BikeConfig.wheelBase / 2, y: -BikeConfig.anchorDropFromCom };
}

function rearOffset(): Vec2 {
  return { x: -BikeConfig.wheelBase / 2, y: -BikeConfig.anchorDropFromCom };
}

/**
 * Fuerza motriz disponible segun las vueltas de la RUEDA, no segun la
 * velocidad del chasis. Es la diferencia entre un motor y una cinta
 * transportadora: si el neumatico patina, el motor sube de vueltas y el par
 * cae, asi que el patinaje se agota solo en vez de ser infinito.
 */
function driveForceAtWheelSpeed(wheelSurfaceSpeed: number): number {
  const top = EngineConfig.topSpeed;
  const start = top * EngineConfig.torqueFalloffStart;
  const s = Math.abs(wheelSurfaceSpeed);
  if (s <= start) return EngineConfig.maxDriveForce;
  if (s >= top) return 0;
  const t = (s - start) / (top - start);
  return EngineConfig.maxDriveForce * (1 - t);
}

/** Deriva los valores continuos de la entrada, tolerando entradas solo booleanas. */
function resolveInput(input: BikeInput): { throttle: number; brake: number; lean: number } {
  if (input.smoothed) {
    return {
      throttle: clamp(input.smoothed.throttle, 0, 1),
      brake: clamp(input.smoothed.brake, 0, 1),
      lean: clamp(input.smoothed.lean, -1, 1),
    };
  }
  return {
    throttle: input.throttle ? 1 : 0,
    brake: input.brake ? 1 : 0,
    lean: clamp(Number.isFinite(input.lean) ? input.lean : 0, -1, 1),
  };
}

/**
 * Avanza el estado de la moto un paso fijo `dt`. Devuelve un nuevo estado
 * (no muta el que se le pasa), para facilitar tests deterministas.
 */
export function stepBike(state: BikeState, terrain: Terrain, input: BikeInput, dt: number): BikeState {
  const next = cloneBikeState(state);
  const cmd = resolveInput(input);

  next.throttleAmount = cmd.throttle;
  next.brakeAmount = cmd.brake;
  next.leanAmount = cmd.lean;

  // --- Gravedad ---
  next.vy -= GravityConfig.g * dt;

  const mass = BikeConfig.mass;
  const inertia = BikeConfig.inertia;
  const riderMass = mass * BikeConfig.riderMassFraction;

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

  const safeDt = dt > 1e-6 ? dt : 1 / 120;
  const frontCompressionVelocity = (frontResult.compression - state.front.compression) / safeDt;
  const rearCompressionVelocity = (rearResult.compression - state.rear.compression) / safeDt;

  // --- Pose del piloto ---
  //
  // Se resuelve ANTES que las fuerzas porque el cuerpo del piloto es una masa
  // de verdad (BikeConfig.riderMassFraction) y su movimiento genera fuerzas
  // sobre el chasis en este mismo tick. Las entradas de la pose son el estado
  // del tick anterior; ese retardo de un paso a 120 Hz no es perceptible.
  const nextRider = stepRiderPose(
    state.rider,
    {
      lean: cmd.lean,
      throttle: cmd.throttle,
      brake: cmd.brake,
      meanCompression: (state.front.compression + state.rear.compression) / 2,
      verticalSpeed: state.vy,
      angularVelocity: state.angularVelocity,
      airborne: !state.front.inContact && !state.rear.inContact,
      // Altura sobre el terreno de debajo, para que el piloto vea venir el
      // suelo y se prepare (ver RiderPose.landingPrep).
      heightAboveGround: state.y - (frontGroundY + rearGroundY) / 2,
    },
    dt,
  );
  next.rider = nextRider;

  // (a) El cuerpo del piloto pesa y se ha movido: su peso aplicado por delante
  //     o por detras del centro de masas es un par real. Adelantarse hunde el
  //     morro, echarse atras lo levanta. Esta es la agencia del jugador: no es
  //     un "modo caballito", es peso desplazado.
  const riderWorldOffset = rotateVec({ x: nextRider.shiftX, y: nextRider.shiftY }, state.angle);
  const riderWeight = -riderMass * GravityConfig.g;
  sumTorque += riderWorldOffset.x * riderWeight;

  // (b) Preload. Al agacharse, el cuerpo acelera hacia abajo respecto a la
  //     moto: para empujarlo hacia abajo el chasis tiene que sostenerlo MENOS,
  //     asi que la suspension se descarga y se extiende. Al frenar ese
  //     movimiento -o al empujar hacia abajo sobre las estriberas- pasa lo
  //     contrario y la suspension se hunde. Es exactamente el gesto de bombear
  //     antes de una rampa, y sale solo de F = -m_piloto * a_relativa, sin
  //     ningun "modo preload" artificial.
  const riderRelAccelLocalY = (nextRider.shiftYVelocity - state.rider.shiftYVelocity) / safeDt;
  const riderRelAccelWorld = rotateVec({ x: 0, y: riderRelAccelLocalY }, state.angle);
  const preloadForce: Vec2 = {
    x: clamp(-riderMass * riderRelAccelWorld.x, -RIDER_PRELOAD_FORCE_LIMIT, RIDER_PRELOAD_FORCE_LIMIT),
    y: clamp(-riderMass * riderRelAccelWorld.y, -RIDER_PRELOAD_FORCE_LIMIT, RIDER_PRELOAD_FORCE_LIMIT),
  };
  sumForceX += preloadForce.x;
  sumForceY += preloadForce.y;
  sumTorque += riderWorldOffset.x * preloadForce.y - riderWorldOffset.y * preloadForce.x;

  // (c) Transferencia longitudinal explicita: m*a_x*h/L. En un solido rigido
  //     emerge del balance de pares, pero la inercia de cabeceo esta inflada a
  //     proposito (ver BikeConfig.inertia) y se come justo el hundimiento de
  //     horquilla que hay que VER. Se aplica mas abajo, ya con la aceleracion
  //     real del tick, como carga extra/menos en cada eje.
  const previousSpeed = state.vx;

  // --- Fuerzas de suspension, aplicadas en la huella de contacto ---
  const frontContact: Vec2 = { x: frontAnchor.x, y: frontGroundY };
  const rearContact: Vec2 = { x: rearAnchor.x, y: rearGroundY };
  const frontContactOffset: Vec2 = { x: frontContact.x - state.x, y: frontContact.y - state.y };
  const rearContactOffset: Vec2 = { x: rearContact.x - state.x, y: rearContact.y - state.y };

  const frontNormal = terrain.surfaceNormal(frontAnchor.x);
  const rearNormal = terrain.surfaceNormal(rearAnchor.x);

  let frontLoad = frontResult.inContact ? frontResult.force : 0;
  let rearLoad = rearResult.inContact ? rearResult.force : 0;

  if (frontResult.inContact) {
    const fx = frontNormal.x * frontLoad;
    const fy = frontNormal.y * frontLoad;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += frontContactOffset.x * fy - frontContactOffset.y * fx;
  }
  if (rearResult.inContact) {
    const fx = rearNormal.x * rearLoad;
    const fy = rearNormal.y * rearLoad;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += rearContactOffset.x * fy - rearContactOffset.y * fx;
  }

  // --- Ruedas: par motor, freno y rozamiento ---
  const frontTangent: Vec2 = { x: frontNormal.y, y: -frontNormal.x };
  const rearTangent: Vec2 = { x: rearNormal.y, y: -rearNormal.x };

  const frontGroundSpeed = state.vx * frontTangent.x + state.vy * frontTangent.y;
  const rearGroundSpeed = state.vx * rearTangent.x + state.vy * rearTangent.y;

  const rearWheelSurfaceSpeed = state.rear.wheel.spinRate * BikeConfig.wheelRadius;
  const driveTorque =
    cmd.throttle * driveForceAtWheelSpeed(rearWheelSurfaceSpeed) * BikeConfig.wheelRadius;

  const frontBrakeTorque = cmd.brake * WheelConfig.maxBrakeTorque * WheelConfig.frontBrakeBias;
  const rearBrakeTorque = cmd.brake * WheelConfig.maxBrakeTorque * WheelConfig.rearBrakeBias;

  const frontWheelStep = stepWheel(state.front.wheel, {
    radius: BikeConfig.wheelRadius,
    normalLoad: frontLoad,
    groundSpeed: frontGroundSpeed,
    driveTorque: 0,
    brakeTorque: frontBrakeTorque,
    inContact: frontResult.inContact,
    dt,
  });
  const rearWheelStep = stepWheel(state.rear.wheel, {
    radius: BikeConfig.wheelRadius,
    normalLoad: rearLoad,
    groundSpeed: rearGroundSpeed,
    driveTorque,
    brakeTorque: rearBrakeTorque,
    inContact: rearResult.inContact,
    dt,
  });

  // La traccion/frenada del neumatico entra en el chasis por la huella de
  // contacto: brazo de palanca completo, cabeceo de verdad.
  if (frontResult.inContact) {
    const fx = frontTangent.x * frontWheelStep.tractionForce;
    const fy = frontTangent.y * frontWheelStep.tractionForce;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += frontContactOffset.x * fy - frontContactOffset.y * fx;
  }
  if (rearResult.inContact) {
    const fx = rearTangent.x * rearWheelStep.tractionForce;
    const fy = rearTangent.y * rearWheelStep.tractionForce;
    sumForceX += fx;
    sumForceY += fy;
    sumTorque += rearContactOffset.x * fy - rearContactOffset.y * fx;
  }

  // --- Reaccion de las ruedas sobre el chasis (momento angular) ---
  //
  // Acelerar una rueda cuesta par, y ese par sale del chasis: por cada
  // I*dOmega que gana la rueda, el chasis pierde el mismo momento angular en
  // sentido contrario. Faltaba, y se notaba justo donde mas importa:
  //
  // - en vuelo, dar gas hace girar la rueda trasera y por tanto LEVANTA el
  //   morro; frenar en el aire lo hunde. Es el control aereo de verdad de una
  //   moto, y sin el la unica forma de corregir un vuelo era el lean;
  // - al salir de parado, la rueda trasera embalandose refuerza el caballito,
  //   que es exactamente lo que hace una moto real.
  //
  // El signo: `spinRate` positivo es rodar hacia adelante, que en el convenio
  // de mundo (Y arriba, angulos antihorarios positivos) es giro NEGATIVO. El
  // momento angular de la rueda es por tanto -I*spinRate, y el que recibe el
  // chasis, +I*d(spinRate)/dt: embalar la rueda hacia adelante levanta el
  // morro, frenarla lo hunde.
  const wheelSpinReaction =
    (WheelConfig.inertia *
      (frontWheelStep.state.spinRate -
        state.front.wheel.spinRate +
        (rearWheelStep.state.spinRate - state.rear.wheel.spinRate))) /
    safeDt;
  sumTorque += clamp(wheelSpinReaction, -WHEEL_REACTION_TORQUE_LIMIT, WHEEL_REACTION_TORQUE_LIMIT);

  // --- Integracion lineal ---
  next.vx += (sumForceX / mass) * dt;
  next.vy += (sumForceY / mass) * dt;
  next.x += next.vx * dt;
  next.y += next.vy * dt;

  const anyGrounded = frontResult.inContact || rearResult.inContact;

  // Transferencia longitudinal explicita, calculada con la aceleracion real
  // que acaba de producirse. Solo modifica la CARGA declarada de cada eje
  // (que es lo que leen el neumatico, el polvo y el HUD), no vuelve a empujar
  // el chasis: la fuerza ya esta contada arriba.
  if (anyGrounded) {
    const axialAccel = (next.vx - previousSpeed) / safeDt;
    const transfer = clamp(
      mass * axialAccel * (COM_HEIGHT_ABOVE_GROUND / BikeConfig.wheelBase) * WeightTransferConfig.longitudinalTransferGain,
      -WeightTransferConfig.maxLongitudinalTransfer,
      WeightTransferConfig.maxLongitudinalTransfer,
    );
    if (rearResult.inContact) rearLoad = Math.max(0, rearLoad + transfer);
    if (frontResult.inContact) frontLoad = Math.max(0, frontLoad - transfer);
  }

  next.front = {
    compression: frontResult.compression,
    compressionVelocity: frontCompressionVelocity,
    inContact: frontResult.inContact,
    groundY: frontGroundY,
    contactX: frontAnchor.x,
    load: frontLoad,
    wheel: frontWheelStep.state,
  };
  next.rear = {
    compression: rearResult.compression,
    compressionVelocity: rearCompressionVelocity,
    inContact: rearResult.inContact,
    groundY: rearGroundY,
    contactX: rearAnchor.x,
    load: rearLoad,
    wheel: rearWheelStep.state,
  };

  // --- Rotacion: en el suelo, suspension + traccion + peso del piloto ya
  // generan el par. En el aire el jugador controla el "pitch" directamente. ---
  if (!anyGrounded) {
    // En vuelo el par lo ponen el cuerpo del piloto (lean) y las ruedas
    // (gas/freno via wheelSpinReaction). No hay suspension que aporte nada.
    //
    // El lean pide una VELOCIDAD de giro, no una aceleracion (ver
    // AirControlConfig). Con una salvedad importante: si la moto ya gira mas
    // rapido que lo pedido y en el mismo sentido, el control NO la frena. Eso
    // seria el juego corrigiendo por el jugador; aqui pedir "morro abajo"
    // cuando ya vas cayendo de morro simplemente no hace nada, y la rotacion
    // que traes del despegue sigue siendo tuya y hay que gestionarla.
    // Compromiso: cuanto lleva el jugador pidiendo el mismo gesto a fondo. Un
    // toque corto no cuenta; sostenerlo desbloquea el ritmo de giro alto que
    // hace posible el mortal.
    const leanDirection = Math.sign(cmd.lean);
    const sameDirection = leanDirection !== 0 && Math.sign(state.airControlHold) !== -leanDirection;
    next.airControlHold = sameDirection ? state.airControlHold + leanDirection * dt : 0;

    if (cmd.lean !== 0) {
      const held = Math.abs(next.airControlHold);
      const commitment = clamp(
        (held - AirControlConfig.commitmentDelay) / Math.max(0.001, AirControlConfig.commitmentRamp),
        0,
        1,
      );
      const rate = lerp(AirControlConfig.maxControlledRate, AirControlConfig.committedRotationRate, commitment);
      const targetRate = cmd.lean * rate;
      const alreadyBeyond =
        Math.sign(targetRate) === Math.sign(next.angularVelocity) &&
        Math.abs(next.angularVelocity) > Math.abs(targetRate);
      if (!alreadyBeyond) {
        const response = clamp(AirControlConfig.airControlResponse * dt, 0, 1);
        next.angularVelocity = lerp(next.angularVelocity, targetRate, response);
      }
    }
    next.angularVelocity += (sumTorque / inertia) * dt;
    // Soltar el mando PARA el giro. Es el gesto que le faltaba al aire: con
    // solo la amortiguacion pasiva se podia empezar un mortal pero no
    // terminarlo, porque la moto llegaba al suelo girando por encima del
    // umbral de choque por bien alineada que estuviera (ver
    // AirControlConfig.releasedAngularDamping).
    const damping =
      cmd.lean === 0 ? AirControlConfig.releasedAngularDamping : AirControlConfig.airAngularDamping;
    const dampingFactor = Math.max(0, 1 - damping * dt);
    next.angularVelocity *= dampingFactor;
  } else {
    // En el suelo no hay compromiso que acumular: cada vuelo empieza de cero.
    next.airControlHold = 0;
    next.angularVelocity += (sumTorque / inertia) * dt;
    // Ligero amortiguamiento en el suelo para que no oscile eternamente.
    next.angularVelocity *= Math.max(0, 1 - 2.0 * dt);

    // Asistencia leve al piloto (ver GroundBalanceConfig): con una sola
    // rueda apoyada -tipico caballito al acelerar a fondo- nada compensa el
    // par de la rueda trasera. Amortiguamos mas y tiramos suavemente del
    // angulo hacia la pendiente real del terreno bajo la moto. La asistencia
    // se DESACTIVA en la medida en que el jugador esta pidiendo justo ese
    // gesto con el cuerpo: si quieres caballito, la ayuda se aparta.
    const oneWheelOnly = frontResult.inContact !== rearResult.inContact;
    if (oneWheelOnly) {
      const assist = 1 - Math.min(1, Math.abs(cmd.lean));
      const n = terrain.surfaceNormal(state.x);
      const tangent = { x: n.y, y: -n.x };
      const groundAngle = Math.atan2(tangent.y, tangent.x);
      next.angularVelocity +=
        angleDelta(state.angle, groundAngle) * GroundBalanceConfig.levelingStrength * assist * dt;
      next.angularVelocity *= Math.max(0, 1 - GroundBalanceConfig.oneWheelAngularDamping * assist * dt);
    }
  }

  next.angularVelocity = clamp(
    next.angularVelocity,
    -AirControlConfig.maxAngularVelocity,
    AirControlConfig.maxAngularVelocity,
  );

  next.angle = normalizeAngle(next.angle + next.angularVelocity * dt);

  return next;
}

export function isAirborne(state: BikeState): boolean {
  return !state.front.inContact && !state.rear.inContact;
}

/**
 * Punto de anclaje (parte alta de la horquilla/basculante) de una rueda, en
 * coordenadas de mundo. Solo geometria, no fisica.
 */
export function wheelAnchorWorld(state: BikeState, side: 'front' | 'rear'): Vec2 {
  const local = side === 'front' ? frontOffset() : rearOffset();
  const world = rotateVec(local, state.angle);
  return { x: state.x + world.x, y: state.y + world.y };
}

/**
 * Centro visual de una rueda, en coordenadas de mundo: el punto de anclaje
 * desplazado a lo largo del eje de la horquilla (que rota con el chasis) una
 * distancia igual a la longitud actual del muelle (restLength - compresion).
 * Con esto el dibujo muestra de verdad el recorrido de la suspension: la
 * rueda se "mete" hacia el chasis al comprimirse en vez de quedarse fija.
 */
export function wheelVisualCenterWorld(state: BikeState, side: 'front' | 'rear'): Vec2 {
  const wheel = side === 'front' ? state.front : state.rear;
  const params = side === 'front' ? FRONT_SUSPENSION : REAR_SUSPENSION;
  const anchor = wheelAnchorWorld(state, side);
  const springLength = params.restLength - wheel.compression;
  const forkAxis = rotateVec({ x: 0, y: -1 }, state.angle);
  return { x: anchor.x + forkAxis.x * springLength, y: anchor.y + forkAxis.y * springLength };
}

/** Carga vertical de un eje normalizada: 1 = reparto estatico entre las dos ruedas. */
export function normalizedAxleLoad(state: BikeState, side: 'front' | 'rear'): number {
  const staticLoad = (BikeConfig.mass * GravityConfig.g) / 2;
  const load = side === 'front' ? state.front.load : state.rear.load;
  return staticLoad > 0 ? load / staticLoad : 0;
}

/** Revoluciones normalizadas de la rueda trasera (0..1). Es la fuente del sonido de motor. */
export function engineRpmRatio(state: BikeState): number {
  const surfaceSpeed = Math.abs(state.rear.wheel.spinRate) * BikeConfig.wheelRadius;
  return clamp(surfaceSpeed / EngineConfig.topSpeed, 0, 1);
}

function lerpWheelRuntimeState(a: WheelRuntimeState, b: WheelRuntimeState, t: number): WheelRuntimeState {
  return {
    compression: lerp(a.compression, b.compression, t),
    compressionVelocity: lerp(a.compressionVelocity, b.compressionVelocity, t),
    // El contacto es booleano: no tiene sentido interpolarlo. Se toma el
    // estado del tick de destino, que es el que ya ha ocurrido.
    inContact: t >= 0.5 ? b.inContact : a.inContact,
    groundY: lerp(a.groundY, b.groundY, t),
    contactX: lerp(a.contactX, b.contactX, t),
    load: lerp(a.load, b.load, t),
    wheel: lerpWheelSpinState(a.wheel, b.wheel, t),
  };
}

/**
 * Estado visual intermedio entre dos ticks de simulacion.
 *
 * El GameLoop entrega un `alpha` en 0..1 con la fraccion de tick pendiente; sin
 * usarlo, el render dibuja siempre el ultimo estado fijo y a 60 Hz con la
 * simulacion a 120 Hz eso son microtirones constantes: la moto avanza a
 * saltos de tamano variable segun donde caiga el frame.
 *
 * Los angulos (chasis y ruedas) se interpolan por el CAMINO CORTO: un chasis
 * que pasa de +3.10 a -3.10 rad ha girado 0.08 rad, no casi una vuelta entera.
 */
export function lerpBikeState(previous: BikeState, current: BikeState, alpha: number): BikeState {
  const t = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
  if (t <= 0) return cloneBikeState(previous);
  if (t >= 1) return cloneBikeState(current);

  return {
    x: lerp(previous.x, current.x, t),
    y: lerp(previous.y, current.y, t),
    vx: lerp(previous.vx, current.vx, t),
    vy: lerp(previous.vy, current.vy, t),
    angle: normalizeAngle(previous.angle + angleDelta(previous.angle, current.angle) * t),
    angularVelocity: lerp(previous.angularVelocity, current.angularVelocity, t),
    front: lerpWheelRuntimeState(previous.front, current.front, t),
    rear: lerpWheelRuntimeState(previous.rear, current.rear, t),
    rider: lerpRiderPose(previous.rider, current.rider, t),
    throttleAmount: lerp(previous.throttleAmount, current.throttleAmount, t),
    brakeAmount: lerp(previous.brakeAmount, current.brakeAmount, t),
    leanAmount: lerp(previous.leanAmount, current.leanAmount, t),
    // No es una magnitud visual: no tiene sentido interpolarla, y ademas el
    // render nunca la mira.
    airControlHold: current.airControlHold,
  };
}
