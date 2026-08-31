/**
 * GameConfig.ts
 *
 * Toda constante ajustable del juego vive aqui, agrupada por sistema.
 * Nada de "magic numbers" sueltos en physics/gameplay: si hay que tocar la
 * sensacion de conduccion, se toca aqui.
 */

export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;
export const MAX_CATCHUP_STEPS = 10; // guarda anti "espiral de la muerte"

export const BikeConfig = {
  mass: 180, // kg (aprox. moto + piloto)
  /**
   * Momento de inercia alrededor del centro de masas (kg*m^2). Deliberadamente
   * mucho mas alto que el de una moto real: con el par de traccion maximo
   * aplicado en la rueda trasera (ver EngineConfig.maxDriveForce), un valor
   * "realista" produce una aceleracion angular tan violenta que acelerar a
   * fondo desde parado da un backflip involuntario en poco mas de un segundo
   * (visto y medido en tests/_debug durante el tuning). Subirlo es lo que
   * convierte ese caballito en algo que el jugador puede sentir y corregir
   * en vez de un crash garantizado con solo pulsar GAS.
   */
  inertia: 420,
  wheelBase: 1.35, // metros entre eje delantero y trasero
  /** Altura del centro de masas sobre el eje de las ruedas, en reposo. */
  comHeight: 0.55,
  wheelRadius: 0.28,
} as const;

export const EngineConfig = {
  /** Fuerza motriz maxima aplicada en la rueda trasera cuando hay contacto (N). */
  maxDriveForce: 3200,
  /** Velocidad horizontal maxima "de motor" antes de que el par caiga (m/s). */
  topSpeed: 34,
  /** Curva simple: el par cae linealmente al acercarse a topSpeed. */
  torqueFalloffStart: 0.6, // fraccion de topSpeed en la que empieza a caer
} as const;

export const BrakeConfig = {
  maxBrakeForce: 2600,
  /** Freno trasero: algo mas suave para permitir derrapes controlados. */
  rearBrakeFactor: 1.0,
} as const;

export const SuspensionConfig = {
  front: {
    restLength: 0.62,
    maxCompression: 0.34,
    springStrength: 9200, // N/m
    damping: 620, // N*s/m
  },
  rear: {
    restLength: 0.58,
    maxCompression: 0.36,
    springStrength: 10200,
    damping: 680,
  },
} as const;

export const AirControlConfig = {
  /** Aceleracion angular aplicada por input en el aire (rad/s^2). */
  airControlStrength: 7.5,
  /** Factor de amortiguacion angular en el aire (1/s), evita giros infinitos. */
  airAngularDamping: 0.35,
  /** Tope duro de velocidad angular (rad/s). */
  maxAngularVelocity: 9.0,
} as const;

/**
 * Asistencia leve al piloto en el suelo (brief seccion 6): con solo una rueda
 * apoyada -tipico de acelerar a fondo desde parado, "caballito"- el par de
 * traccion aplicado en la rueda trasera no tiene nada que lo compense y el
 * chasis puede entrar en un giro hacia atras que no hay forma de frenar,
 * provocando un crash instantaneo en la recta inicial. Un piloto real
 * corrige esto con el cuerpo; aqui lo aproximamos con un amortiguamiento
 * extra y una ligera tendencia a nivelarse mientras solo hay una rueda en
 * contacto, sin tocarle nada al control aereo real (ver AirControlConfig).
 */
export const GroundBalanceConfig = {
  /** Amortiguamiento angular extra (1/s) cuando solo una rueda toca el suelo. */
  oneWheelAngularDamping: 8.0,
  /** Fuerza (rad/s^2 por radian de inclinacion) que tira del chasis hacia el nivel del suelo. */
  levelingStrength: 1.2,
} as const;

export const GravityConfig = {
  g: 19.2, // m/s^2 - mas fuerte que la Tierra a proposito, da sensacion arcade
} as const;

export const CrashConfig = {
  /** Diferencia de angulo con el terreno al aterrizar que garantiza el crash (rad). */
  crashLandingAngle: 1.05, // ~60 grados
  /** Velocidad vertical de impacto que garantiza crash (m/s). */
  crashImpactSpeed: 17,
  /** Velocidad angular que provoca crash si toca el suelo girando fuerte (rad/s). */
  crashAngularVelocity: 7.0,
  /** Si el chasis (no las ruedas) toca el suelo, crash instantaneo. */
  chassisGroundMargin: 0.16, // metros de margen entre chasis y terreno
} as const;

