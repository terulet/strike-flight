/**
 * RaceManager.ts
 *
 * Orquesta una carrera completa: maquina de estados (READY -> COUNTDOWN ->
 * RACING -> CRASHED/FINISHED), avanza la fisica de la moto un tick fijo,
 * alimenta FlightTracker/FlowMeter/TrickDetector/Scoring, controla el
 * cronometro, sectores, el fantasma y el reinicio manual.
 */

import { BikeInput, BikeState, createInitialBikeState, isAirborne, stepBike } from '../physics/Bike';
import { TrackDefinition } from '../tracks/CanyonRun';
import { InputState } from '../input/InputManager';
import { FlowMeter } from './FlowMeter';
import { FlightTracker, LandingEvent } from './FlightTracker';
import { isChassisTouchingGround, isSpinningOutOnGround } from './CrashDetector';
import { StyleScore, formatTime, loadBestTime, saveBestTimeIfBetter } from './Scoring';
import { GhostRecorder, saveBestGhost, loadBestGhost, sampleGhostAtTime, ghostTimeAtX, GhostFrame } from './GhostRecorder';
import { GameState, TrickResult } from './types';
import { FlowConfig, GameplayZoneConfig } from '../config/GameConfig';
import { computeGameplayZones, GameplayZones } from './GameplayZones';

const COUNTDOWN_SECONDS = 3;

export interface RaceEventSink {
  onLanding?: (event: LandingEvent) => void;
  onTrick?: (trick: TrickResult) => void;
  onCrash?: () => void;
  onFinish?: () => void;
  onStateChange?: (state: GameState) => void;
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
  raceTime = 0;
  countdownRemaining = COUNTDOWN_SECONDS;
  currentSectorIndex = 0;
  readonly sectorSplits: SectorSplit[] = [];

  readonly flow = new FlowMeter();
  readonly flightTracker = new FlightTracker();
  readonly styleScore = new StyleScore();
  readonly ghost = new GhostRecorder();

  private bestTime: number | null;
  private bestGhost: GhostFrame[] | null;
  private lastInput: InputState = { throttle: false, brake: false, lean: 0, restartPressed: false };

  private readonly zones: GameplayZones;
  private speedPadTriggered = false;
  private flowRingArmed = true;
  private riskGapAwarded = false;
  private altRampFxPlayed = false;
  private bumpGateFxPlayed = false;

  constructor(private readonly track: TrackDefinition, private readonly sink: RaceEventSink = {}) {
    this.bestTime = loadBestTime();
    this.bestGhost = loadBestGhost();
    this.bike = createInitialBikeState(track.startX, track.startY);
    this.zones = computeGameplayZones(track);
  }

  getBestTimeSeconds(): number | null {
    return this.bestTime;
  }

  getGhostPose(): GhostFrame | null {
    if (this.state !== 'RACING' || !this.bestGhost) return null;
    return sampleGhostAtTime(this.bestGhost, this.raceTime);
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
    this.raceTime = 0;
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.currentSectorIndex = 0;
    this.sectorSplits.length = 0;
    this.flow.reset();
    this.flightTracker.reset();
    this.styleScore.reset();
    this.ghost.reset();
    this.speedPadTriggered = false;
    this.flowRingArmed = true;
    this.riskGapAwarded = false;
    this.altRampFxPlayed = false;
    this.bumpGateFxPlayed = false;
  }

  /** Un tick de simulacion a paso fijo `dt` (segundos). */
  step(dt: number, input: InputState): void {
    this.lastInput = input;

    if (this.state === 'COUNTDOWN') {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.setState('RACING');
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
    const bikeInput: BikeInput = { throttle: input.throttle, brake: input.brake, lean: input.lean };
    this.bike = stepBike(this.bike, this.track.terrain, bikeInput, dt);

    this.checkGameplayZones(prevX);

    this.ghost.record(this.raceTime, this.bike.x, this.bike.y, this.bike.angle, dt);

    const landingEvent = this.flightTracker.update(this.bike, this.track.terrain, input.lean, dt);

    const airborne = isAirborne(this.bike);
    const groundedFast = !airborne && Math.abs(this.bike.vx) >= FlowConfig.fastSpeedThreshold;
    const airControlActive = airborne && input.lean !== 0;
    this.flow.tick(dt, { groundedFast, airControlActive });

    if (landingEvent) {
      this.handleLanding(landingEvent);
    }

    if (
      isChassisTouchingGround(this.bike, this.track.terrain) ||
      isSpinningOutOnGround(this.bike)
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
    const { speedPad, flowRing, altRamp, bumpGate } = this.zones;
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

    if (
      speedPad &&
      !this.speedPadTriggered &&
      grounded &&
      this.bike.vx > 0 &&
      prevX < speedPad.x &&
      x >= speedPad.x
    ) {
      this.speedPadTriggered = true;
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
      }
      this.sink.onFlowRing?.(hit);
    }
  }

  private handleLanding(event: LandingEvent): void {
    this.flow.onLanding(event.quality);
    this.styleScore.registerLanding(event.quality, this.flow.scoreMultiplier);
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
    }

    if (event.trick) {
      this.flow.onTrick();
      this.styleScore.registerTrick(event.trick, this.flow.scoreMultiplier);
      this.sink.onTrick?.(event.trick);
    }
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

  /** Zonas de riesgo/recompensa ya calculadas (misma fuente que usa el render, ver GameplayZones). */
  get gameplayZones(): GameplayZones {
    return this.zones;
  }
}
