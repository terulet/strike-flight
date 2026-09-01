/**
 * RaceManager.ts
 *
 * Orquesta una carrera completa: maquina de estados (READY -> COUNTDOWN ->
 * RACING -> CRASHED/FINISHED), avanza la fisica de la moto un tick fijo,
 * alimenta FlightTracker/FlowMeter/TrickDetector/Scoring, controla el
 * cronometro, sectores, el fantasma y el reinicio manual.
 */

import { BikeInput, BikeState, cloneBikeState, createInitialBikeState, isAirborne, lerpBikeState, stepBike } from '../physics/Bike';
import { InputSmoother, SmoothedInput } from '../input/InputSmoothing';
import { TrackDefinition } from '../tracks/CanyonRun';
import { InputState } from '../input/InputManager';
import { FlowMeter } from './FlowMeter';
import { ComboMeter } from './ComboMeter';
import { FlightTracker, LandingEvent } from './FlightTracker';
import { isChassisTouchingGround, isSpinningOutOnGround } from './CrashDetector';
import { StyleScore, formatTime, loadBestTime, saveBestTimeIfBetter } from './Scoring';
import { GhostRecorder, saveBestGhost, loadBestGhost, sampleGhostAtTime, ghostTimeAtX, GhostFrame } from './GhostRecorder';
import { GameState, TrickResult } from './types';
import { CrashConfig, FlowConfig, GameplayZoneConfig, RaceStartConfig } from '../config/GameConfig';
import { computeGameplayZones, GameplayZones } from './GameplayZones';

const COUNTDOWN_SECONDS = 3;

export interface RaceEventSink {
  onLanding?: (event: LandingEvent) => void;
  onTrick?: (trick: TrickResult) => void;
  onCrash?: () => void;
  onFinish?: () => void;
  onStateChange?: (state: GameState) => void;
  /** Instante exacto de la salida, ya con el golpe de suspension aplicado. */
  onRaceStart?: () => void;
  /** Un eslabon mas de cadena. `multiplier` es el que ya esta vigente. */
  onCombo?: (links: number, multiplier: number) => void;
  /** La cadena se cierra sola por tiempo, con su numero final de eslabones. */
  onComboEnd?: (links: number) => void;
  /** La cadena se rompe por un choque. */
  onComboBreak?: (links: number) => void;
  onSpeedPad?: () => void;
  /** true si se atraveso el aro dentro de la tolerancia, false si se paso de largo sin acertar la trayectoria. */
  onFlowRing?: (hit: boolean) => void;
  onRiskGapCleared?: () => void;
  /** Puramente visual: bump_gate y alt_ramp ya afectan el juego via terreno real, esto solo dispara su chispazo. */
  onAltRamp?: () => void;
  onBumpGate?: () => void;
}

export interface RaceResultsSummary {
  time: string;
  timeSeconds: number;
  best: string | null;
  bestSeconds: number | null;
  deltaSeconds: number | null;
  isNewBest: boolean;
  /** Eslabones de la cadena mas larga de la carrera. */
  bestCombo: number;
  perfectLandings: number;
  tricks: number;
  flow: number;
  styleScore: number;
  sectorSplits: readonly SectorSplit[];
}

export interface SectorSplit {
  sectorIndex: number;
  name: string;
  sectorTime: number;
  totalTime: number;
  deltaSeconds: number | null;
}

export class RaceManager {
  state: GameState = 'READY';
  bike: BikeState;
  /**
   * Estado de la moto en el tick ANTERIOR. El render lo necesita para
   * interpolar: sin el, a 60 Hz de pantalla y 120 Hz de simulacion se dibuja
   * siempre el ultimo estado fijo y la moto avanza a saltos de tamano
   * variable segun donde caiga cada frame. Eso es el microtiron.
   */
  previousBike: BikeState;
  raceTime = 0;
  countdownRemaining = COUNTDOWN_SECONDS;
  currentSectorIndex = 0;
  readonly sectorSplits: SectorSplit[] = [];

  readonly flow = new FlowMeter();
  readonly combo = new ComboMeter();
  readonly flightTracker = new FlightTracker();
  readonly styleScore = new StyleScore();
  readonly ghost = new GhostRecorder();

  private bestTime: number | null;
  private bestGhost: GhostFrame[] | null;
  private lastInput: InputState = { throttle: false, brake: false, lean: 0, restartPressed: false };
  private readonly inputSmoother = new InputSmoother();
  private lastSmoothedInput: SmoothedInput = { throttle: 0, brake: 0, lean: 0, throttlePressed: false, brakePressed: false };

