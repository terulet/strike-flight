/** Static geometry: blocks, one-way platforms and the exit pad. */
import { COLORS, ROOM } from '../../config.js';
import { Entity, solid, box } from '../entity.js';
import { registerEntity } from '../registry.js';
import { aabb } from '../../core/math.js';

class Block extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = def.layer ?? 20;
    this.solids.push(solid(def.x, this.wy(def.y), def.w, def.h, { oneWay: !!def.oneWay }));
  }

  draw(gfx, _ctx) {
    const s = this.solids[0];
    if (s.oneWay) {
      gfx.rect(s.x, s.y, s.w, 5, COLORS.solidTop, 0.95);
      gfx.rect(s.x, s.y + 5, s.w, s.h - 5, COLORS.solid, 0.55);
    } else {
      gfx.rect(s.x, s.y, s.w, s.h, COLORS.solid);
      gfx.rect(s.x, s.y, s.w, 3, COLORS.solidTop);
      gfx.rect(s.x, s.y + s.h - 1, s.w, 1, '#0a0e18', 0.8);
    }
  }
}

class ExitPad extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 30;
    this.w = def.w ?? 34;
    this.h = def.h ?? 8;
    this.x = def.x;
    this.y = this.wy(def.y);
    this.t = 0;
    this.reached = false;
  }

  update(dt) {
    this.t += dt;
  }

  /** Touch test performed by the room (not a hazard, so it lives here). */
  contains(px, py, pw, ph) {
    return aabb(px, py, pw, ph, this.x - 4, this.y - 26, this.w + 8, this.h + 30);
  }

  draw(gfx, _ctx) {
    const pulse = 0.55 + Math.sin(this.t * 5) * 0.25;
    // Beam of light rising through the hatch above.
    const g = gfx.ctx;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.13 + pulse * 0.1;
    const grad = g.createLinearGradient(0, this.y - 120, 0, this.y + this.h);
    grad.addColorStop(0, 'rgba(124,255,155,0)');
    grad.addColorStop(1, COLORS.exit);
    g.fillStyle = grad;
    g.fillRect(this.x - 3, this.y - 120, this.w + 6, 120 + this.h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;

    gfx.roundRect(this.x, this.y, this.w, this.h, 3, COLORS.exit, 0.95);
    gfx.glowRect(this.x, this.y, this.w, this.h, COLORS.exit, 0.55 + pulse * 0.4, 9);
    // Chevrons pointing up: "this way".
    for (let i = 0; i < 2; i++) {
      const off = ((this.t * 26 + i * 16) % 32) - 6;
      const cy = this.y - off;
      const a = Math.max(0, 1 - off / 26) * 0.65;
      gfx.line(this.x + 7, cy, this.x + this.w / 2, cy - 7, COLORS.exit, 2, a);
      gfx.line(this.x + this.w / 2, cy - 7, this.x + this.w - 7, cy, COLORS.exit, 2, a);
    }
  }
}

class Spikes extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 35;
    this.dirName = def.dir || 'up'; // up = spikes point up (floor spikes)
    this.x = def.x;
    this.y = this.wy(def.y);
    this.w = def.w ?? 40;
    this.h = def.h ?? 12;
    // Hitbox is a little shorter than the drawn spikes: grazing a tip forgives.
    const inset = 3;
    if (this.dirName === 'up') {
      this.hazards.push(box(this.x + 1, this.y + inset, this.w - 2, this.h - inset, 'spike'));
    } else if (this.dirName === 'down') {
      this.hazards.push(box(this.x + 1, this.y, this.w - 2, this.h - inset, 'spike'));
    } else if (this.dirName === 'left') {
      this.hazards.push(box(this.x, this.y + 1, this.w - inset, this.h - 2, 'spike'));
    } else {
      this.hazards.push(box(this.x + inset, this.y + 1, this.w - inset, this.h - 2, 'spike'));
    }
  }

  draw(gfx, _ctx) {
    const g = gfx.ctx;
    const teeth = Math.max(2, Math.round((this.dirName === 'up' || this.dirName === 'down' ? this.w : this.h) / 10));
    g.fillStyle = COLORS.danger;
    g.globalAlpha = 1;
    g.beginPath();
    if (this.dirName === 'up' || this.dirName === 'down') {
      const step = this.w / teeth;
      for (let i = 0; i < teeth; i++) {
        const x = this.x + i * step;
        if (this.dirName === 'up') {
          g.moveTo(x, this.y + this.h);
          g.lineTo(x + step / 2, this.y);
          g.lineTo(x + step, this.y + this.h);
        } else {
          g.moveTo(x, this.y);
          g.lineTo(x + step / 2, this.y + this.h);
          g.lineTo(x + step, this.y);
        }
      }
    } else {
      const step = this.h / teeth;
      for (let i = 0; i < teeth; i++) {
        const y = this.y + i * step;
        if (this.dirName === 'left') {
          g.moveTo(this.x + this.w, y);
          g.lineTo(this.x, y + step / 2);
          g.lineTo(this.x + this.w, y + step);
        } else {
          g.moveTo(this.x, y);
          g.lineTo(this.x + this.w, y + step / 2);
          g.lineTo(this.x, y + step);
        }
      }
    }
    g.fill();
    gfx.glowRect(this.x, this.y, this.w, this.h, COLORS.danger, 0.32, 5);
    // Base plate so spikes never look like they float.
    if (this.dirName === 'up') gfx.rect(this.x, this.y + this.h - 3, this.w, 3, '#5c1526');
    if (this.dirName === 'down') gfx.rect(this.x, this.y, this.w, 3, '#5c1526');
  }
}

registerEntity('block', (def, ctx) => new Block(def, ctx), { solid: true });
registerEntity('oneway', (def, ctx) => new Block({ ...def, oneWay: true }, ctx), { solid: true });
registerEntity('exit', (def, ctx) => new ExitPad(def, ctx), { exit: true });
registerEntity('spikes', (def, ctx) => new Spikes(def, ctx), { lethal: true });

export { Block, ExitPad, Spikes };
export const DEFAULT_EXIT = { x: ROOM.W - 60, y: ROOM.H - ROOM.SLAB - 8, w: 34, h: 8 };
