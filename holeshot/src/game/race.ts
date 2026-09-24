/**
 * Una carrera: reloj, checkpoints, caidas y reaparicion, trucos, combo,
 * nitro, recogibles y (en la prueba de la tormenta) el muro que persigue.
 *
 * No sabe nada de dibujo ni de DOM: emite eventos y el resto del juego
 * decide como contarlos.
 */
import { angleDiff, clamp } from '../core/math';
import { BIKE, BikeInput, BikeState, cloneBike, createBike, isAirborne, stepBike } from '../physics/bike';
import { TrackData } from '../physics/trackBuilder';
import { crashCheck } from './crash';
import type { Mission } from './missions';
import { Rival } from './rival';

export type RaceState = 'countdown' | 'racing' | 'crashed' | 'finished' | 'failed';
export type LandingQuality = 'PERFECT' | 'GOOD' | 'ROUGH';
/** Como ha salido el jugador de la parrilla. */
export type StartKind = 'perfect' | 'good' | 'late' | 'spin';
/** Como fue cada tramo de la pista (para el resumen compartible). */
export type SectionMark = 'clean' | 'flip' | 'rough' | 'crash';
const MARK_RANK: Record<SectionMark, number> = { clean: 0, flip: 1, rough: 2, crash: 3 };

export interface TrickEvent {
  flips: number;
  direction: 'back' | 'front';
  airTime: number;
  quality: LandingQuality;
  points: number;
  combo: number;
}

export interface RaceEvents {
  onLand?: (e: TrickEvent) => void;
  onCrash?: () => void;
  onRespawn?: () => void;
  onCheckpoint?: (index: number) => void;
  onPickup?: (kind: 'plate' | 'nitro') => void;
  onFinish?: () => void;
  onFail?: (reason: string) => void;
  onTakeoff?: () => void;
  onStart?: (kind: StartKind) => void;
  /** El primero en llegar a la primera curva: el jugador (null) o un rival. */
  onHoleshot?: (rival: Rival | null) => void;
  onRivalCrash?: (r: Rival) => void;
  onRivalRespawn?: (r: Rival) => void;
  onRivalOut?: (r: Rival) => void;
  onRivalFinish?: (r: Rival) => void;
}

export const RACE = {
  countdown: 3,
  crashFreeze: 1.5,
  pickupRadius: 1.35,
  comboWindow: 3.2,
  nitroMax: 100,
  nitroDrain: 26,
  flipPoints: 1000,
  perfectPoints: 250,
  airPointsPerSecond: 220,
  pumpBoost: 2.6,
  stormStartGap: 55,
  stormRespawnGap: 38,
  /** Distancia desde la parrilla hasta la "primera curva" del holeshot. */
  holeshotDistance: 55,
  /** Gas mantenido antes de caer la parrilla: hasta aqui es salida perfecta. */
  revWindow: 0.9,
  perfectStartBoost: 2.6,
  holeshotPoints: 500,
} as const;

export class Race {
  readonly track: TrackData;
  readonly mission: Mission;
  bike: BikeState;
  prevBike: BikeState;
  state: RaceState = 'countdown';
  countdown: number = RACE.countdown;
  time = 0;
  crashTimer = 0;
  crashes = 0;
  score = 0;
  trickScore = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  nitro = 30;
  nitroActive = false;
  flips = 0;
  perfectLandings = 0;
  lastCheckpoint = 0;
  readonly collected: boolean[];
  platesCollected = 0;
  stormX = -Infinity;
  failReason = '';
  /** Estado del vuelo en curso. */
  private airTime = 0;
  private airRotation = 0;
  private airStartAngle = 0;
  /** Pose congelada del choque, para la animacion del piloto saliendo despedido. */
  crashBike: BikeState | null = null;
  maxAirTime = 0;
  readonly rivals: Rival[];
  /** Salida: tiempo con gas antes de caer la parrilla y resultado. */
  revTime = 0;
  startKind: StartKind | null = null;
  private sinceGo = 0;
  private bogTimer = 0;
  /** null = aun nadie; 'player' o el rival que se lo llevo. */
  holeshot: 'player' | Rival | null = null;
  private readonly upside = { t: 0 };
  readonly sectionMarks: SectionMark[];
  /** Reloj de carrera que sigue corriendo tras la meta del jugador (para los rivales). */
  private clock = 0;

