/** Moving platform. Carries the player: `dx`/`dy` are read by Player.update. */
import { COLORS } from '../../config.js';
import { Entity, solid } from '../entity.js';
import { registerEntity } from '../registry.js';
import { pathPosition } from '../path.js';

class MovingPlatform extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 25;
    this.x0 = def.x;
    this.y0 = this.wy(def.y);
    this.w = def.w ?? 60;
    this.h = def.h ?? 12;
    this.path = def.path;
    this.t = def.t0 ?? 0;
    this.pos = { x: this.x0, y: this.y0 };
    this.solids.push(solid(this.x0, this.y0, this.w, this.h));
  }

  reset() {
    this.t = this.def.t0 ?? 0;
  }

  update(dt) {
    this.t += dt;
    const s = this.solids[0];
    const px = s.x;
    const py = s.y;
    pathPosition(this.path, this.x0, this.y0, this.t, this.pos);
    s.x = this.pos.x;
    s.y = this.pos.y;
    s.dx = s.x - px;
    s.dy = s.y - py;
  }

  draw(gfx) {
    const s = this.solids[0];
    gfx.roundRect(s.x, s.y, s.w, s.h, 3, COLORS.solid);
    gfx.rect(s.x + 2, s.y, s.w - 4, 3, '#4c7cff', 0.9);
    gfx.glowRect(s.x + 2, s.y, s.w - 4, 3, '#4c7cff', 0.3, 5);
    // Direction pips so the movement reads before it starts.
    gfx.rect(s.x + 5, s.y + s.h - 4, 4, 2, COLORS.solidTop, 0.8);
    gfx.rect(s.x + s.w - 9, s.y + s.h - 4, 4, 2, COLORS.solidTop, 0.8);
  }
}

registerEntity('platform', (def, ctx) => new MovingPlatform(def, ctx), { solid: true, moving: true });
export { MovingPlatform };