  private readonly zones: GameplayZones;
  /** Cuanto lleva la moto girando demasiado rapido con las ruedas en el suelo. */
  private spinOutElapsed = 0;
  /** Segundos desde que se declaro el choque. El render lo usa para separar al piloto DESPUES del impacto, no en el mismo instante. */
  private crashElapsed = 0;
  /** Indices de los pads de turbo ya pisados en esta carrera. */
  private readonly speedPadsTriggered = new Set<number>();
  private flowRingArmed = true;
  private riskGapAwarded = false;
  private altRampFxPlayed = false;
  private bumpGateFxPlayed = false;

  constructor(private readonly track: TrackDefinition, private readonly sink: RaceEventSink = {}) {
    this.bestTime = loadBestTime();
    this.bestGhost = loadBestGhost();
    this.bike = createInitialBikeState(track.startX, track.startY);
    this.previousBike = cloneBikeState(this.bike);
    this.zones = computeGameplayZones(track);
  }

  getBestTimeSeconds(): number | null {
    return this.bestTime;
  }

  getGhostPose(): GhostFrame | null {
    if (this.state !== 'RACING' || !this.bestGhost) return null;
    return sampleGhostAtTime(this.bestGhost, this.raceTime);
  }

  /**
   * Multiplicador de puntuacion vigente: cadena por REDLINE. Se multiplican
   * entre si a proposito. La cadena premia encadenar acrobacias y el REDLINE
   * premia ir rapido; que se multipliquen es lo que hace que la puntuacion
   * grande salga de hacer las dos cosas a la vez, y no de insistir en una.
   */
  get scoreMultiplier(): number {
    return this.combo.multiplier * this.flow.scoreMultiplier;
  }

  getLiveDeltaSeconds(): number | null {
    if (this.state !== 'RACING' || !this.bestGhost) return null;
    const bestTimeAtX = ghostTimeAtX(this.bestGhost, this.bike.x);
    return bestTimeAtX === null ? null : this.raceTime - bestTimeAtX;
  }

  private setState(state: GameState): void {
    this.state = state;
    this.sink.onStateChange?.(state);
  }

  /** Arranca la cuenta atras desde READY (o desde cualquier estado, actua como restart). */
  begin(): void {
    this.resetTransientState();
    this.setState('COUNTDOWN');
  }

  restart(): void {
    this.resetTransientState();
    this.setState('COUNTDOWN');
  }

  private resetTransientState(): void {
    this.bike = createInitialBikeState(this.track.startX, this.track.startY);
    // Prev = actual: si no, el primer frame tras un reinicio interpolaria
    // entre la posicion de la carrera anterior y la salida, y la moto
    // cruzaria media pista dibujada en un fotograma.
    this.previousBike = cloneBikeState(this.bike);
    this.inputSmoother.reset();
    this.lastSmoothedInput = this.inputSmoother.current;
    this.raceTime = 0;
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.currentSectorIndex = 0;
    this.sectorSplits.length = 0;
    this.flow.reset();
    this.combo.reset();
    this.flightTracker.reset();
    this.styleScore.reset();
    this.ghost.reset();
    this.spinOutElapsed = 0;
    this.crashElapsed = 0;
    this.speedPadsTriggered.clear();
    this.flowRingArmed = true;
    this.riskGapAwarded = false;
    this.altRampFxPlayed = false;
    this.bumpGateFxPlayed = false;
  }

