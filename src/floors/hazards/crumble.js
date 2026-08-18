/**
 * Crumbling tile. Solid until stepped on, then cracks (telegraph), falls, and
 * respawns in place. A dive smashes it instantly.
 */
import { COLORS } from '../../config.js';
import { Entity, solid } from '../entity.js';
import { registerEntity } from '../registry.js';
import { clamp } from '../../core/math.js';

const IDLE = 0;
const CRACKING = 1;
const FALLING = 2;
const GONE = 3;

class Crumble extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 24;
    this.x = def.x;
    this.y = this.wy(def.y);
    this.w = def.w ?? 46;
    this.h = def.h ?? 14;
    this.delay = def.delay ?? 0.34;
    this.respawn = def.respawn ?? 1.7;
    this.state = IDLE;
    this.timer = 0;
    this.fallY = 0;
    this.fallV = 0;
    this.shake = 0;
    this.alpha = 1;
    this.solids.push(solid(this.x, this.y, this.w, this.h));
  }

  reset() {
    this.state = IDLE;
    this.timer = 0;
    this.fallY = 0;
    this.fallV = 0;
    this.alpha = 1;
    this.solids.length = 1;
    this.solids[0].x = this.x;
    this.solids[0].y = this.y;
    this.solids[0].dx = 0;
    this.solids[0].dy = 0;
  }

  /** Called by the room when the player is standing on this tile. */
  touch(hard = false) {
    if (this.state !== IDLE) return false;
    this.state = CRACKING;
    this.timer = hard ? 0.05 : this.delay;
    return true;
  }

  update(dt, ctx) {
    const s = this.solids[0];
    if (this.state === CRACKING) {
      this.timer -= dt;
      this.shake = clamp(1 - this.timer / this.delay, 0, 1);
      s.x = this.x + (Math.sin(this.timer * 70) * 1.6 * this.shake);
      s.dx = 0;
      s.dy = 0;
      if (this.timer <= 0) {
        this.state = FALLING;
        this.fallV = 40;
        this.timer = 0;
        ctx?.onCrumbleBreak?.(this);
        // Stop being solid the moment it lets go.
        this.solids.length = 0;
      }
    } else if (this.state === FALLING) {
      this.fallV += 1500 * dt;
      this.fallY += this.fallV * dt;
      this.alpha = Math.max(0, 1 - this.fallY / 190);
      if (this.alpha <= 0) {
        this.state = GONE;
        this.timer = this.respawn;
      }
    } else if (this.state === GONE) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = IDLE;
        this.alpha = 1;
        this.fallY = 0;
        this.fallV = 0;
        this.solids.length = 0;
        this.solids.push(solid(this.x, this.y, this.w, this.h));
      }
    }
  }

  draw(gfx) {
    if (this.state === GONE) {
      // Ghost outline so the player can plan the loop back.
      const t = 1 - this.timer / this.respawn;
      gfx.strokeRoundRect(this.x, this.y, this.w, this.h, 3, COLORS.solidTop, 1, 0.12 + t * 0.3);
      return;
    }
    const s = this.solids[0];
    const x = s ? s.x : this.x;
    const y = (s ? s.y : this.y) + this.fallY;
    const warn = this.state === CRACKING;
    gfx.roundRect(x, y, this.w, this.h, 3, warn ? '#3a2a1c' : COLORS.solid, this.alpha);
    gfx.rect(x, y, this.w, 3, warn ? COLORS.warn : COLORS.solidTop, this.alpha);
    // Cracks
    const g = gfx.ctx;
    g.globalAlpha = this.alpha * (warn ? 0.95 : 0.5);
    g.strokeStyle = warn ? COLORS.warn : '#0b1020';
    g.lineWidth = warn ? 1.6 : 1;
    g.beginPath();
    g.moveTo(x + this.w * 0.2, y + 2);
    g.lineTo(x + this.w * 0.34, y + this.h - 2);
    g.moveTo(x + this.w * 0.62, y + 1);
    g.lineTo(x + this.w * 0.5, y + this.h - 1);
    g.lineTo(x + this.w * 0.78, y + this.h - 4);
    g.stroke();
    g.globalAlpha = 1;
    if (warn) gfx.glowRect(x, y, this.w, this.h, COLORS.warn, 0.3 + this.shake * 0.4, 5);
  }
}

registerEntity('crumble', (def, ctx) => new Crumble(def, ctx), { solid: true, breakable: true });
export { Crumble, IDLE, CRACKING, FALLING, GONE };