  constructor(mission: Mission, private readonly events: RaceEvents = {}) {
    this.mission = mission;
    this.track = mission.track;
    this.bike = createBike(this.track.terrain, this.track.startX);
    this.prevBike = cloneBike(this.bike);
    this.collected = this.track.pickups.map(() => false);
    this.rivals = (mission.rivals ?? []).map((spec) => new Rival(spec, this.track));
    this.sectionMarks = this.track.sections.map(() => 'clean');
    if (mission.objective === 'storm') this.stormX = this.track.startX - RACE.stormStartGap;
    // Asentar la suspension antes de la salida.
    for (let i = 0; i < 90; i++) stepBike(this.bike, { throttle: 0, brake: 1, lean: 0, nitro: false }, this.track.terrain, 1 / 120);
    this.bike.vx = 0;
    this.bike.vy = 0;
    this.prevBike = cloneBike(this.bike);
  }

  get airborne(): boolean {
    return isAirborne(this.bike);
  }

  get currentAirTime(): number {
    return this.airTime;
  }

  get currentAirRotation(): number {
    return this.airRotation;
  }

  get progress(): number {
    return clamp((this.bike.x - this.track.startX) / (this.track.finishX - this.track.startX), 0, 1);
  }

  get comboMultiplier(): number {
    return 1 + Math.min(4, this.combo);
  }

  /** Puesto del jugador (1 = primero) entre los que siguen en carrera. */
  get position(): number {
    const mine = this.state === 'finished' ? 1e6 - this.time : this.bike.x;
    return 1 + this.rivals.filter((r) => r.state !== 'out' && r.progressKey > mine).length;
  }

  get riders(): number {
    return 1 + this.rivals.filter((r) => r.state !== 'out').length;
  }

  step(dt: number, input: BikeInput): void {
    this.stepPlayer(dt, input);
    this.stepRivals(dt);
    this.checkHoleshot();
  }

  /** Los rivales siguen corriendo aunque el jugador haya terminado. */
  stepRivals(dt: number): void {
    if (this.state === 'countdown') {
      for (const r of this.rivals) r.step(dt, this.time, this.bike.x);
      return;
    }
    this.clock += dt;
    for (const r of this.rivals) {
      r.go();
      const ev = r.step(dt, this.clock, this.bike.x);
      if (ev === 'crash') this.events.onRivalCrash?.(r);
      else if (ev === 'respawn') {
        if (this.mission.objective === 'storm' && this.stormX > r.bike.x - 6) {
          r.knockOut();
          this.events.onRivalOut?.(r);
        } else this.events.onRivalRespawn?.(r);
      } else if (ev === 'finish') this.events.onRivalFinish?.(r);
      if (this.mission.objective === 'storm' && r.state !== 'out' && r.state !== 'finished' && this.stormX >= r.bike.x - 0.8) {
        r.knockOut();
        this.events.onRivalOut?.(r);
      }
    }
  }

  private checkHoleshot(): void {
    if (this.holeshot || !this.rivals.length || this.state === 'countdown') return;
    const line = this.track.startX + RACE.holeshotDistance;
    let best: 'player' | Rival | null = this.bike.x >= line ? 'player' : null;
    let bestX = best ? this.bike.x : -Infinity;
    for (const r of this.rivals) {
      if (r.bike.x >= line && r.bike.x > bestX) {
        best = r;
        bestX = r.bike.x;
      }
    }
    if (!best) return;
    this.holeshot = best;
    if (best === 'player') {
      this.score += RACE.holeshotPoints;
      this.nitro = Math.min(RACE.nitroMax, this.nitro + 40);
      this.events.onHoleshot?.(null);
    } else this.events.onHoleshot?.(best);
  }