  /** Un tick de simulacion a paso fijo `dt` (segundos). */
  step(dt: number, input: InputState): void {
    this.lastInput = input;
    if (this.state === 'CRASHED') this.crashElapsed += dt;
    // El suavizado corre SIEMPRE, tambien en cuenta atras y tras un crash: es
    // un filtro sobre el mando, no parte de la carrera. Si solo corriera
    // mientras se compite, el primer tick de "GO!" recibiria un escalon.
    this.lastSmoothedInput = this.inputSmoother.update(input, dt);

    if (this.state === 'COUNTDOWN') {
      this.countdownRemaining -= dt;
      // La moto NO esta congelada en la parrilla: se simula con el mando
      // neutro, asi que cae a su altura de reposo, la suspension rebota y se
      // queda planta antes de que acabe la cuenta. Antes flotaba inmovil
      // durante tres segundos y se soltaba de golpe al empezar.
      this.previousBike = this.bike;
      this.bike = stepBike(
        this.bike,
        this.track.terrain,
        { throttle: false, brake: false, lean: 0, smoothed: this.lastSmoothedInput },
        dt,
      );
      if (this.countdownRemaining <= 0) {
        // Golpe de salida: un empujon vertical hacia abajo. La compresion y
        // el rebote los produce la propia suspension.
        this.bike = { ...this.bike, vy: this.bike.vy - RaceStartConfig.launchDip };
        this.setState('RACING');
        this.sink.onRaceStart?.();
      }
      return;
    }

    if (input.restartPressed && (this.state === 'CRASHED' || this.state === 'FINISHED' || this.state === 'RACING')) {
      this.restart();
      return;
    }

    if (this.state !== 'RACING') return;

    this.raceTime += dt;

    const prevX = this.bike.x;
    const bikeInput: BikeInput = {
      throttle: input.throttle,
      brake: input.brake,
      lean: input.lean,
      smoothed: this.lastSmoothedInput,
    };
    this.previousBike = this.bike;
    this.bike = stepBike(this.bike, this.track.terrain, bikeInput, dt);

    this.checkGameplayZones(prevX);

    this.ghost.record(this.raceTime, this.bike.x, this.bike.y, this.bike.angle, dt);

    const landingEvent = this.flightTracker.update(this.bike, this.track.terrain, input.lean, dt);

    const airborne = isAirborne(this.bike);
    const groundedFast = !airborne && Math.abs(this.bike.vx) >= FlowConfig.fastSpeedThreshold;
    const airControlActive = airborne && input.lean !== 0;
    this.flow.tick(dt, { groundedFast, airControlActive });
    const comboLinks = this.combo.links;
    if (this.combo.tick(dt)) this.sink.onComboEnd?.(comboLinks);

    if (landingEvent) {
      this.handleLanding(landingEvent);
    }

    // El trompo tiene que SOSTENERSE: un pico de un tick al aterrizar fuerte
    // no es perder el control (ver CrashConfig.spinOutDuration).
    this.spinOutElapsed = isSpinningOutOnGround(this.bike) ? this.spinOutElapsed + dt : 0;

    if (
      isChassisTouchingGround(this.bike, this.track.terrain) ||
      this.spinOutElapsed >= CrashConfig.spinOutDuration
    ) {
      this.crash();
      return;
    }

    this.updateSector();

    if (this.bike.x >= this.track.finishX) {
      this.finish();
    }
  }

  /**
   * Deteccion de las piezas de riesgo/recompensa que no dependen de un
   * aterrizaje (ver GameplayZones): pad de velocidad (suelo) y aro de flow
   * (aire). El hueco de riesgo se resuelve en handleLanding, porque su
   * consecuencia depende de donde se aterriza, no de cruzar una x.
   */
  private checkGameplayZones(prevX: number): void {
    const { speedPads, flowRing, altRamp, bumpGate } = this.zones;
    const x = this.bike.x;
    const grounded = this.bike.front.inContact || this.bike.rear.inContact;

    if (bumpGate && !this.bumpGateFxPlayed && prevX < bumpGate.x && x >= bumpGate.x) {
      this.bumpGateFxPlayed = true;
      this.sink.onBumpGate?.();
    }
    if (altRamp && !this.altRampFxPlayed && prevX < altRamp.x && x >= altRamp.x) {
      this.altRampFxPlayed = true;
      this.sink.onAltRamp?.();
    }

    for (let i = 0; i < speedPads.length; i++) {
      const pad = speedPads[i];
      if (this.speedPadsTriggered.has(i)) continue;
      if (!grounded || this.bike.vx <= 0) continue;
      if (prevX >= pad.x || x < pad.x) continue;
      this.speedPadsTriggered.add(i);
      this.bike = { ...this.bike, vx: this.bike.vx + GameplayZoneConfig.speedPad.boostVx };
      this.flow.bonus(GameplayZoneConfig.speedPad.flowBonus);
      this.sink.onSpeedPad?.();
    }

    const airborne = isAirborne(this.bike);
    if (!airborne) this.flowRingArmed = true;
    if (flowRing && airborne && this.flowRingArmed && prevX < flowRing.x && x >= flowRing.x) {
      this.flowRingArmed = false;
      const hit = Math.abs(this.bike.y - flowRing.y) <= flowRing.radius;
      if (hit) {
        this.flow.bonus(GameplayZoneConfig.flowRing.flowBonus);
        this.flow.extendRedline(GameplayZoneConfig.flowRing.redlineExtendSeconds);
        this.addComboLink();
      }
      this.sink.onFlowRing?.(hit);
    }
  }

  private handleLanding(event: LandingEvent): void {
    this.flow.onLanding(event.quality);
    // El multiplicador se lee ANTES de encadenar: el eslabon que se acaba de
    // ganar no se cobra a si mismo. Si no, la cadena se pagaria dos veces.
    this.styleScore.registerLanding(event.quality, this.scoreMultiplier);
    this.sink.onLanding?.(event);

    if (event.quality === 'CRASH') {
      this.crash();
      return;
    }

    const riskGap = this.zones.riskGap;
    if (
      riskGap &&
      !this.riskGapAwarded &&
      this.bike.x >= riskGap.endX &&
      this.bike.x <= riskGap.endX + 15
    ) {
      this.riskGapAwarded = true;
      this.flow.bonus(GameplayZoneConfig.riskGap.flowBonus);
      this.sink.onRiskGapCleared?.();
      this.addComboLink();
    }

    if (event.trick) {
      this.flow.onTrick();
      this.styleScore.registerTrick(event.trick, this.scoreMultiplier);
      this.sink.onTrick?.(event.trick);
      this.addComboLink();
    }

    // Un aterrizaje mediocre no encadena: la cadena tiene que costar algo o
    // deja de significar nada.
    if (event.quality === 'PERFECT' || event.quality === 'GOOD') this.addComboLink();
  }

