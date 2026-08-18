/**
 * Two doors, one way out.
 *
 * Fairness rule (constant for the whole game, taught on floor 6):
 *   GREEN LAMP + open frame  = the way up
 *   RED LAMP  + barred frame = the trap
 *
 * The choice is seeded from the floor number, so the same floor always has
 * the same answer — the player is reading a sign, never gambling.
 */
import { COLORS } from '../../config.js';
import { Entity, box } from '../entity.js';
import { registerEntity } from '../registry.js';
import { aabb } from '../../core/math.js';

class Doors extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 28;
    this.w = def.w ?? 34;
    this.h = def.h ?? 44;
    this.slots = (def.slots || []).map((s) => ({
      x: s.x,
      y: this.wy(s.y),
      w: s.w ?? this.w,
      h: s.h ?? this.h,
    }));
    const n = this.slots.length || 1;
    this.safeIndex = def.forceSafe != null
      ? Math.min(def.forceSafe, n - 1)
      : (ctx.rng ? ctx.rng.int(0, n - 1) : 0);
    this.t = 0;
    this.slots.forEach((s, i) => {
      if (i === this.safeIndex) return;
      // Trap doors bite only in their inner half: brushing the frame is safe.
      this.hazards.push(box(s.x + 7, s.y + 6, s.w - 14, s.h - 6, 'shock', { slot: i }));
    });
  }

  get exitSlot() {
    return this.slots[this.safeIndex];
  }

  /** Room asks this to decide whether the floor is cleared. */
  containsExit(px, py, pw, ph) {
    const s = this.exitSlot;
    if (!s) return false;
    return aabb(px, py, pw, ph, s.x + 6, s.y + 4, s.w - 12, s.h - 4);
  }

  update(dt) {
    this.t += dt;
  }

  draw(gfx) {
    const g = gfx.ctx;
    this.slots.forEach((s, i) => {
      const safe = i === this.safeIndex;
      const col = safe ? COLORS.exit : COLORS.danger;
      const pulse = 0.55 + Math.sin(this.t * (safe ? 5 : 3)) * 0.25;

      // Frame
      gfx.rect(s.x - 4, s.y - 6, s.w + 8, s.h + 6, '#161c2e');
      gfx.strokeRoundRect(s.x - 4, s.y - 6, s.w + 8, s.h + 6, 4, safe ? '#2f4a3a' : '#4a2030', 2, 1);

      // Interior
      if (safe) {
        const grad = g.createLinearGradient(0, s.y + s.h, 0, s.y);
        grad.addColorStop(0, 'rgba(124,255,155,0.45)');
        grad.addColorStop(1, 'rgba(124,255,155,0.05)');
        g.fillStyle = grad;
        g.fillRect(s.x, s.y, s.w, s.h);
        gfx.glowRect(s.x, s.y, s.w, s.h, COLORS.exit, 0.28 + pulse * 0.2, 8);
        for (let k = 0; k < 2; k++) {
          const off = ((this.t * 24 + k * 18) % 36);
          gfx.line(s.x + 8, s.y + s.h - off, s.x + s.w / 2, s.y + s.h - off - 7, COLORS.exit, 2, 0.5);
          gfx.line(s.x + s.w / 2, s.y + s.h - off - 7, s.x + s.w - 8, s.y + s.h - off, COLORS.exit, 2, 0.5);
        }
      } else {
        gfx.rect(s.x, s.y, s.w, s.h, '#12080f');
        // Bars + arcing electricity: unmistakably "not this one".
        for (let k = 0; k < 4; k++) {
          const bx = s.x + 4 + k * ((s.w - 8) / 3.4);
          gfx.rect(bx, s.y + 2, 3, s.h - 4, '#43101f');
        }
        const arc = Math.sin(this.t * 9 + i) > 0.4;
        if (arc) {
          gfx.line(s.x + 6, s.y + s.h * 0.4, s.x + s.w - 6, s.y + s.h * 0.55, COLORS.danger, 1.6, 0.8);
          gfx.line(s.x + 8, s.y + s.h * 0.7, s.x + s.w - 8, s.y + s.h * 0.6, COLORS.dangerSoft, 1.2, 0.6);
        }
        gfx.glowRect(s.x, s.y, s.w, s.h, COLORS.danger, 0.16, 6);
      }

      // Lamp above the frame — the actual tell.
      const lx = s.x + s.w / 2;
      const ly = s.y - 12;
      gfx.rect(lx - 7, ly - 3, 14, 7, '#0e1322');
      gfx.circle(lx, ly + 0.5, 3.2, col, safe ? 0.65 + pulse * 0.35 : 0.85);
      if (safe) gfx.glowCircle(lx, ly + 0.5, 3.2, col, 0.5 + pulse * 0.5, 6);
    });
  }
}

registerEntity('doors', (def, ctx) => new Doors(def, ctx), { lethal: true, exit: true });
export { Doors };
