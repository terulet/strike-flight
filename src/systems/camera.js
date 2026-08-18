/**
 * Camera: rides the tower. Rooms are stacked in world space, so ascending is
 * literally a vertical pan — no loading screens, one continuous shaft.
 */
import { ROOM, VIEW, FEEL } from '../config.js';
import { clamp, damp, easeInOutCubic } from '../core/math.js';

/** World Y of a room's top edge. Floor 1 sits at y = 0 and the tower grows upwards. */
export const roomTopY = (floorIndex) => -(floorIndex - 1) * ROOM.H;

export class Camera {
  constructor() {
    this.y = 0;
    this.targetY = 0;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.panFrom = 0;
    this.panTo = 0;
    this.panT = 1;
    this.panDur = FEEL.TRANSITION_TIME;
    this._shakeSeed = 1;
  }

  /** Centers the given floor's room in the viewport. */
  focusFloor(floorIndex, instant = true) {
    const top = roomTopY(floorIndex);
    const y = top + ROOM.H / 2 - VIEW.H / 2;
    this.targetY = y;
    if (instant) {
      this.y = y;
      this.panT = 1;
      this.panFrom = y;
      this.panTo = y;
    } else {
      this.panFrom = this.y;
      this.panTo = y;
      this.panT = 0;
    }
  }

  addShake(amount) {
    this.shake = Math.min(FEEL.SHAKE_MAX, this.shake + amount);
  }

  update(dt, rawDt) {
    if (this.panT < 1) {
      this.panT = clamp(this.panT + rawDt / this.panDur, 0, 1);
      this.y = this.panFrom + (this.panTo - this.panFrom) * easeInOutCubic(this.panT);
    } else {
      this.y = damp(this.y, this.targetY, 9, dt || rawDt);
    }

    if (this.shake > 0.05) {
      // Deterministic-ish noise; no allocations, no Math.random in the sim.
      this._shakeSeed = (this._shakeSeed * 1664525 + 1013904223) >>> 0;
      const a = ((this._shakeSeed >>> 16) / 65535) * Math.PI * 2;
      this.shakeX = Math.cos(a) * this.shake;
      this.shakeY = Math.sin(a) * this.shake * 0.8;
      this.shake = Math.max(0, this.shake - this.shake * FEEL.SHAKE_DECAY * rawDt - 0.6 * rawDt);
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }

    this.offsetX = this.shakeX;
    this.offsetY = this.y + this.shakeY;
  }

  get panning() {
    return this.panT < 1;
  }
}