  private stepPlayer(dt: number, input: BikeInput): void {
    this.prevBike = cloneBike(this.bike);

    if (this.state === 'countdown') {
      this.countdown -= dt;
      stepBike(this.bike, { throttle: 0, brake: 1, lean: 0, nitro: false }, this.track.terrain, dt);
      this.bike.x = this.track.startX;
      this.bike.vx = 0;
      // El motor se revoluciona en la parrilla (para el sonido y la pose).
      this.bike.throttle += (input.throttle - this.bike.throttle) * (1 - Math.exp(-dt * 9));
      this.revTime = input.throttle > 0.5 ? this.revTime + dt : 0;
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.sinceGo = 0;
        if (input.throttle > 0.5) this.resolveStart(this.revTime <= RACE.revWindow ? 'perfect' : 'spin');
      }
      return;
    }
    if (this.state === 'racing' && this.startKind === null) {
      this.sinceGo += dt;
      if (input.throttle > 0.5) this.resolveStart(this.sinceGo < 0.25 ? 'good' : 'late');
    }
    if (this.bogTimer > 0) {
      this.bogTimer -= dt;
      input = { ...input, throttle: 0.2 };
    }

    if (this.state === 'crashed') {
      this.crashTimer += dt;
      this.time += dt;
      if (this.mission.objective === 'storm') this.advanceStorm(dt);
      if (this.crashTimer >= RACE.crashFreeze) this.respawn();
      return;
    }
    if (this.state !== 'racing') return;

    this.time += dt;
    const wantsNitro = input.nitro && this.nitro > 0;
    this.nitroActive = wantsNitro;
    if (wantsNitro) this.nitro = Math.max(0, this.nitro - RACE.nitroDrain * dt);

    const wasAirborne = isAirborne(this.bike);
    const ev = stepBike(this.bike, { ...input, nitro: wantsNitro }, this.track.terrain, dt);
    const nowAirborne = isAirborne(this.bike);

    if (nowAirborne) {
      if (!wasAirborne) {
        this.airTime = 0;
        this.airRotation = 0;
        this.airStartAngle = this.prevBike.angle;
        this.events.onTakeoff?.();
      }
      this.airTime += dt;
      this.airRotation += angleDiff(this.bike.angle, this.prevBike.angle);
    } else if (wasAirborne) {
      this.land();
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Caidas.
    if (crashCheck(this.track, this.bike, ev.headHit, dt, this.upside)) return this.crash();

    // Checkpoints.
    const cps = this.track.checkpoints;
    while (this.lastCheckpoint + 1 < cps.length && this.bike.x >= cps[this.lastCheckpoint + 1]) {
      this.lastCheckpoint += 1;
      this.events.onCheckpoint?.(this.lastCheckpoint);
    }

    // Recogibles.
    this.track.pickups.forEach((pk, i) => {
      if (this.collected[i]) return;
      if (Math.hypot(pk.x - this.bike.x, pk.y - (this.bike.y + 0.5)) < RACE.pickupRadius) {
        this.collected[i] = true;
        if (pk.kind === 'plate') {
          this.platesCollected += 1;
          this.score += 300;
        } else {
          this.nitro = Math.min(RACE.nitroMax, this.nitro + 45);
        }
        this.events.onPickup?.(pk.kind);
      }
    });

    if (this.mission.objective === 'storm') {
      this.advanceStorm(dt);
      if (this.stormX >= this.bike.x - 0.8) return this.fail('La tormenta te ha alcanzado');
    }

    if (this.bike.x >= this.track.finishX) {
      this.state = 'finished';
      this.score += Math.max(0, Math.round((this.mission.medals.parTime - this.time) * 40));
      this.events.onFinish?.();
    }
  }

  private mark(kind: SectionMark): void {
    const secs = this.track.sections;
    let i = 0;
    for (let k = 0; k < secs.length; k++) if (this.bike.x >= secs[k].x) i = k;
    if (MARK_RANK[kind] > MARK_RANK[this.sectionMarks[i]]) this.sectionMarks[i] = kind;
  }

  private resolveStart(kind: StartKind): void {
    this.startKind = kind;
    const b = this.bike;
    if (kind === 'perfect') {
      const slope = Math.atan(this.track.terrain.slopeAt(b.x));
      b.vx += Math.cos(slope) * RACE.perfectStartBoost;
      b.vy += Math.sin(slope) * RACE.perfectStartBoost;
      b.rear.spinRate = b.vx / BIKE.wheelRadius;
      b.front.spinRate = b.vx / BIKE.wheelRadius;
    } else if (kind === 'spin') {
      // Demasiado tiempo a tope: la rueda patina y el motor se ahoga.
      this.bogTimer = 0.45;
      b.rear.spinRate = 60;
    }
    this.events.onStart?.(kind);
  }

  private advanceStorm(dt: number): void {
    const speed = Math.min(19.5, 13.5 + this.time * 0.1);
    this.stormX += speed * dt;
  }

