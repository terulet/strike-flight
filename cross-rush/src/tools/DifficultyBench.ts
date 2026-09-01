/**
 * DifficultyBench.ts
 *
 * Banco de dificultad: mide si una mision exige habilidad de verdad y si sus
 * obstaculos son superables de forma justa.
 *
 * Por que existe: la dificultad era lo unico del juego que nadie estaba
 * midiendo. Se decidia por la impresion de quien miraba, y la impresion se
 * equivoca -la primera medida seria de este proyecto encontro que un piloto
 * competente llegaba a meta a nueve decimas de uno perfecto, o sea que jugar
 * bien no servia de nada, cosa que nadie habia notado a ojo-.
 *
 * COMO CONDUCEN LOS PILOTOS
 *
 * Por las mismas entradas publicas que un jugador: gas, freno, inclinar
 * adelante o atras, turbo y reiniciar. Nada mas. En concreto NO se teletransporta
 * la moto, no se tocan colisiones ni gravedad, no se regala velocidad, no se
 * cambia la pista segun el piloto, no se reproduce una trayectoria grabada y no
 * se marca un aterrizaje como bueno sin que ocurra. Un banco que hace trampas
 * mide su propia trampa.
 *
 * QUE DISTINGUE A UN PILOTO DE OTRO
 *
 * No son "el mismo con los numeros mas altos". Se diferencian en las tres
 * cosas que de verdad separan a un jugador bueno de uno malo en un juego de
 * motocross lateral -mirar adelante, reaccionar rapido y decidir cuando gastar
 * el turbo- y en la ESTRATEGIA: el competente conduce a la defensiva y frena
 * ante el riesgo; el perfecto anticipa el cabeceo, apura y guarda el turbo
 * para donde renta.
 *
 * DETERMINISMO
 *
 * La simulacion es determinista, asi que dos carreras identicas dan el mismo
 * resultado exacto. La variacion entre intentos la introduce la SEMILLA, y solo
 * afecta al piloto: le mueve el momento de reaccion y le mete un pequeno error
 * de punteria, que es lo que cambia entre dos intentos de una misma persona. El
 * mundo no cambia nunca, y por eso una tasa de finalizacion significa algo.
 */

import { BikeState, isAirborne } from '../physics/Bike';
import { RaceManager } from '../gameplay/RaceManager';
import { SIM_DT } from '../config/GameConfig';
import { LandingQuality } from '../gameplay/types';
import { TrackDefinition } from '../tracks/CanyonRun';

export type PilotSkill = 'descuidado' | 'competente' | 'perfecto';

export interface LandingRecord {
  /** Error angular contra la pendiente en el instante del contacto (rad). */
  angleError: number;
  /** Velocidad de impacto contra el plano del suelo (m/s). */
  impactSpeed: number;
  quality: LandingQuality;
  x: number;
}

export interface BenchRun {
  mission: string;
  skill: PilotSkill;
  seed: number;
  finished: boolean;
  /** Estado final: FINISHED o CRASHED. */
  state: string;
  timeSeconds: number;
  /** Indice del ultimo sector alcanzado y tiempo de cada uno completado. */
  sectorReached: number;
  sectorTimes: number[];
  restarts: number;
  landings: Record<LandingQuality, number>;
  landingDetail: LandingRecord[];
  bestCombo: number;
  maxFlow: number;
  finalFlow: number;
  boostsUsed: number;
  /** Si cruzo el hueco de riesgo por la linea rapida en vez de caer dentro. */
  tookRushLine: boolean;
  distance: number;
  /** Por que fallo, si fallo. */
  failure: string | null;
}

