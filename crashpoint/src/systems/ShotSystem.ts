import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { ProjectileId, Vec2 } from '../core/types';
import { MAX_SHOTS } from './ScoreSystem';

const MIN_DRAG = 18; // px — ignore tiny/accidental taps
const MAX_DRAG = 260; // px — drag distance at 100% power
const MIN_SPEED = 11;
const MAX_SPEED = 34;
const GRAVITY_ACCEL = 2600; // px/s^2 — approximation for the *preview* only, not the real sim (section 10)
const PREVIEW_STEPS = 13;
const PREVIEW_DT = 0.045;

export const PROJECTILE_ORDER: ProjectileId[] = ['impact_core', 'drill_spike', 'pulse_orb'];

/** Owns aim/power/projectile-selection state. Never touches Matter directly — Game spawns on `shot_fired`. */
export class ShotSystem {
  selected: ProjectileId = 'impact_core';
  shotsRemaining = MAX_SHOTS;
  aiming = false;
  private origin: Vec2;
  private dragVector: Vec2 = { x: 0, y: 0 };

  constructor(origin: Vec2, private bus: EventBus<GameEvents>) {
    this.origin = origin;
  }

  selectProjectile(id: ProjectileId): void {
    if (this.shotsRemaining <= 0) return;
    this.selected = id;
  }

  startAim(pointer: Vec2): void {
    if (this.shotsRemaining <= 0) return;
    this.aiming = true;
    this.dragVector = { x: 0, y: 0 };
    this.bus.emit('shot_aim_start', { projectile: this.selected });
    this.updateAim(pointer);
  }

  updateAim(pointer: Vec2): void {
    if (!this.aiming) return;
    this.dragVector = { x: pointer.x - this.origin.x, y: pointer.y - this.origin.y };
  }

  cancelAim(): void {
    this.aiming = false;
    this.dragVector = { x: 0, y: 0 };
  }

  /** Current aim as a normalized {direction, power 0..1}, or null if the drag is too small to count. */
  private computeAim(): { dir: Vec2; power: number } | null {
    const len = Math.hypot(this.dragVector.x, this.dragVector.y);
    if (len < MIN_DRAG) return null;
    const clamped = Math.min(len, MAX_DRAG);
    return { dir: { x: this.dragVector.x / len, y: this.dragVector.y / len }, power: clamped / MAX_DRAG };
  }

  getPower(): number {
    return this.computeAim()?.power ?? 0;
  }

  /** Limited predictive arc (section 10: helps aim, doesn't reveal the exact impact point). */
  getTrajectoryPreview(): Vec2[] | null {
    if (!this.aiming) return null;
    const aim = this.computeAim();
    if (!aim) return null;
    const speed = MIN_SPEED + aim.power * (MAX_SPEED - MIN_SPEED);
    const vx = aim.dir.x * speed * 60;
    const vy = aim.dir.y * speed * 60;
    const points: Vec2[] = [];
    for (let i = 1; i <= PREVIEW_STEPS; i++) {
      const t = i * PREVIEW_DT;
      points.push({
        x: this.origin.x + vx * t,
        y: this.origin.y + vy * t + 0.5 * GRAVITY_ACCEL * t * t,
      });
    }
    return points;
  }

  /** Releases the shot. Returns the launch data so Game can spawn the physics body, or null if the drag was too small. */
  fire(): { projectile: ProjectileId; origin: Vec2; velocity: Vec2 } | null {
    if (!this.aiming || this.shotsRemaining <= 0) return null;
    const aim = this.computeAim();
    this.aiming = false;
    if (!aim) return null;

    const speed = MIN_SPEED + aim.power * (MAX_SPEED - MIN_SPEED);
    const velocity: Vec2 = { x: aim.dir.x * speed, y: aim.dir.y * speed };
    const shotIndex = MAX_SHOTS - this.shotsRemaining;
    this.shotsRemaining -= 1;

    this.bus.emit('shot_fired', { projectile: this.selected, shotIndex, origin: this.origin, velocity });
    this.bus.emit('shots_changed', { remaining: this.shotsRemaining });

    return { projectile: this.selected, origin: this.origin, velocity };
  }

  reset(): void {
    this.selected = 'impact_core';
    this.shotsRemaining = MAX_SHOTS;
    this.aiming = false;
    this.dragVector = { x: 0, y: 0 };
  }
}
