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
   * Momento de inercia de cabeceo alrededor del centro de masas (kg*m^2).
   *
   * Estuvo en 420 -unas ocho veces el de una moto real- porque con el centro
   * de masas colocado a 1.45 m del suelo cualquier valor sensato daba un
   * backflip al acelerar. Corregida la geometria (ver anchorDropFromCom), ese
   * parche sobra: 165 sigue siendo generoso frente a los ~55 reales, lo justo
   * para que el cabeceo sea lento y legible en vez de nervioso, pero ya no
   * anula la transferencia de peso ni el hundimiento de la horquilla.
   */
  inertia: 165,
  wheelBase: 1.35, // metros entre eje delantero y trasero
  /**
   * Cuanto queda el anclaje de la horquilla POR DEBAJO del centro de masas
   * (metros). Negativo = el anclaje queda por encima del centro de masas, que
   * es lo que pasa en una moto real: la parte alta de la horquilla esta a la
   * altura del manillar y el centro de masas esta abajo, en el motor.
   *
   * El valor original (+0.55) situaba el centro de masas 1.45 m sobre el
   * suelo -0.55 + el largo del muelle + el radio de la rueda-, casi el doble
   * de lo que mide una moto de cross de verdad. Dos consecuencias, y las dos
   * se notaban jugando: el chasis pivotaba visualmente alrededor de un punto
   * por encima del techo de la moto, y el brazo de palanca de la traccion era
   * tan largo que acelerar a fondo era un backflip garantizado.
   */
  anchorDropFromCom: -0.18,
  /**
   * Radio del neumatico (m). NO es un numero elegido: sale del dibujo.
   *
   * En `bike_body.png` la separacion entre ejes mide 468.4 px y el radio del
   * neumatico -medido ajustando un circulo al caucho, ver
   * assets-src/extract_wheels.py- 126.1 px. Con una distancia entre ejes de
   * 1.35 m, eso obliga a un radio de 0.363 m, o sea 0.73 m de diametro: la
   * medida de una rueda de cross de 21 pulgadas con neumatico puesto.
   *
   * Estaba en 0.28, un 77% de lo que pide el arte. Con ese valor la fisica
   * creia rodar sobre una rueda mucho mas pequena que la dibujada: la moto se
   * hundia en el suelo, el punto de contacto no caia donde toca el neumatico y
   * el giro de rueda no correspondia a la distancia recorrida a la vista.
   */
  wheelRadius: 0.3633,
  /**
   * Fraccion de la masa total que corresponde al piloto y que, por tanto,
   * puede desplazarse cuando el jugador mueve el cuerpo (ver RiderConfig).
   * El resto es moto: masa "no movible" pegada al chasis.
   */
  riderMassFraction: 0.42,
} as const;

export const EngineConfig = {
  /**
   * Fuerza motriz maxima equivalente en la rueda trasera (N). Se convierte en
   * par (F*radio) y se aplica a la RUEDA, no al chasis.
   *
   * Subida de 3200 a 4000 al pasar al modelo de neumatico: antes toda la
   * fuerza del motor llegaba intacta al suelo, y ahora una parte se va en
   * hacer patinar la rueda -que es justo lo que se queria ver-. Con 3200 la
   * salida quedaba un 23% mas lenta que la del prototipo y eso cambiaba la
   * distancia de todos los saltos de la pista. 4000 devuelve la aceleracion
   * original (0-20 m/s en ~1.2 s) conservando el patinaje.
   */
  maxDriveForce: 4000,
  /**
   * Velocidad horizontal maxima "de motor" antes de que el par caiga (m/s).
   *
   * Estaba en 34 m/s, o sea 122 km/h. Una moto de cross en circuito va a
   * 60-80 km/h, y a 34 m/s el tramo entero se cruzaba en 13 s: los obstaculos
   * pasaban borrosos, cualquier salto se iba de pantalla y no daba tiempo a
   * leer el terreno, que es de lo que va el motocross. 19 m/s son 68 km/h:
   * velocidad de circuito de verdad, y con la vista a 12.5 m de ancho el mundo
   * sigue pasando a mas de pantalla y media por segundo.
   */
  topSpeed: 19,
  /** Curva simple: el par cae linealmente al acercarse a topSpeed. */
  torqueFalloffStart: 0.6, // fraccion de topSpeed en la que empieza a caer
} as const;

