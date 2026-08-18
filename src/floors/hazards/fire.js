/**
 * Flame jet. Pilot light -> sparks (telegraph) -> flame column -> fade.
 * Direction can be up (floor vent) or down (ceiling vent).
 */
import { COLORS } from '../../config.js';
import { Entity, box } from '../entity.js';
import { registerEntity } from '../registry.js';
import { clamp } from '../../core/math.js';

class Fire extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 47;
    this.x = def.x;
    this.y = this.wy(def.y);
    this.w = def.w ?? 24;
    this.len = def.len ?? 110;
    this.dirName = def.dir || 'up';
    this.idleTime = def.idleTime ?? 1.2;
    this.warnTime = def.warn ?? 0.4;
    this.burnTime = def.burn ?? 0.75;
    this.t = def.t0 ?? 0;
    this.cycle = this.idleTime + this.warnTime + this.burnTime;
    this.phase = 'idle';
    this.k = 0;
    this.height = 0;
    this.hazards.push(box(this.x + 3, this.y, this.w - 6, 1, 'fire'));
    this.hazards[0].active = false;
  }

  reset() { this.t = this.def.t0 ?? 0; }

  update(dt) {
    this.t = (this.t + dt) % this.cycle;
    if (this.t < this.idleTime) {
      this.phase = 'idle';
      this.k = this.t / this.idleTime;
      this.height = 0;
    } else if (this.t < this.idleTime + this.warnTime) {
      this.phase = 'warn';
      this.k = (this.t - this.idleTime) / this.warnTime;
      this.height = this.len * 0.12 * this.k;
    } else {
      this.phase = 'burn';
      this.k = (this.t - this.idleTime - this.warnTime) / this.burnTime;
      // Fast rise, slow fall.
      const shape = this.k < 0.18 ? this.k / 0.18 : 1 - clamp((this.k - 0.72) / 0.28, 0, 1);
      this.height = this.len * clamp(shape, 0, 1);
    }
    const hz = this.hazards[0];
    const active = this.phase === 'burn' && this.height > 8;
    hz.active = active;
    if (active) {
      const h = this.height - 5;
      hz.h = Math.max(1, h);
      hz.y = this.dirName === 'up' ? this.y - h : this.y;
    }
  }

  draw(gfx, ctx) {
    const g = gfx.ctx;
    const up = this.dirName === 'up';
    // Vent
    gfx.roundRect(this.x, up ? this.y - 2 : this.y - 4, this.w, 6, 2, '#2a2f45');
    for (let i = 0; i < 3; i++) gfx.rect(this.x + 4 + i * ((this.w - 8) / 3), up ? this.y - 1 : this.y - 3, 3, 4, '#151a2b');

    if (this.phase === 'idle' && this.k > 0.55) {
      // Pilot flicker: the vent announces itself before it matters.
      const a = (this.k - 0.55) / 0.45;
      gfx.circle(this.x + this.w / 2, this.y + (up ? -3 : 3), 2 + a, COLORS.warn, 0.4 + a * 0.4);
    }
    if (this.height <= 0.5) return;

    const time = ctx?.time ?? 0;
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const hh = this.height * (1 - t * 0.16);
      const ww = this.w * (1 - t * 0.34) * (0.9 + Math.sin(time * 22 + i) * 0.1);
      const x = this.x + (this.w - ww) / 2;
      const y = up ? this.y - hh : this.y;
      const col = i < 2 ? COLORS.fire : i < 4 ? '#ffb03a' : '#fff2c2';
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = this.phase === 'burn' ? 0.55 : 0.3;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x, up ? y + hh : y);
      g.quadraticCurveTo(x + ww * 0.5, up ? y - hh * 0.22 : y + hh * 1.22, x + ww, up ? y + hh : y);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
}

registerEntity('fire', (def, ctx) => new Fire(def, ctx), { lethal: true, cyclic: true });
export { Fire };