  private land(): void {
    const slope = Math.atan(this.track.terrain.slopeAt(this.bike.x));
    const err = Math.abs(angleDiff(this.bike.angle, slope));
    const quality: LandingQuality = err < 0.2 ? 'PERFECT' : err < 0.42 ? 'GOOD' : 'ROUGH';
    const flips = Math.floor((Math.abs(this.airRotation) + 0.7) / (Math.PI * 2));
    const direction: 'back' | 'front' = this.airRotation >= 0 ? 'back' : 'front';
    this.maxAirTime = Math.max(this.maxAirTime, this.airTime);
    void this.airStartAngle;

    let points = 0;
    if (this.airTime > 0.6) points += Math.round(this.airTime * RACE.airPointsPerSecond);
    if (flips > 0) points += flips * RACE.flipPoints * (flips > 1 ? 1.5 : 1);
    if (quality === 'PERFECT' && this.airTime > 0.45) points += RACE.perfectPoints;

    const meaningful = flips > 0 || (quality === 'PERFECT' && this.airTime > 0.6);
    if (quality === 'ROUGH' && this.airTime > 0.3) this.mark('rough');
    else if (flips > 0) this.mark('flip');
    if (quality === 'ROUGH') {
      this.combo = 0;
      this.comboTimer = 0;
      // Aterrizar cruzado cuesta velocidad.
      if (this.airTime > 0.45) this.bike.vx *= 0.82;
    } else if (meaningful) {
      this.combo += 1;
      this.comboTimer = RACE.comboWindow;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    }
    const total = Math.round(points * (meaningful ? this.comboMultiplier : 1));
    this.score += total;
    if (flips > 0) {
      this.trickScore += total;
      this.flips += flips;
      this.nitro = Math.min(RACE.nitroMax, this.nitro + 30 * flips);
    }
    if (quality === 'PERFECT' && this.airTime > 0.45) {
      this.perfectLandings += 1;
      this.nitro = Math.min(RACE.nitroMax, this.nitro + 12);
      // PUMP: clavar la recepcion devuelve velocidad.
      const speed = Math.hypot(this.bike.vx, this.bike.vy);
      if (speed < BIKE.topSpeed + 4) {
        const t = { x: Math.cos(slope), y: Math.sin(slope) };
        this.bike.vx += t.x * RACE.pumpBoost;
        this.bike.vy += t.y * RACE.pumpBoost;
        this.bike.rear.spinRate += RACE.pumpBoost / BIKE.wheelRadius;
      }
    }
    if (this.airTime > 0.25 || flips > 0) {
      this.events.onLand?.({ flips, direction, airTime: this.airTime, quality, points: total, combo: this.combo });
    }
    this.airTime = 0;
    this.airRotation = 0;
  }

  private crash(): void {
    this.mark('crash');
    this.state = 'crashed';
    this.crashTimer = 0;
    this.crashes += 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.nitroActive = false;
    this.crashBike = cloneBike(this.bike);
    this.events.onCrash?.();
  }

  /** Coloca la moto en un checkpoint y sigue la carrera desde ahi. */
  startFromCheckpoint(index: number): void {
    this.lastCheckpoint = Math.max(0, Math.min(this.track.checkpoints.length - 1, index));
    this.respawn();
  }

  private respawn(): void {
    const x = this.track.checkpoints[this.lastCheckpoint];
    this.bike = createBike(this.track.terrain, x);
    for (let i = 0; i < 30; i++) stepBike(this.bike, { throttle: 0, brake: 1, lean: 0, nitro: false }, this.track.terrain, 1 / 120);
    this.bike.vx = 3;
    this.bike.rear.spinRate = 3 / BIKE.wheelRadius;
    this.bike.front.spinRate = 3 / BIKE.wheelRadius;
    this.prevBike = cloneBike(this.bike);
    this.crashBike = null;
    this.upside.t = 0;
    this.airTime = 0;
    this.airRotation = 0;
    if (this.mission.objective === 'storm') this.stormX = Math.min(this.stormX, x - RACE.stormRespawnGap);
    this.state = 'racing';
    this.events.onRespawn?.();
  }

  private fail(reason: string): void {
    this.state = 'failed';
    this.failReason = reason;
    this.events.onFail?.(reason);
  }
}
