/**
 * Patrolling drone. Lethal from the sides, stompable from above (dive or a
 * plain landing). Turns at the ends of its patrol segment and always faces
 * where it is going, so its next move is never a surprise.
 */
import { COLORS } from '../../config.js';
import { Entity, box } from '../entity.js';
import { registerEntity } from '../registry.js';

class Walker extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 43;
    this.w = def.w ?? 24;
    this.h = def.h ?? 22;
    this.x = def.x;
    this.y = this.wy(def.y);
    this.left = def.left ?? def.x - 50;
    this.right = def.right ?? def.x + 50;
    this.speed = def.speed ?? 52;
    this.dir = def.dir ?? 1;
    this.alive = true;
    this.t = 0;
    this.squash = 1;
    this.deathT = 0;
    this.hazards.push(box(this.x, this.y + 4, this.w, this.h - 4, 'enemy'));
    /** Stomp zone: landing on this kills the walker instead of the player. */
    this.stompBox = { x: this.x, y: this.y - 2, w: this.w, h: 8 };
  }

  reset() {
    this.alive = true;
    this.x = this.def.x;
    this.dir = this.def.dir ?? 1;
    this.hazards[0].active = true;
    this.squash = 1;
    this.deathT = 0;
  }

  stomp(ctx) {
    if (!this.alive) return false;
    this.alive = false;
    this.hazards[0].active = false;
    this.deathT = 0.35;
    ctx?.onWalkerStomp?.(this);
    return true;
  }

  update(dt) {
    this.t += dt;
    if (!this.alive) {
      this.deathT = Math.max(0, this.deathT - dt);
      this.squash = Math.max(0.15, this.squash - dt * 4);
      return;
    }
    this.x += this.speed * this.dir * dt;
    if (this.x <= this.left) { this.x = this.left; this.dir = 1; }
    if (this.x + this.w >= this.right) { this.x = this.right - this.w; this.dir = -1; }
    const hz = this.hazards[0];
    hz.x = this.x + 2;
    hz.y = this.y + 5;
    hz.w = this.w - 4;
    hz.h = this.h - 5;
    this.stompBox.x = this.x;
    this.stompBox.y = this.y - 3;
    this.stompBox.w = this.w;
  }

  draw(gfx) {
    if (!this.alive && this.deathT <= 0) return;
    const bob = this.alive ? Math.sin(this.t * 9) * 1.6 : 0;
    const h = this.h * this.squash;
    const y = this.y + (this.h - h) + bob;
    const alpha = this.alive ? 1 : Math.max(0, this.deathT / 0.35);
    gfx.roundRect(this.x, y, this.w, h, 5, '#6a1030', alpha);
    gfx.strokeRoundRect(this.x, y, this.w, h, 5, COLORS.danger, 1.5, alpha);
    gfx.glowRect(this.x, y, this.w, h, COLORS.danger, 0.24 * alpha, 5);
    // Eye looks where it walks.
    const ex = this.x + this.w / 2 + this.dir * 4;
    gfx.circle(ex, y + h * 0.45, 3.4, COLORS.danger, alpha);
    gfx.circle(ex + this.dir * 0.8, y + h * 0.45, 1.6, '#fff', alpha);
    // Legs
    if (this.alive) {
      const swing = Math.sin(this.t * 12) * 3;
      gfx.rect(this.x + 4, y + h, 4, 4 + swing, '#6a1030', alpha);
      gfx.rect(this.x + this.w - 8, y + h, 4, 4 - swing, '#6a1030', alpha);
    }
  }
}

registerEntity('walker', (def, ctx) => new Walker(def, ctx), { lethal: true, stompable: true });
export { Walker };
