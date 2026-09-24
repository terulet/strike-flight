/**
 * Rivales: pilotos con la MISMA fisica que el jugador, conducidos por el
 * piloto automatico con un ritmo propio. No chocan con el jugador (cada uno va
 * por su carril), pero se caen, reaparecen, se los traga la tormenta y
 * pelean por el holeshot.
 *
 * Para que la carrera este viva sin ser injusta, su ritmo en llano se ajusta
 * a la distancia con el jugador (si van muy por delante levantan el pie, si
 * se quedan atras aprietan). Antes de cada salto siempre van a fondo: un
 * rival nunca se cae por ir lento a un foso.
 */
import { angleDiff, clamp } from '../core/math';
import { BIKE, BikeState, cloneBike, createBike, isAirborne, stepBike } from '../physics/bike';
import { TrackData } from '../physics/trackBuilder';
import { Autopilot } from './autopilot';
import { crashCheck } from './crash';

/** Igual que RACE.pumpBoost (no se importa para no crear un ciclo con race.ts). */
const PUMP_BOOST = 2.6;

export type RiderColors = 'blue' | 'green' | 'yellow' | 'purple';

export interface RivalSpec {
  name: string;
  number: string;
  colors: RiderColors;
  /** Velocidad de crucero en llano (m/s) antes del ajuste por distancia. */
  pace: number;
  /** Reflejos en la salida (s). */
  reaction: number;
  /** Error de punteria en el aire (rad). */
  sloppiness: number;
  /** Carril: 1 = justo detras del jugador, 3 = el mas alejado. */
  lane: number;
}

export type RivalState = 'countdown' | 'racing' | 'crashed' | 'finished' | 'out';

export class Rival {
  bike: BikeState;
  prevBike: BikeState;
  state: RivalState = 'countdown';
  readonly nitro = 0;
  currentAirTime = 0;
  currentAirRotation = 0;
  lastCheckpoint = 0;
  crashTimer = 0;
  crashes = 0;
  finishTime = Infinity;
  crashBike: BikeState | null = null;
  private goTimer = 0;
  private readonly upside = { t: 0 };
  private readonly pilot: Autopilot;

  constructor(
    readonly spec: RivalSpec,
    readonly track: TrackData,
  ) {
    this.bike = createBike(track.terrain, track.startX);
    for (let i = 0; i < 90; i++) stepBike(this.bike, { throttle: 0, brake: 1, lean: 0, nitro: false }, track.terrain, 1 / 120);
    this.bike.vx = 0;
    this.bike.vy = 0;
    this.prevBike = cloneBike(this.bike);
    this.pilot = new Autopilot({ sloppiness: spec.sloppiness });
  }

  get airborne(): boolean {
    return isAirborne(this.bike);
  }

  /** Progreso comparable entre pilotos (metros; los que han llegado van primero). */
  get progressKey(): number {
    return this.state === 'finished' ? 1e6 - this.finishTime : this.bike.x;
  }

  go(): void {
    if (this.state === 'countdown') {
      this.state = 'racing';
      this.goTimer = this.spec.reaction;
    }
  }

  /** Devuelve 'crash' | 'respawn' | 'finish' | null para que la carrera lo cuente. */
  step(dt: number, raceTime: number, playerX: number): 'crash' | 'respawn' | 'finish' | null {
    this.prevBike = cloneBike(this.bike);
    const t = this.track;
    if (this.state === 'countdown' || this.state === 'out') {
      stepBike(this.bike, { throttle: 0, brake: 1, lean: 0, nitro: false }, t.terrain, dt);
      if (this.state === 'countdown') {
        this.bike.x = t.startX;
        this.bike.vx = 0;
      }
      return null;
    }
    if (this.state === 'crashed') {
      this.crashTimer += dt;
      if (this.crashTimer >= 1.5) {
        this.respawn();
        return 'respawn';
      }
      return null;
    }
    if (this.state === 'finished') {
      stepBike(this.bike, { throttle: 0, brake: 0.4, lean: 0, nitro: false }, t.terrain, dt);
      return null;
    }

    let input = this.pilot.input(this);
    if (this.goTimer > 0) {
      this.goTimer -= dt;
      input = { throttle: 0, brake: 1, lean: 0, nitro: false };
    }
    const b = this.bike;
    if (!isAirborne(b)) {
      const next = t.kickers.find((k) => k > b.x - 2);
      const nearJump = next !== undefined && next - b.x < 48;
      const cap = this.spec.pace + clamp((playerX - b.x) * 0.1, -3, 8);
      if (!nearJump && Math.hypot(b.vx, b.vy) > cap) input = { ...input, throttle: 0.15 };
    }
    const wasAir = isAirborne(b);
    const ev = stepBike(b, input, t.terrain, dt);
    if (isAirborne(b)) {
      if (!wasAir) {
        this.currentAirTime = 0;
        this.currentAirRotation = 0;
      }
      this.currentAirTime += dt;
      this.currentAirRotation += b.angle - this.prevBike.angle;
    } else {
      if (wasAir) this.land();
      this.currentAirTime = 0;
      this.currentAirRotation = 0;
    }

    if (crashCheck(t, b, ev.headHit, dt, this.upside)) {
      this.state = 'crashed';
      this.crashTimer = 0;
      this.crashes += 1;
      this.crashBike = cloneBike(b);
      return 'crash';
    }
    while (this.lastCheckpoint + 1 < t.checkpoints.length && b.x >= t.checkpoints[this.lastCheckpoint + 1]) this.lastCheckpoint += 1;
    if (b.x >= t.finishX) {
      this.state = 'finished';
      this.finishTime = raceTime;
      return 'finish';
    }
    return null;
  }

  /** Misma regla que el jugador: clavar la recepcion devuelve velocidad. */
  private land(): void {
    const b = this.bike;
    const slope = Math.atan(this.track.terrain.slopeAt(b.x));
    if (this.currentAirTime > 0.45 && Math.abs(angleDiff(b.angle, slope)) < 0.2 && Math.hypot(b.vx, b.vy) < BIKE.topSpeed + 4) {
      b.vx += Math.cos(slope) * PUMP_BOOST;
      b.vy += Math.sin(slope) * PUMP_BOOST;
      b.rear.spinRate += PUMP_BOOST / BIKE.wheelRadius;
    }
  }

  /** La tormenta le alcanza: queda fuera de carrera. */
  knockOut(): void {
    this.state = 'out';
    this.crashBike = cloneBike(this.bike);
  }

  private respawn(): void {
    const x = this.track.checkpoints[this.lastCheckpoint];
    this.bike = createBike(this.track.terrain, x);
    for (let i = 0; i < 30; i++) stepBike(this.bike, { throttle: 0, brake: 1, lean: 0, nitro: false }, this.track.terrain, 1 / 120);
    this.bike.vx = 3;
    this.prevBike = cloneBike(this.bike);
    this.crashBike = null;
    this.upside.t = 0;
    this.state = 'racing';
  }
}