interface PilotProfile {
  /** Segundos entre decisiones de aire. Un humano no corrige cada 8 ms. */
  reactionDelay: number;
  /** Zona muerta del mando: por debajo de esto no toca nada. */
  deadzone: number;
  /** Cuanto mira hacia adelante al elegir el angulo, en segundos de vuelo. */
  lookAhead: number;
  /** Error sistematico de punteria (rad). */
  aimBias: number;
  /** Ruido de punteria que la semilla modula (rad). */
  aimNoise: number;
  /**
   * Levanta el pie en las bajadas fuertes.
   *
   * Se mide la pendiente que la moto tiene DEBAJO, no la altura del terreno
   * que viene. La primera version miraba hacia adelante y frenaba si el suelo
   * bajaba mas de 2,6 m: eso hacia que frenara justo antes de la rampa de la
   * linea de riesgo -porque detras de la rampa hay un hueco- y se metiera
   * dentro. Frenar ante una rampa de despegue no es prudencia, es no saber
   * leer el terreno.
   */
  brakesOnDescent: boolean;
  /** Politica de turbo. Es una de las tres cosas que separan a los perfiles. */
  boost: 'nunca' | 'conservador' | 'guardaParaElSalto';
  /**
   * Si prefiere RODAR los huecos que se pueden rodar en vez de saltarlos.
   *
   * Es la "linea segura" del mandato, y es una decision de estrategia, no un
   * numero mas bajo: ante un hueco estrecho el prudente levanta el pie y lo
   * baja rodando, mientras que el rapido se compromete y lo cruza por el aire.
   * Sin esto el piloto competente entraba a todos los huecos a fondo y se
   * dejaba la mitad de las carreras en el de la linea de riesgo.
   */
  rollsRollableGaps: boolean;
}

/**
 * Los tres perfiles.
 *
 * El descuidado no es "torpe" por tener peores numeros: es que NO MIRA hacia
 * adelante (lookAhead 0) ni usa el turbo. Es el jugador que aun no ha entendido
 * que en el aire hay que hacer algo, y por eso falla de una forma reconocible
 * en vez de fallar en todas partes por igual.
 */
const PROFILES: Record<PilotSkill, PilotProfile> = {
  descuidado: {
    reactionDelay: 0.34,
    deadzone: 0.9,
    lookAhead: 0,
    aimBias: 0.18,
    aimNoise: 0.12,
    brakesOnDescent: false,
    boost: 'nunca',
    rollsRollableGaps: false,
  },
  competente: {
    // Calibrado por barrido, no a ojo: con la zona muerta en 0,5 el competente
    // terminaba el 38% de las carreras y con 0,4 el 63%. Por debajo de 0,32
    // vuelve a bajar, porque corregir demasiado en un vuelo corto es tan malo
    // como no corregir. Se queda en el mejor punto del barrido.
    reactionDelay: 0.16,
    deadzone: 0.4,
    lookAhead: 0.3,
    aimBias: 0.06,
    aimNoise: 0.05,
    brakesOnDescent: true,
    boost: 'conservador',
    rollsRollableGaps: true,
  },
  perfecto: {
    reactionDelay: 0,
    deadzone: 0.22,
    lookAhead: 0.36,
    aimBias: 0,
    aimNoise: 0,
    brakesOnDescent: false,
    boost: 'guardaParaElSalto',
    rollsRollableGaps: false,
  },
};