export const BrakeConfig = {
  maxBrakeForce: 2600,
  /** Freno trasero: algo mas suave para permitir derrapes controlados. */
  rearBrakeFactor: 1.0,
} as const;

/**
 * Masa no suspendida: cada rueda es ahora un solido con su propio momento de
 * inercia, su angulo y su velocidad angular. El motor ya no empuja el chasis
 * directamente: aplica par a la rueda trasera, y es el neumatico -a traves
 * del rozamiento con el suelo, limitado por la carga vertical real- quien
 * convierte ese par en avance. De ahi salen el patinaje al acelerar, el
 * bloqueo al frenar y, sobre todo, que las ruedas GIREN de forma visible.
 */
export const WheelConfig = {
  /**
   * Momento de inercia de una rueda completa (llanta + neumatico), kg*m^2.
   * Para una rueda de cross de ~12 kg con la masa repartida cerca de la llanta
   * y 0.363 m de radio, I ~ 0.7*m*r^2 = 1.1. Se deja algo por encima porque
   * aqui la rueda tambien representa la inercia de la transmision.
   */
  inertia: 1.6,
  /**
   * Rigidez del acoplamiento neumatico-suelo: newtons de fuerza tangencial
   * por cada m/s de deslizamiento. Alta = el neumatico "agarra" enseguida y
   * el deslizamiento se reabsorbe rapido; demasiado alta = inestable al paso
   * de simulacion actual (ver nota de estabilidad en Wheel.ts).
   */
  slipStiffness: 900,
  /** Coeficiente de rozamiento del neumatico contra la tierra batida. */
  frictionCoefficient: 1.7,
  /** Tope de deslizamiento que se guarda en el estado (m/s), solo para lectura/HUD. */
  maxReportedSlip: 12,
  /** Rozamiento de rodadura: fuerza que frena la rueda libre, por N de carga. */
  rollingResistance: 0.014,
  /** Amortiguacion de la rueda libre en el aire (1/s). Conserva inercia, pero no eternamente. */
  airDrag: 0.22,
  /** Par de freno maximo por rueda (N*m). */
  maxBrakeTorque: 810,
  /** El freno delantero muerde mas que el trasero, como en una moto real. */
  frontBrakeBias: 1.0,
  rearBrakeBias: 0.72,
} as const;

export const SuspensionConfig = {
  front: {
    restLength: 0.62,
    /**
     * Recorrido util. Con el reparto estatico la horquilla se hunde ~0.13 m
     * (un tercio del recorrido, el sag tipico de una moto de cross), asi que
     * queda margen de sobra para que una frenada a fondo se vea hundir sin
     * llegar al tope duro. Antes el sag se comia la mitad del recorrido y
     * frenar fuerte hacia tope: la horquilla dejaba de moverse justo cuando
     * mas tiene que hablar.
     */
    maxCompression: 0.38,
    springStrength: 13000, // N/m
    /**
     * Amortiguacion (N*s/m). Alta a proposito: con el muelle mas duro y el
     * cabeceo ya sin la inercia inflada de antes, una suspension poco
     * amortiguada devuelve el golpe de una recepcion en forma de rebote y de
     * un pico de par que hace girar la moto. Amortiguada, la moto "se traga"
     * la caida, que es lo que tiene que verse.
     */
    damping: 1150,
  },
  rear: {
    restLength: 0.58,
    maxCompression: 0.40,
    springStrength: 14200,
    damping: 1250,
  },
} as const;

/**
 * Control aereo.
 *
 * El modelo anterior sumaba aceleracion angular mientras la tecla estuviera
 * pulsada. Suena razonable y es injugable: mantener la tecla medio segundo
 * -lo que tarda cualquiera en decidir- mete una rotacion de la que ya no da
 * tiempo a salir antes de tocar suelo, asi que el vuelo era balistico y el
 * aterrizaje, loteria.
 *
 * Ahora el mando pide una VELOCIDAD de giro y la moto converge a ella. El
 * jugador controla cuanto gira por segundo, no cuanto acelera, que es lo que
 * de verdad quiere decidir en el aire. Sigue habiendo que gestionar la
 * rotacion que traes del despegue -al soltar, la moto NO se autonivela, solo
 * pierde vueltas muy despacio- y sigue habiendo backflip: al ritmo maximo,
 * una vuelta entera cabe en poco mas de un segundo de vuelo.
 */