  /** Suma un eslabon y avisa. Centralizado para que todos los premios encadenen igual. */
  private addComboLink(): void {
    const multiplier = this.combo.add();
    this.sink.onCombo?.(this.combo.links, multiplier);
  }

  private updateSector(): void {
    const sectors = this.track.sectors;
    while (
      this.currentSectorIndex < sectors.length - 1 &&
      this.bike.x >= sectors[this.currentSectorIndex].endX
    ) {
      this.completeSector(this.currentSectorIndex);
      this.currentSectorIndex += 1;
    }
  }

  private completeSector(index: number): void {
    if (this.sectorSplits.length > index) return;
    const sector = this.track.sectors[index];
    const previousTotal = index > 0 ? this.sectorSplits[index - 1].totalTime : 0;
    const bestTotal = this.bestGhost ? ghostTimeAtX(this.bestGhost, sector.endX) : null;
    this.sectorSplits.push({
      sectorIndex: index,
      name: sector.name,
      sectorTime: this.raceTime - previousTotal,
      totalTime: this.raceTime,
      deltaSeconds: bestTotal === null ? null : this.raceTime - bestTotal,
    });
  }

  get currentSectorName(): string {
    const sectors = this.track.sectors;
    if (sectors.length === 0) return '';
    const index = Math.min(this.currentSectorIndex, sectors.length - 1);
    return `S${index + 1}/${sectors.length} ${sectors[index].name}`;
  }

  get latestSectorSplit(): SectorSplit | null {
    return this.sectorSplits[this.sectorSplits.length - 1] ?? null;
  }

  private crash(): void {
    const lostLinks = this.combo.links;
    this.combo.break();
    if (lostLinks > 0) this.sink.onComboBreak?.(lostLinks);
    this.setState('CRASHED');
    this.sink.onCrash?.();
  }

  private finish(): void {
    this.completeSector(this.track.sectors.length - 1);
    this.setState('FINISHED');
    this.sink.onFinish?.();
  }

  getResultsSummary(): RaceResultsSummary {
    const timeSeconds = this.raceTime;
    const previousBest = this.bestTime;
    const isNewBest = this.state === 'FINISHED' && saveBestTimeIfBetter(timeSeconds, previousBest);
    if (isNewBest) {
      this.bestTime = timeSeconds;
      this.bestGhost = [...this.ghost.recordedFrames];
      saveBestGhost(this.bestGhost);
    }
    const deltaSeconds = previousBest !== null ? timeSeconds - previousBest : null;
    return {
      time: formatTime(timeSeconds),
      timeSeconds,
      best: this.bestTime !== null ? formatTime(this.bestTime) : null,
      bestSeconds: this.bestTime,
      deltaSeconds,
      isNewBest,
      bestCombo: this.combo.bestLinks,
      perfectLandings: this.styleScore.perfectLandings,
      tricks: this.styleScore.tricks,
      flow: this.flow.value,
      styleScore: this.styleScore.score,
      sectorSplits: this.sectorSplits.map((split) => ({ ...split })),
    };
  }

  get lastAppliedInput(): InputState {
    return this.lastInput;
  }

  /** Entrada continua (0..1 / -1..1) realmente aplicada a la fisica este tick. */
  get smoothedInput(): SmoothedInput {
    return this.lastSmoothedInput;
  }

  /** Segundos transcurridos desde el choque. 0 si no se ha estrellado. */
  get timeSinceCrash(): number {
    return this.state === 'CRASHED' ? this.crashElapsed : 0;
  }

  /**
   * Estado visual de la moto para un `alpha` de interpolacion 0..1, tal y como
   * lo entrega `GameLoop.render(alpha)`. alpha 0 = tick anterior, 1 = tick
   * actual. Todo lo que dibuja -chasis, ruedas, suspension, piloto- y la
   * camara deben consumir ESTE estado, nunca `this.bike` directamente, o
   * volvemos al microtiron.
   */
  getInterpolatedBike(alpha: number): BikeState {
    return lerpBikeState(this.previousBike, this.bike, alpha);
  }

  /** Zonas de riesgo/recompensa ya calculadas (misma fuente que usa el render, ver GameplayZones). */
  get gameplayZones(): GameplayZones {
    return this.zones;
  }
}