/** PRNG deterministico y barato (mulberry32). La semilla solo mueve al piloto. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Error angular contra la pendiente que la moto tiene debajo. */
function angleErrorAgainstGround(bike: BikeState, track: TrackDefinition): number {
  const slope = Math.atan(track.terrain.surfaceSlope(bike.x));
  let delta = bike.angle - slope;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

/** Velocidad de impacto perpendicular al suelo, igual que la usa el juego. */
function impactSpeedAgainstGround(bike: BikeState, track: TrackDefinition): number {
  const slope = track.terrain.surfaceSlope(bike.x);
  return Math.abs((-slope * bike.vx + bike.vy) / Math.hypot(1, slope));
}

export interface BenchOptions {
  /** Nombre de la mision, para el informe. */
  mission?: string;
  /** Segundos maximos antes de dar la carrera por colgada. */
  maxSeconds?: number;
  /** Reintentos permitidos tras un choque (0 = ninguno). */
  allowedRestarts?: number;
}

export function runBenchRace(
  track: TrackDefinition,
  skill: PilotSkill,
  seed = 1,
  options: BenchOptions = {},
): BenchRun {
  const profile = PROFILES[skill];
  const mission = options.mission ?? 'M01';
  const maxSeconds = options.maxSeconds ?? 180;
  const allowedRestarts = options.allowedRestarts ?? 0;
  const random = makeRandom(seed);

  const landings: Record<LandingQuality, number> = { PERFECT: 0, GOOD: 0, ROUGH: 0, BAD: 0, CRASH: 0 };
  const landingDetail: LandingRecord[] = [];
  let boostsUsed = 0;
  let tookRushLine = false;

  const race = new RaceManager(
    track,
    {
      onLanding: (event) => {
        landings[event.quality] += 1;
        landingDetail.push({
          angleError: angleErrorAgainstGround(race.bike, track),
          impactSpeed: impactSpeedAgainstGround(race.bike, track),
          quality: event.quality,
          x: race.bike.x,
        });
      },
      onBoost: () => { boostsUsed += 1; },
      onRiskGapCleared: () => { tookRushLine = true; },
    },
    // El banco NO persiste nada: ni lee el record del jugador ni lo escribe.
    { missionId: mission, scope: 'qa', store: false },
  );

  let restarts = 0;
  let maxFlow = 0;
  let startX = 0;

  const conducir = (): void => {
    race.begin();
    while (race.state === 'COUNTDOWN') {
      race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });
    }
    startX = race.bike.x;
    let lean = 0;
    let sinceDecision = profile.reactionDelay;

    while (race.state === 'RACING' && race.raceTime < maxSeconds && race.bike.x < track.finishX) {
      const bike = race.bike;
      sinceDecision += SIM_DT;
      if (sinceDecision >= profile.reactionDelay) {
        sinceDecision = 0;
        lean = 0;
        if (isAirborne(bike) && profile.lookAhead > 0) {
          // Mirar adelante: apuntar el morro a la pendiente que se viene, a la
          // distancia que da la velocidad. Es lo que hace un jugador que sabe.
          const ahead = Math.max(2, Math.abs(bike.vx) * profile.lookAhead);
          const noise = profile.aimNoise > 0 ? (random() - 0.5) * 2 * profile.aimNoise : 0;
          const target = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) + profile.aimBias + noise;
          let delta = target - bike.angle;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta <= -Math.PI) delta += Math.PI * 2;
          const want = delta * 2.2 - bike.angularVelocity * 0.42;
          lean = want > profile.deadzone ? 1 : want < -profile.deadzone ? -1 : 0;
        }
      }

      // Freno defensivo: el competente levanta el pie en las bajadas fuertes.
      // Es su estrategia, no un numero mas bajo.
      let brake = false;
      if (!isAirborne(bike) && bike.vx > 12) {
        if (profile.brakesOnDescent && shouldLiftOff(track, bike.x, bike.vx)) brake = true;
        if (profile.rollsRollableGaps && approachingRollableGap(track, bike.x)) brake = true;
      }

      const boostPressed = decideBoost(profile, race, track);
      race.step(SIM_DT, { throttle: !brake, brake, lean, restartPressed: false, boostPressed });
      maxFlow = Math.max(maxFlow, race.flow.value);
    }
  };

  conducir();
  while (race.state === 'CRASHED' && restarts < allowedRestarts) {
    restarts += 1;
    race.restart();
    conducir();
  }

  const sectorTimes = race.sectorSplits.map((split) => split.sectorTime);
  return {
    mission,
    skill,
    seed,
    finished: race.state === 'FINISHED',
    state: race.state,
    timeSeconds: race.raceTime,
    sectorReached: sectorTimes.length,
    sectorTimes,
    restarts,
    landings,
    landingDetail,
    bestCombo: race.combo.bestLinks,
    maxFlow,
    finalFlow: race.flow.value,
    boostsUsed,
    tookRushLine,
    distance: race.bike.x - startX,
    failure: race.state === 'FINISHED' ? null : diagnoseFailure(race, track, landingDetail),
  };
}

/**
 * Si por delante hay un hueco lo bastante estrecho como para BAJARLO RODANDO.
 *
 * Es la linea segura. Un hueco corto se puede tomar de dos maneras -saltarlo o
 * rodarlo- y esa eleccion es la diferencia de estrategia entre el piloto
 * prudente y el rapido. Se detecta por geometria y no por el nombre del
 * sector, asi que funciona igual en cualquier mision que se anada despues.
 *
 * El limite de anchura es lo que separa "hueco que se rueda" de "canon que hay
 * que saltar": un tajo cuya pared lejana esta a mas de ROLLABLE_GAP_WIDTH no
 * se rueda, se cruza o te matas, y frenar delante seria suicida. Por eso el
 * piloto prudente rueda la linea de riesgo pero se compromete en el mega
 * salto.
 */
const ROLLABLE_GAP_WIDTH = 22;
const ROLLABLE_GAP_DEPTH = 2.5;

