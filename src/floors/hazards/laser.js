/**
 * Laser gate. Cycle: OFF -> CHARGE (visible thin telegraph beam + hum) -> ON.
 * The telegraph is non-negotiable: a beam that appears without warning is the
 * definition of an unfair death.
 */
import { COLORS } from '../../config.js';
import { Entity, box } from '../entity.js';
import { registerEntity } from '../registry.js';

class Laser extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 46;
    this.orient = def.orient || 'h'; // 'h' beam runs horizontally
    this.x = def.x;
    this.y = this.wy(def.y);
    this.len = def.len ?? 200;
    this.thickness = def.thickness ?? 8;
    this.onTime = def.onTime ?? 0.9;
    this.offTime = def.offTime ?? 1.1;
    this.charge = def.charge ?? 0.45;
    this.t = (def.t0 ?? 0);
    this.cycle = this.onTime + this.offTime + this.charge;
    this.phase = 'off';
    this.k = 0; // 0..1 within current phase
    const hw = this.orient === 'h' ? this.len : this.thickness;
    const hh = this.orient === 'h' ? this.thickness : this.len;
    this.hazards.push(box(this.x, this.y, hw, hh, 'laser'));
    this.hazards[0].active = false;
  }

  reset() {
    this.t = this.def.t0 ?? 0;
  }

  update(dt) {
    this.t = (this.t + dt) % this.cycle;
    if (this.t < this.offTime) {
      this.phase = 'off';
      this.k = this.t / this.offTime;
    } else if (this.t < this.offTime + this.charge) {
      this.phase = 'charge';
      this.k = (this.t - this.offTime) / this.charge;
    } else {
      this.phase = 'on';
      this.k = (this.t - this.offTime - this.charge) / this.onTime;
    }
    this.hazards[0].active = this.phase === 'on';
  }

  draw(gfx) {
    const horiz = this.orient === 'h';
    const w = horiz ? this.len : this.thickness;
    const h = horiz ? this.thickness : this.len;
    const cx = this.x + w / 2;
    const cy = this.y + h / 2;

    // Emitters at both ends — always visible so the gate is readable when off.
    const emit = (ex, ey) => {
      gfx.roundRect(ex - 5, ey - 7, 10, 14, 2, '#2a2f45');
      gfx.rect(ex - 3, ey - 4, 6, 8, this.phase === 'on' ? COLORS.laser : this.phase === 'charge' ? COLORS.warn : '#4a5270');
    };
    if (horiz) {
      emit(this.x - 2, cy);
      emit(this.x + this.len + 2, cy);
    } else {
      emit(cx, this.y - 2);
      emit(cx, this.y + this.len + 2);
    }

    if (this.phase === 'off') {
      // Dotted sight-line: you can always see where the beam will be.
      const g = gfx.ctx;
      g.globalAlpha = 0.22;
      g.strokeStyle = COLORS.laser;
      g.lineWidth = 1;
      g.setLineDash([3, 6]);
      g.beginPath();
      if (horiz) {
        g.moveTo(this.x, cy);
        g.lineTo(this.x + this.len, cy);
      } else {
        g.moveTo(cx, this.y);
        g.lineTo(cx, this.y + this.len);
      }
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      return;
    }

    if (this.phase === 'charge') {
      const t = this.k;
      const th = 1 + t * 2;
      if (horiz) {
        gfx.rect(this.x, cy - th / 2, this.len, th, COLORS.warn, 0.4 + t * 0.5);
        gfx.glowRect(this.x, cy - th / 2, this.len, th, COLORS.warn, 0.2 + t * 0.5, 4);
      } else {
        gfx.rect(cx - th / 2, this.y, th, this.len, COLORS.warn, 0.4 + t * 0.5);
        gfx.glowRect(cx - th / 2, this.y, th, this.len, COLORS.warn, 0.2 + t * 0.5, 4);
      }
      return;
    }

    // ON
    const flick = 0.92 + Math.sin(this.t * 60) * 0.08;
    gfx.rect(this.x, this.y, w, h, COLORS.laser, flick);
    const coreInset = horiz ? this.thickness * 0.3 : 0;
    if (horiz) gfx.rect(this.x, this.y + coreInset, w, h - coreInset * 2, '#fff', 0.55 * flick);
    else gfx.rect(this.x + this.thickness * 0.3, this.y, w - this.thickness * 0.6, h, '#fff', 0.55 * flick);
    gfx.glowRect(this.x, this.y, w, h, COLORS.laser, 0.75, 10);
  }
}

registerEntity('laser', (def, ctx) => new Laser(def, ctx), { lethal: true, cyclic: true });
export { Laser };
