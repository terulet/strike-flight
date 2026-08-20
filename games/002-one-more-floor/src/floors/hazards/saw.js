/** Spinning blade. Follows a declarative path; lethal at all times. */
import { COLORS } from '../../config.js';
import { Entity, circle } from '../entity.js';
import { registerEntity } from '../registry.js';
import { pathPosition, toWorldPath } from '../path.js';

class Saw extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 45;
    this.x0 = def.x;
    this.y0 = this.wy(def.y);
    this.r = def.r ?? 18;
    this.path = toWorldPath(def.path, this.originY);
    this.t = def.t0 ?? 0;
    this.spin = 0;
    this.pos = { x: this.x0, y: this.y0 };
    // Blade hitbox is 4px smaller than the drawn disc: teeth graze, not kill.
    this.hazards.push(circle(this.x0, this.y0, Math.max(4, this.r - 4), 'saw'));
  }

  reset() {
    this.t = this.def.t0 ?? 0;
  }

  update(dt) {
    this.t += dt;
    pathPosition(this.path, this.x0, this.y0, this.t, this.pos);
    this.spin += dt * 15;
    const h = this.hazards[0];
    h.x = this.pos.x;
    h.y = this.pos.y;
  }

  draw(gfx) {
    const { x, y } = this.pos;
    const g = gfx.ctx;
    gfx.glowCircle(x, y, this.r, COLORS.danger, 0.4, 7);
    g.save();
    g.translate(x, y);
    g.rotate(this.spin);
    // Teeth
    g.fillStyle = COLORS.danger;
    const teeth = 8;
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      g.lineTo(Math.cos(a0) * this.r, Math.sin(a0) * this.r);
      g.lineTo(Math.cos(a1) * this.r * 0.72, Math.sin(a1) * this.r * 0.72);
    }
    g.closePath();
    g.fill();
    g.fillStyle = '#2a0d16';
    g.beginPath();
    g.arc(0, 0, this.r * 0.42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.dangerSoft;
    g.fillRect(-this.r * 0.5, -1.5, this.r, 3);
    g.restore();
  }
}

registerEntity('saw', (def, ctx) => new Saw(def, ctx), { lethal: true });
export { Saw };