function approachingRollableGap(track: TrackDefinition, x: number): boolean {
  const here = track.terrain.surfaceY(x);
  // Un hueco con RAMPA delante no es un hueco: es un salto, y frenar delante de
  // un kicker es lo peor que se puede hacer -te tira igual, pero sin velocidad
  // para cruzar-. Medido: frenando ante la linea de riesgo el piloto prudente
  // salia del labio despacio, caia de morro dentro del valle y aterrizaba
  // cruzado 53-59 grados. Si el terreno sube antes de caer, hay que
  // comprometerse.
  for (let ahead = 2; ahead <= 12; ahead += 2) {
    if (track.terrain.surfaceY(x + ahead) > here + 0.8) return false;
  }
  let deepestAt = -1;
  let deepest = here;
  for (let ahead = 2; ahead <= 26; ahead += 2) {
    const y = track.terrain.surfaceY(x + ahead);
    if (y < deepest) { deepest = y; deepestAt = ahead; }
  }
  if (deepestAt < 0 || here - deepest < ROLLABLE_GAP_DEPTH) return false;
  // La pared lejana: donde el terreno vuelve a la altura de partida.
  for (let ahead = deepestAt; ahead <= ROLLABLE_GAP_WIDTH + 8; ahead += 2) {
    if (track.terrain.surfaceY(x + ahead) >= here - 0.5) {
      return ahead <= ROLLABLE_GAP_WIDTH;
    }
  }
  return false;
}

/**
 * Si un piloto prudente levantaria el pie aqui.
 *
 * Baja fuerte Y lo que viene detras no sube: eso es una bajada de verdad, y en
 * una bajada de verdad se levanta el pie. Lo segundo es la parte que importa.
 * Sin ella el piloto frenaba durante toda la bajada de impulso del mega salto
 * -que existe exactamente para lo contrario, para coger la velocidad con la
 * que se cruza el canon- y no terminaba una sola carrera: se quedaba corto y
 * caia dentro en el metro 923 de 1032.
 *
 * Frenar en una bajada que termina en rampa no es prudencia, es no leer el
 * terreno. Y la comprobacion es geometrica, no una lista de sitios, asi que
 * vale igual para cualquier mision que se anada despues.
 */
function shouldLiftOff(track: TrackDefinition, x: number, speed: number): boolean {
  if (track.terrain.surfaceSlope(x) >= -0.32) return false;
  const here = track.terrain.surfaceY(x);
  // El horizonte se mide en SEGUNDOS de marcha, no en metros fijos.
  //
  // Con 40 m fijos el piloto frenaba durante toda la bajada de impulso del
  // mega salto, porque la rampa esta a 54 m del principio de la bajada y no
  // entraba en el horizonte hasta que ya era tarde. Medido: con el freno
  // activo el competente terminaba el 0% de las carreras y sin el, el 100%.
  // Un piloto no mira "cuarenta metros", mira los proximos segundos, y a 20
  // m/s eso son setenta.
  const horizon = Math.max(30, speed * 3.5);
  // Se busca una SUBIDA, y una subida es relativa al punto mas bajo que hay
  // por delante, no a la altura de ahora.
  //
  // Comparandola con la altura actual la regla no valia para nada detras de
  // una bajada larga: la bajada de impulso del mega salto pierde 14 m y la
  // rampa que hay detras solo sube 5,5, asi que el terreno NUNCA vuelve a
  // estar por encima del punto de partida y el piloto frenaba toda la bajada.
  // Lo que hay que ver es que el suelo deja de caer y vuelve a subir, aunque
  // sea muy por debajo de donde estabas.
  let lowest = here;
  for (let ahead = 4; ahead <= horizon; ahead += 4) {
    const y = track.terrain.surfaceY(x + ahead);
    lowest = Math.min(lowest, y);
    if (y > lowest + 1.5) return false;
  }
  return true;
}

/**
 * Decide si pulsar el turbo. Es una de las tres cosas que separan a los
 * perfiles, asi que va aparte y no escondido en el bucle.
 */