export const LandingConfig = {
  perfect: { angle: 0.09, verticalSpeed: 6, contactTimingGap: 0.05 },
  good: { angle: 0.22, verticalSpeed: 10, contactTimingGap: 0.12 },
  rough: { angle: 0.45, verticalSpeed: 13.5, contactTimingGap: 0.22 },
  bad: { angle: 0.75, verticalSpeed: 15.5, contactTimingGap: 0.35 },
  // Por encima de "bad" en cualquier eje, o por encima de crash config -> CRASH.
} as const;

export const FlowConfig = {
  max: 100,
  min: 0,
  /** Ganancia por segundo mientras se conduce rapido y con las ruedas en el suelo. */
  gainGroundedFast: 6,
  /** Umbral de velocidad horizontal para considerar "rapido" (m/s). */
  fastSpeedThreshold: 12,
  /** Ganancia por segundo mientras se controla el aire (rotando a proposito). */
  gainAirControl: 8,
  landingBonus: {
    PERFECT: 22,
    GOOD: 10,
    ROUGH: -6,
    BAD: -18,
    CRASH: -100, // vacia el flow
  },
  trickBonus: 18,
  /** Perdida pasiva por segundo cuando no se hace nada especial. */
  passiveDecay: 1.5,
  redlineThreshold: 100,
  redlineBoostMultiplier: 1.18,
  redlineDurationSeconds: 3.5,
  redlineScoreMultiplier: 2.0,
} as const;

export const TrickConfig = {
  /** Rotacion acumulada minima para contar un flip completo (radianes). */
  fullRotation: Math.PI * 2,
  /** Tolerancia: a partir de este porcentaje de una vuelta ya cuenta. */
  minRotationForTrick: Math.PI * 2 * 0.92,
} as const;

export const CameraConfig = {
  smoothing: 6.5, // por segundo, mayor = sigue mas rapido
  lookAheadDistance: 3.2, // metros, escalado por velocidad
  lookAheadSpeedFactor: 0.18,
  landingImpulse: 0.35,
  crashImpulse: 0.9,
  impulseDecay: 8,
  baseZoomPixelsPerMeter: 34,
  /** Airtime (s) a partir del cual empieza a alejar la camara. */
  zoomOutAirtimeStart: 0.5,
  zoomOutAirtimeFull: 1.6,
  maxZoomOutFactor: 0.72, // multiplicador aplicado a pixelsPerMeter
} as const;

export const TrackConfig = {
  name: 'Canyon Run',
  /** Longitud total aproximada en metros. */
  totalLength: 780,
  finishLineX: 760,
  /** x de arranque del jugador. */
  startX: 4,
  startYOffset: 2.2,
  sectorMarkers: [0, 260, 520, 760],
} as const;

export const AudioConfig = {
  masterVolume: 0.55,
  engine: {
    baseFrequency: 60,
    maxFrequency: 240,
    baseGain: 0.05,
    maxGain: 0.16,
  },
  landing: { gain: 0.22 },
  crash: { gain: 0.32 },
} as const;

export const EffectsConfig = {
  dust: {
    maxParticles: 220,
    spawnPerContactTick: 0.6, // particulas por tick con contacto rapido
    minSpeedToSpawn: 3,
    life: 0.6,
    gravity: 6,
  },
  landingBurst: {
    count: 14,
  },
} as const;

export const InputActionKeys = {
  throttle: ['ArrowRight', 'KeyD'],
  brake: ['ArrowLeft', 'KeyA'],
  leanForward: ['ArrowUp', 'KeyW'],
  leanBack: ['ArrowDown', 'KeyS'],
  restart: ['KeyR', 'Space'],
} as const;

export const StorageKeys = {
  bestTime: 'cross-rush:best-time',
  bestGhost: 'cross-rush:best-ghost',
} as const;

export const GhostConfig = {
  /** Cada cuantos segundos se muestrea la posicion para el fantasma. */
  sampleInterval: 1 / 20,
} as const;

/**
 * Piezas de riesgo/recompensa (ver GameplayZones.ts): a diferencia de la
 * decoracion, estas SI alteran la fisica o la puntuacion al pasar por
 * encima/a traves de ellas. Colocadas por sector con intencion de diseno,
 * nunca al azar.
 */
export const GameplayZoneConfig = {
  speedPad: {
    /** Empuje instantaneo de velocidad horizontal al pisarlo (m/s). */
    boostVx: 6,
    flowBonus: 8,
  },
  riskGap: {
    /** Bonus de FLOW por saltar el hueco entero en vez de la linea segura corta. */
    flowBonus: 16,
  },
  flowRing: {
    flowBonus: 20,
    /** Extiende el REDLINE en curso, o concede un empujon si aun no estaba activo. */
    redlineExtendSeconds: 1.5,
  },
} as const;