export const AirControlConfig = {
  /** Velocidad de giro (rad/s) que pide el mando a fondo. */
  maxControlledRate: 5.5,
  /** Con que rapidez se alcanza esa velocidad (1/s). Alta = respuesta inmediata. */
  airControlResponse: 8.0,
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

/**
 * Pose del piloto. El arte es un unico PNG (rider.png), asi que no hay
 * miembros articulados; lo que SI se puede hacer -y es lo que mas se nota-
 * es que el cuerpo deje de estar atornillado al asiento: se desplaza dentro
 * del espacio local del chasis y gira su propio angulo, con muelles de
 * segundo orden para que nada cambie de golpe.
 *
 * Cada numero de aqui es "cuanto responde el cuerpo a X". Las entradas son:
 * lean del jugador, gas/freno, compresion media de la suspension, velocidad
 * vertical y si esta en el aire. Ver RiderPose.ts.
 *
 * Para una pose realmente articulada haria falta trocear el piloto en
 * piezas; el inventario exacto esta documentado en docs/RIDER_RIG_ASSETS.md.
 */
export const RiderConfig = {
  /** Rotacion del torso por unidad de lean del jugador (rad). */
  leanToTorso: 0.34,
  /** Rotacion del torso al frenar / acelerar (rad). */
  brakeToTorso: 0.20,
  throttleToTorso: -0.16,
  /** El torso contrarresta el cabeceo del chasis en el aire (rad por rad/s). */
  airPitchCounter: 0.055,
  maxAirPitchCounter: 0.34,
  /**
   * Desplazamiento adelante/atras del cuerpo por unidad de lean (m).
   *
   * NEGATIVO a proposito: lean +1 es "arriba" (flecha arriba / W), que en el
   * aire levanta el morro. Para que el mismo boton haga lo mismo en el suelo,
   * el cuerpo tiene que irse HACIA ATRAS -peso detras del centro de masas,
   * morro arriba-. Con el signo positivo, la misma tecla levantaba el morro
   * en vuelo y lo hundia en el suelo.
   */
  leanToShiftX: -0.30,
  /** Desplazamiento por gas/freno (m). El freno tira al piloto sobre el manillar. */
  brakeToShiftX: 0.10,
  throttleToShiftX: -0.09,
  /** Cuanto baja el cuerpo por metro de compresion media de suspension. */
  compressionToShiftY: 0.62,
  /** Extension del cuerpo al despegar (m), proporcional a la velocidad vertical. */
  takeoffExtension: 0.016,
  maxTakeoffExtension: 0.13,
  /** Absorcion al aterrizar: metros que se hunde el cuerpo por m/s de impacto. */
  landingAbsorb: 0.012,
  maxLandingAbsorb: 0.16,
  /** Topes duros de la pose, para que nunca se despegue del asiento. */
  maxShiftX: 0.36,
  maxShiftY: 0.22,
  maxTorsoAngle: 0.62,
  /** Muelle de segundo orden del torso (mas rapido que el del cuerpo entero). */
  torsoStiffness: 190,
  torsoDampingRatio: 0.78,
} as const;

/**
 * Suavizado de entrada: los mandos son binarios (tecla pulsada / no
 * pulsada), pero la moto no debe reaccionar en escalon. Cada accion tiene
 * una rampa de subida y otra de bajada, en unidades por segundo, de modo que
 * el estado que llega a la fisica es continuo en 0..1 (o -1..1 en el lean).
 * Esto es la mitad de por que la moto ya no se siente "robotica": la otra
 * mitad es que ese valor continuo mueve el cuerpo del piloto, no un flag.
 */
export const InputSmoothingConfig = {
  throttleAttack: 7.5,
  throttleRelease: 9.0,
  brakeAttack: 12.0,
  brakeRelease: 11.0,
  /**
   * El cuerpo va suave, pero NO lento: en el aire el lean es el unico control
   * que hay, y una rampa larga se traduce en no poder corregir un cabeceo a
   * tiempo. A 16/s el mando tarda ~60 ms en llegar al tope y ~125 ms en
   * invertirse: suficiente para que no haya escalones y para que el piloto
   * llegue siempre a la correccion.
   */
  leanAttack: 16.0,
  leanRelease: 18.0,
} as const;

/**
 * Transferencia de peso. Dos mecanismos distintos y complementarios:
 *
 * 1. El piloto es una masa (BikeConfig.riderMassFraction) que se desplaza
 *    dentro de un rango acotado cuando el jugador inclina el cuerpo. Su peso
 *    aplicado fuera del centro de masas genera un par real: adelantarse
 *    hunde el morro, echarse atras lo levanta. Eso es agencia del jugador.
 *
 * 2. El "preload": el piloto tambien sube y baja. Al agacharse empuja hacia
 *    abajo (carga la suspension); al estirarse la descarga y la moto salta.
 *    Se modela como la fuerza de inercia de esa masa, m*a, con a la
 *    aceleracion vertical del cuerpo del piloto.
 *
 * 3. Un termino explicito de transferencia longitudinal, m*a_x*h/L, repartido
 *    entre ejes. En un solido rigido esto emerge solo del balance de pares,
 *    pero aqui la inercia de cabeceo esta deliberadamente inflada (ver
 *    BikeConfig.inertia) para que acelerar a fondo no sea un backflip
 *    garantizado, y esa misma inflacion se come el hundimiento de horquilla
 *    que el jugador tiene que VER al frenar. El termino explicito lo devuelve
 *    sin volver a desestabilizar el cabeceo.
 */
export const WeightTransferConfig = {
  /** Fraccion del m*a_x*h/L que se aplica de forma explicita (0..1). */
  longitudinalTransferGain: 0.55,
  /** Tope de la transferencia explicita, en N, para que nunca despegue un eje entero. */
  maxLongitudinalTransfer: 1500,
} as const;

export const GravityConfig = {
  g: 19.2, // m/s^2 - mas fuerte que la Tierra a proposito, da sensacion arcade
} as const;

/**
 * Puntas del chasis en el espacio local de la moto (x hacia adelante, y hacia
 * arriba, origen en el centro de masas). Se usan para detectar que la moto ha
 * clavado la carroceria en el suelo en vez de apoyarse en las ruedas.
 *
 * Las dos van POR ENCIMA del centro de masas, que es donde estan de verdad en
 * una moto: el guardabarros delantero y la cola quedan por encima del motor.
 * Ponerlas por debajo -que es lo primero que uno hace- convierte cualquier
 * aterrizaje que toque fondo de suspension en un crash, porque con el centro
 * de masas a 0.70 m del suelo y 0.38 m de recorrido la moto baja hasta 0.32 m
 * y cualquier punto por debajo del centro raspa. Con las puntas donde
 * corresponde, la comprobacion solo salta con la moto MUY cruzada -de morro o
 * de cola pasados los ~65 grados-, que es su unico proposito.
 */
export const ChassisGeometry = {
  /** Punta del guardabarros delantero. */
  nose: { x: 0.78, y: 0.06 },
  /** Cola / guardabarros trasero. */
  tail: { x: -0.78, y: 0.12 },
} as const;

export const CrashConfig = {
  /** Diferencia de angulo con el terreno al aterrizar que garantiza el crash (rad). */
  crashLandingAngle: 1.05, // ~60 grados
  /** Velocidad vertical de impacto que garantiza crash (m/s). */
  crashImpactSpeed: 17,
  /** Velocidad angular que provoca crash si toca el suelo girando fuerte (rad/s). */
  crashAngularVelocity: 7.0,
  /**
   * Cuanto tiempo (s) tiene que mantenerse esa velocidad angular en el suelo
   * para que cuente como trompo.
   *
   * Un aterrizaje fuerte mete un impulso de par enorme en un solo tick -la
   * suspension llega al tope y responde con una fuerza brutal aplicada en la
   * huella de contacto- y la moto puede pasar de 7 rad/s durante 8 ms sin que
   * haya pasado nada malo: al tick siguiente ya esta rodando recta. Con el
   * cabeceo mucho mas vivo que antes, exigir solo el pico convertia cualquier
   * recepcion dura en crash. Un trompo de verdad dura.
   */
  spinOutDuration: 0.14,
  /**
   * Segundos que el piloto sigue montado DESPUES de declararse el choque.
   *
   * Separar a piloto y moto en el mismo fotograma en que salta el crash se lee
   * como un fallo de ensamblaje, no como una caida: el cuerpo aparece de
   * repente en otro sitio. Manteniendolo agarrado un cuarto de segundo, primero
   * se ve el impacto y luego sale despedido, que es el orden en que ocurren las
   * cosas.
   */
  riderDetachDelay: 0.25,
  /**
   * Margen (m) por debajo del cual las puntas del chasis (ver ChassisGeometry)
   * se consideran clavadas en el terreno. Cero = tocar es chocar.
   *
   * Antes esto era un margen sobre la altura del CENTRO DE MASAS, que con la
   * geometria vieja quedaba a 1.45 m del suelo y por tanto solo saltaba en un
   * morrazo de verdad. Al bajar el centro de masas a una altura realista, el
   * mismo numero empezo a dispararse en aterrizajes perfectamente normales:
   * la moto se estrellaba sin tocar nada. Ahora se comprueba la geometria de
   * verdad -las puntas del chasis contra el plano de rodadura-, que es lo que
   * la comprobacion queria decir desde el principio.
   */
  chassisGroundMargin: 0.0,
  /**
   * Desfase minimo (rad) entre el angulo de la moto y el del plano sobre el
   * que ruedan sus ruedas para que tocar con el chasis cuente como clavarse.
   *
   * Sin esta condicion, un aterrizaje duro y BIEN ORIENTADO en una vaguada
   * -suspension a tope, moto paralela al suelo- da crash, porque con el
   * centro de masas a 0.70 m y 0.38 m de recorrido la moto baja de verdad
   * hasta rozar. Eso no es clavarse, es aterrizar fuerte. Clavarse es llegar
   * de morro o de espaldas, y eso siempre trae un desfase grande.
   */
  chassisAttitudeThreshold: 0.7,
  /**
   * Profundidad (m) de una punta del chasis por debajo del plano de rodadura
   * a partir de la cual da igual la actitud: la moto esta DENTRO del terreno.
   *
   * Cubre el caso degenerado -atravesar el suelo por un fallo numerico, un
   * teletransporte, un salto de terreno- que la comprobacion de actitud, por
   * definicion, no ve: una moto perfectamente nivelada tres metros bajo tierra
   * tiene desfase cero. Medido sobre recorridos completos, la punta mas
   * hundida en un aterrizaje legitimo llega a 0.26 m, asi que 0.45 deja margen
   * de sobra sin dejar pasar el caso que importa.
   */
  chassisDeepPenetration: 0.45,
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
  /** Seguimiento vertical: mas lento que el horizontal, para no marear. */
  verticalSmoothing: 4.2,
  lookAheadDistance: 3.6, // metros, escalado por velocidad
  lookAheadSpeedFactor: 0.24,
  /** El sentido del look-ahead se suaviza: sin esto, un rebote con vx≈0 lo hace saltar de lado a lado. */
  facingSmoothing: 3.0,
  /**
   * Zona muerta vertical (metros): mientras la moto se mueva dentro de esta
   * banda alrededor del objetivo, la camara no la persigue. Absorbe los
   * baches pequenos -whoops, rockgarden- sin que la imagen tiemble.
   */
  verticalDeadZone: 0.42,
  /**
   * Cuanto se sube el objetivo por encima de la moto (m). Deja la moto
   * ligeramente por debajo del centro, que es donde tiene que estar en un
   * lateral: se ve mas terreno por delante y por arriba, que es a donde se
   * mira cuando saltas.
   */
  verticalLead: 0.55,
  landingImpulse: 0.35,
  crashImpulse: 0.9,
  impulseDecay: 8,
  /**
   * El shake ya no es Math.random() por frame (eso es vibracion digital, no
   * un golpe). Es una onda amortiguada: dos frecuencias en cuadratura, fase
   * derivada del tiempo de simulacion, envolvente exponencial. Determinista:
   * el mismo instante de simulacion da siempre la misma sacudida, asi que
   * interpola bien y no parpadea entre frames de render.
   */
  shake: {
    /** Frecuencia principal de la sacudida (Hz). */
    primaryHz: 17,
    /** Segunda frecuencia, deliberadamente no armonica, para que no suene a motor. */
    secondaryHz: 26.5,
    secondaryWeight: 0.42,
    /** Relacion de amplitud vertical respecto a la horizontal. */
    verticalRatio: 1.35,
    /** Amplitud maxima en metros con impulso 1. */
    amplitudeMeters: 0.36,
  },
  /**
   * Zoom de referencia (px por metro) cuando no se conoce el ancho del lienzo
   * -tests, arranque-. En cuanto el renderer informa del ancho real, manda
   * `referenceViewMeters`.
   */
  baseZoomPixelsPerMeter: 34,
  /**
   * Metros de pista visibles a lo ancho de la pantalla.
   *
   * De aqui sale el tamano de la moto en pantalla, que es un requisito
   * explicito: 14-18% del ancho en escritorio. La moto mide 2.0 m de punta a
   * punta, asi que 12.5 m visibles la dejan en el 16%.
   *
   * El zoom fijo de 34 px/m que habia antes la dejaba en un 5%. A ese tamano,
   * un hundimiento de horquilla de 13 cm son 4 pixeles y el cuerpo del piloto
   * se mueve 10: todo el trabajo de suspension, pose y transferencia de peso
   * queda por debajo de lo que el ojo distingue mientras juega.
   */
  referenceViewMeters: 12.5,
  /**
   * Metros visibles en una pantalla muy alta (movil en vertical).
   *
   * En 393x852 el ancho es el lado corto, asi que mantener 19 m a lo ancho
   * deja la moto en unos 43 px de CSS mientras sobran mas de 30 m de altura
   * que nadie mira. Encuadrando mas cerca en vertical, la moto vuelve a
   * leerse sin perder de vista el terreno que viene.
   *
   * 9 m deja la moto en el 15% del ancho, centrado en la banda que pide el
   * mandato. Cerrar mas el zoom NO arregla el muro de tierra: la fraccion de
   * pantalla que ocupa el suelo no depende del zoom -al acercar, el mundo
   * visible encoge por arriba y por abajo a la vez-, sino de donde se coloca
   * la moto en la pantalla. De eso se ocupa `portraitBikeScreenFraction`.
   */
  portraitViewMeters: 9,
  /**
   * Altura de pantalla, en fraccion desde arriba, a la que se coloca la moto
   * cuando el movil esta en vertical.
   *
   * En 393x852 caben unos 19 m de mundo a lo alto. Con la moto centrada, la
   * mitad de abajo -casi 10 m- es tierra: un muro marron que se come media
   * pantalla y no aporta nada, porque lo que hay que ver es lo que VIENE, no
   * lo que hay diez metros bajo las ruedas. Bajando la moto a dos tercios de
   * la altura, ese espacio pasa al cielo y al horizonte, que si dicen algo.
   *
   * En horizontal no aplica: alli la altura no sobra y la moto se queda
   * centrada con el adelanto normal (`verticalLead`).
   */
  portraitBikeScreenFraction: 0.74,
  /**
   * Umbrales de forma de pantalla para mezclar el encuadre vertical con el
   * horizontal: en `portraitAspect` o menos manda el encuadre vertical del
   * todo, en `landscapeAspect` o mas el horizontal, y en medio se interpola.
   *
   * Antes habia un solo umbral y la mezcla era `aspect / 0.75`. Un movil en
   * vertical tiene aspecto 0,46, asi que salia una mezcla de 0,61: el juego
   * consideraba una pantalla de telefono un 61% HORIZONTAL. El resultado era
   * que ni encuadraba de cerca -la moto se quedaba en el 12% del ancho,
   * por debajo del minimo del mandato- ni bajaba la moto en pantalla, y
   * cambiar `portraitViewMeters` apenas movia nada porque su efecto se
   * diluia en la mezcla.
   */
  portraitAspect: 0.6,
  landscapeAspect: 1.1,
  /** Topes de seguridad para pantallas extremas. */
  minPixelsPerMeter: 40,
  maxPixelsPerMeter: 190,
  /** Airtime (s) a partir del cual empieza a alejar la camara. */
  // Un salto grande dura poco mas de un segundo entero. Con el arranque en
  // 0,35 s y el maximo en 1,3 la camara no llegaba ni a la mitad de su
  // apertura antes de que la moto ya estuviera aterrizando: en la practica el
  // zoom-out no existia. Ahora abre en el primer tercio del vuelo.
  zoomOutAirtimeStart: 0.18,
  zoomOutAirtimeFull: 0.65,
  /**
   * Zoom-out en vuelo. Con la vista mucho mas cerrada que antes, un salto
   * grande se sale de pantalla si la camara no abre: a 0.62 se pasa de 12.5 a
   * 20 m visibles, suficiente para ver la caida entera sin que la moto deje de
   * leerse.
   */
  maxZoomOutFactor: 0.62, // multiplicador aplicado a pixelsPerMeter
  /**
   * Segundos de vuelo a partir de los cuales la camara empieza a encuadrar
   * TAMBIEN el suelo que hay debajo, y en cuantos llega a hacerlo del todo.
   *
   * Abrir el zoom no basta: aleja por igual arriba y abajo, y el problema de
   * un salto grande es asimetrico -sobra cielo y falta suelo-. Bajando el
   * centro de camara hacia el punto medio entre la moto y el terreno, la
   * caida entra en cuadro sin tener que alejarse tanto como para que la moto
   * deje de leerse.
   */
  flightFramingAirTime: 0.4,
  flightFramingFull: 1,
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
    /**
     * El motor ya no sigue a `vx`. Sigue a las revoluciones REALES de la
     * rueda trasera (omega*R / topSpeed), asi que sube de vueltas cuando
     * patina parado y baja cuando el neumatico se bloquea, que es lo que
     * hace un motor de verdad. El gas y la carga solo mueven el timbre y el
     * volumen, no el tono.
     */
    baseFrequency: 58,
    maxFrequency: 246,
    baseGain: 0.045,
    maxGain: 0.165,
    /** Segundo oscilador desafinado: da cuerpo, evita el pitido de sierra puro. */
    detuneRatio: 1.006,
    detuneGain: 0.55,
    /** Cuanto sube el tono el gas por encima de las vueltas puras (0..1). */
    throttleLift: 0.16,
    /** Cuanto abre el filtro/volumen la carga del motor (subir cuestas, arrancar). */
    loadGain: 0.35,
    /** Constante de tiempo del seguimiento de frecuencia (s). Baja = respuesta viva. */
    frequencyGlide: 0.035,
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
  /**
   * Polvo y marcas de derrape ligados al deslizamiento REAL del neumatico
   * (ver Wheel.ts), no a la velocidad del chasis: si la rueda patina parado,
   * sale tierra; si rueda limpia a 30 m/s, no.
   */
  slip: {
    /** Deslizamiento (m/s) a partir del cual empieza a saltar tierra. */
    minSlipToSpawn: 1.1,
    /** Deslizamiento que produce el chorro maximo. */
    fullSlip: 5.0,
    /** Particulas por segundo con deslizamiento maximo. */
    maxParticlesPerSecond: 90,
    /** Deslizamiento a partir del cual se deja una marca de derrape en el suelo. */
    skidMarkSlip: 3.4,
    /** Tiempo minimo entre marcas de derrape (s). */
    skidMarkInterval: 0.11,
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

/**
 * Salida de carrera. La cuenta atras deja de ser tres numeros sobre una moto
 * congelada: la moto se posa en la parrilla mientras corre, y al "GO!" recibe
 * un golpe de suspension para que el arranque se NOTE.
 */
export const RaceStartConfig = {
  /**
   * Impulso vertical hacia abajo aplicado al chasis en el instante de salida
   * (m/s). Hunde los dos muelles de golpe y el rebote sale solo de la propia
   * suspension, asi que es una reaccion real y no una animacion pegada.
   * Pequeno a proposito: 1,1 m/s comprime de forma bien visible sin llegar a
   * tocar el tope ni robar agarre en el primer metro.
   */
  launchDip: 1.1,
  /** Particulas de tierra que levanta la salida, por rueda. */
  launchDustParticles: 14,
} as const;

/**
 * Espectaculo: camara lenta en los vuelos grandes y premios.
 *
 * La camara lenta no toca la fisica. El bucle sigue dando pasos de `SIM_DT`
 * exactos; lo unico que cambia es cuanto tiempo real se le entrega por
 * fotograma (ver GameLoop.setTimeScale). Consecuencia importante: el crono de
 * vuelta cuenta segundos SIMULADOS, asi que los tiempos siguen siendo
 * comparables aunque el jugador pase medio salto a camara lenta.
 */
export const SpectacleConfig = {
  /** Segundos en el aire a partir de los cuales entra la camara lenta. */
  slowMotionAirTime: 0.72,
  /** Escala de tiempo durante el vuelo grande (1 = tiempo real). */
  slowMotionScale: 0.45,
  /** Velocidad de entrada y de salida del efecto (1/s). Salir mas rapido que entrar evita el "chicle" al aterrizar. */
  slowMotionBlendIn: 5,
  slowMotionBlendOut: 9,
  /** Puntos de los premios de las piezas de riesgo/recompensa. */
  awardPoints: {
    speedPad: 150,
    flowRing: 400,
    riskGap: 600,
    bigAir: 250,
  },
  /** Segundos de vuelo a partir de los cuales el aterrizaje cuenta como "vuelo grande". */
  bigAirSeconds: 1,
} as const;