function decideBoost(profile: PilotProfile, race: RaceManager, track: TrackDefinition): boolean {
  if (profile.boost === 'nunca') return false;
  if (!race.flow.isBoostReady) return false;

  const mega = track.labels.find((label) => label.name === 'MEGA_JUMP');
  const toMega = mega ? mega.x - race.bike.x : Number.POSITIVE_INFINITY;

  if (profile.boost === 'guardaParaElSalto') {
    // Optimo: solo se gasta en la entrada del salto grande, donde la velocidad
    // extra se convierte en altura y en puntos.
    return toMega > 0 && toMega < 60;
  }

  // Conservador: lo gasta cuando lo tiene, se lo guarda al acercarse al salto
  // grande, y lo suelta al entrar en el. La diferencia con el perfecto es el
  // TIMING, no la cantidad: suelta a 90 m en vez de a 60, asi que llega al
  // labio con parte del REDLINE ya consumido.
  //
  // Las dos versiones anteriores dejaron al competente en 0% de finalizacion y
  // por motivos opuestos, que es justo lo que hace util medir esto:
  //   - gastandolo en cuanto podia llegaba al mega salto sin turbo
  //   - guardandolo desde 130 m no lo soltaba nunca, porque pasado el salto la
  //     condicion volvia a ser cierta y para entonces ya se habia caido dentro
  // En los dos casos se quedaba corto y caia al canon sobre el metro 925 de
  // 1032. El mega salto de M01 NO se cruza sin REDLINE.
  if (toMega > 0 && toMega < 90) return true;
  return !(toMega > 0 && toMega < 130);
}

/** Causa estimada del fallo, para que el informe diga algo util. */
function diagnoseFailure(
  race: RaceManager,
  track: TrackDefinition,
  detail: LandingRecord[],
): string {
  if (race.raceTime <= 0.01) return 'no llego a arrancar';
  if (race.state !== 'CRASHED') return `no llego a meta (${race.state})`;
  const last = detail[detail.length - 1];
  const label = [...track.labels].reverse().find((l) => l.x <= race.bike.x);
  const donde = label ? `tras ${label.name}` : 'al principio';
  if (!last) return `choque sin aterrizaje previo, ${donde}`;
  if (last.quality === 'CRASH' && last.angleError > 0.9) return `aterrizo cruzado (${(last.angleError * 57.3).toFixed(0)} grados), ${donde}`;
  if (last.quality === 'CRASH') return `impacto de ${last.impactSpeed.toFixed(1)} m/s, ${donde}`;
  return `choque del chasis contra el terreno, ${donde}`;
}

export interface BenchSummary {
  mission: string;
  skill: PilotSkill;
  runs: number;
  completionRate: number;
  meanTime: number | null;
  bestTime: number | null;
  meanBestCombo: number;
  meanMaxFlow: number;
  meanBoosts: number;
  rushLineRate: number;
  landings: Record<LandingQuality, number>;
  meanAngleError: number;
  failures: string[];
}

/** Agrega varias semillas del mismo perfil en una sola fila de informe. */
export function summarise(runs: BenchRun[]): BenchSummary {
  const finished = runs.filter((r) => r.finished);
  const landings: Record<LandingQuality, number> = { PERFECT: 0, GOOD: 0, ROUGH: 0, BAD: 0, CRASH: 0 };
  let angleTotal = 0;
  let angleCount = 0;
  for (const run of runs) {
    for (const key of Object.keys(landings) as LandingQuality[]) landings[key] += run.landings[key];
    for (const landing of run.landingDetail) {
      angleTotal += landing.angleError;
      angleCount += 1;
    }
  }
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  return {
    mission: runs[0]?.mission ?? '?',
    skill: runs[0]?.skill ?? 'competente',
    runs: runs.length,
    completionRate: runs.length ? finished.length / runs.length : 0,
    meanTime: finished.length ? mean(finished.map((r) => r.timeSeconds)) : null,
    bestTime: finished.length ? Math.min(...finished.map((r) => r.timeSeconds)) : null,
    meanBestCombo: mean(runs.map((r) => r.bestCombo)),
    meanMaxFlow: mean(runs.map((r) => r.maxFlow)),
    meanBoosts: mean(runs.map((r) => r.boostsUsed)),
    rushLineRate: runs.length ? runs.filter((r) => r.tookRushLine).length / runs.length : 0,
    landings,
    meanAngleError: angleCount ? angleTotal / angleCount : 0,
    failures: runs.filter((r) => r.failure).map((r) => r.failure!),
  };
}

/** Ejecuta un perfil sobre varias semillas. */
export function runProfile(
  track: TrackDefinition,
  skill: PilotSkill,
  seeds: number[],
  options: BenchOptions = {},
): BenchRun[] {
  return seeds.map((seed) => runBenchRace(track, skill, seed, options));
}
