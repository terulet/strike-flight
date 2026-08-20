/**
 * Crusher. Telegraphs (shudder + warning column), slams down fast, holds,
 * retracts slowly. Lethal on contact while slamming or held down; harmless
 * while parked at the top so it never feels like a random ceiling trap.
 */
import { COLORS } from '../../config.js';
import { Entity, box } from '../entity.js';
import { registerEntity } from '../registry.js';
import { clamp, easeInCubic, easeOutCubic } from '../../core/math.js';

const IDLE = 'idle';
const TELEGRAPH = 'telegraph';
const SLAM = 'slam';
const HOLD = 'hold';
const RETRACT = 'retract';

class Crusher extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 44;
    this.x = def.x;
    this.topY = this.wy(def.y);
    this.w = def.w ?? 70;
    this.h = def.h ?? 40;
    this.travel = def.travel ?? 150;
    this.idleTime = def.idleTime ?? 1.1;
    this.telegraphTime = def.telegraph ?? 0.42;
    this.slamTime = def.slamTime ?? 0.14;
    this.holdTime = def.holdTime ?? 0.32;
    this.retractTime = def.retractTime ?? 0.75;
    this.phase = IDLE;
    this.timer = def.t0 != null ? 0 : 0;
    this.offset = 0;
    this.shake = 0;
    this.justSlammed = false;
    this.hazards.push(box(this.x + 2, this.topY, this.w - 4, this.h, 'crush'));
    this.hazards[0].active = false;
    if (def.t0) this._advance(def.t0);
  }

  reset() {
    this.phase = IDLE;
    this.timer = 0;
    this.offset = 0;
    if (this.def.t0) this._advance(this.def.t0);
  }

  _advance(seconds) {
    // Fast-forward the state machine so `t0` staggers several crushers.
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) this.update(step, null);
  }

  update(dt, ctx) {
    this.justSlammed = false;
    this.timer += dt;
    if (this.phase === IDLE) {
      if (this.timer >= this.idleTime) { this.phase = TELEGRAPH; this.timer = 0; }
    } else if (this.phase === TELEGRAPH) {
      this.shake = clamp(this.timer / this.telegraphTime, 0, 1);
      if (this.timer >= this.telegraphTime) { this.phase = SLAM; this.timer = 0; }
    } else if (this.phase === SLAM) {
      this.offset = easeInCubic(clamp(this.timer / this.slamTime, 0, 1)) * this.travel;
      if (this.timer >= this.slamTime) {
        this.phase = HOLD;
        this.timer = 0;
        this.offset = this.travel;
        this.justSlammed = true;
        ctx?.onCrusherSlam?.(this);
      }
    } else if (this.phase === HOLD) {
      if (this.timer >= this.holdTime) { this.phase = RETRACT; this.timer = 0; }
    } else {
      const k = clamp(this.timer / this.retractTime, 0, 1);
      this.offset = (1 - easeOutCubic(k)) * this.travel;
      if (k >= 1) { this.phase = IDLE; this.timer = 0; this.offset = 0; this.shake = 0; }
    }

    const hz = this.hazards[0];
    hz.y = this.topY + this.offset;
    hz.active = this.phase === SLAM || this.phase === HOLD || (this.phase === RETRACT && this.offset > 6);
  }

  draw(gfx) {
    const y = this.topY + this.offset;
    const sh = this.phase === TELEGRAPH ? Math.sin(this.timer * 60) * 2 * this.shake : 0;

    // Danger column: shows exactly where the block will land.
    const colTop = y + this.h;
    const colH = this.topY + this.travel + this.h - colTop;
    if (colH > 0) {
      const active = this.phase === TELEGRAPH;
      gfx.rect(this.x + 3, colTop, this.w - 6, colH, active ? COLORS.warn : COLORS.danger, active ? 0.13 + this.shake * 0.14 : 0.05);
    }

    // Guide rails
    gfx.rect(this.x - 3, this.topY - 200, 3, 200 + this.travel + this.h, '#141a2c', 0.9);
    gfx.rect(this.x + this.w, this.topY - 200, 3, 200 + this.travel + this.h, '#141a2c', 0.9);

    gfx.roundRect(this.x + sh, y, this.w, this.h, 4, '#2b2033');
    gfx.rect(this.x + sh + 3, y + this.h - 7, this.w - 6, 7, COLORS.danger, 0.95);
    gfx.glowRect(this.x + sh + 3, y + this.h - 7, this.w - 6, 7, COLORS.danger, this.phase === SLAM || this.phase === HOLD ? 0.7 : 0.3, 7);
    // Teeth on the bottom face
    const teeth = Math.max(3, Math.round(this.w / 14));
    for (let i = 0; i < teeth; i++) {
      const tx = this.x + sh + 4 + (i * (this.w - 8)) / teeth;
      gfx.rect(tx, y + this.h, (this.w - 8) / teeth - 2, 4, COLORS.danger, 0.9);
    }
    // Hazard-stripe face
    const g = gfx.ctx;
    g.save();
    g.beginPath();
    g.rect(this.x + sh + 4, y + 5, this.w - 8, this.h - 14);
    g.clip();
    g.globalAlpha = 0.5;
    for (let i = -this.h; i < this.w; i += 14) {
      g.fillStyle = COLORS.warn;
      g.beginPath();
      g.moveTo(this.x + sh + i, y + this.h);
      g.lineTo(this.x + sh + i + 7, y + this.h);
      g.lineTo(this.x + sh + i + 7 + this.h, y);
      g.lineTo(this.x + sh + i + this.h, y);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.globalAlpha = 1;
  }
}

registerEntity('crusher', (def, ctx) => new Crusher(def, ctx), { lethal: true, cyclic: true });
export { Crusher, IDLE, TELEGRAPH, SLAM, HOLD, RETRACT };
