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
import { GhostRecorder, saveBestGhost, GhostFrame } from './GhostRecorder';
import { GameState, TrickResult } from './types';
import { FlowConfig } from '../config/GameConfig';

const COUNTDOWN_SECONDS = 3;

export interface RaceEventSink {
  onLanding?: (event: LandingEvent) => void;
  onTrick?: (trick: TrickResult) => void;
  onCrash?: () => void;
  onFinish?: () => void;
  onStateChange?: (state: GameState) => void;
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
}

export class RaceManager {
  state: GameState = 'READY';
  bike: BikeState;
  raceTime = 0;
  countdownRemaining = COUNTDOWN_SECONDS;
  currentSectorIndex = 0;

  readonly flow = new FlowMeter();
  readonly flightTracker = new FlightTracker();
  readonly styleScore = new StyleScore();
  readonly ghost = new GhostRecorder();

  private bestTime: number | null;
  private lastInput: InputState = { throttle: false, brake: false, lean: 0, restartPressed: false };

  constructor(private readonly track: TrackDefinition, private readonly sink: RaceEventSink = {}) {
    this.bestTime = loadBestTime();
    this.bike = createInitialBikeState(track.startX, track.startY);
  }

  getBestTimeSeconds(): number | null {
    return this.bestTime;
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
    this.flow.reset();
    this.flightTracker.reset();
    this.styleScore.reset();
    this.ghost.reset();
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

    const bikeInput: BikeInput = { throttle: input.throttle, brake: input.brake, lean: input.lean };
    this.bike = stepBike(this.bike, this.track.terrain, bikeInput, dt);

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

  private handleLanding(event: LandingEvent): void {
    this.flow.onLanding(event.quality);
    this.styleScore.registerLanding(event.quality, this.flow.scoreMultiplier);
    this.sink.onLanding?.(event);

    if (event.quality === 'CRASH') {
      this.crash();
      return;
    }

    if (event.trick) {
      this.flow.onTrick();
      this.styleScore.registerTrick(event.trick, this.flow.scoreMultiplier);
      this.sink.onTrick?.(event.trick);
    }
  }

  private updateSector(): void {
    const labels = this.track.labels;
    while (
      this.currentSectorIndex < labels.length - 1 &&
      this.bike.x >= labels[this.currentSectorIndex + 1].x
    ) {
      this.currentSectorIndex += 1;
    }
  }

  get currentSectorName(): string {
    const labels = this.track.labels;
    if (labels.length === 0) return '';
    return labels[Math.min(this.currentSectorIndex, labels.length - 1)].name;
  }

  private crash(): void {
    this.setState('CRASHED');
    this.sink.onCrash?.();
  }

  private finish(): void {
    this.setState('FINISHED');
    this.sink.onFinish?.();
  }

  getResultsSummary(): RaceResultsSummary {
    const timeSeconds = this.raceTime;
    const previousBest = this.bestTime;
    const isNewBest = saveBestTimeIfBetter(timeSeconds, previousBest);
    if (isNewBest) {
      this.bestTime = timeSeconds;
      saveBestGhost(this.ghost.recordedFrames as GhostFrame[]);
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
    };
  }

  get lastAppliedInput(): InputState {
    return this.lastInput;
  }
}
