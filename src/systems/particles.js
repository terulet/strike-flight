/**
 * Pooled particle system. Fixed-size typed arrays, zero allocation per burst,
 * so long sessions never trigger GC hitches mid-jump.
 */
import { COLORS } from '../config.js';

const MAX = 420;

export const Shape = { SQUARE: 0, CIRCLE: 1, SPARK: 2 };

export class Particles {
  constructor(max = MAX) {
    this.max = max;
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.shape = new Uint8Array(max);
    this.color = new Array(max).fill(COLORS.player);
    this.additive = new Uint8Array(max);
    this.count = 0;
    this.cursor = 0;
    this._seed = 12345;
  }

  _rand() {
    this._seed = (this._seed * 1664525 + 1013904223) >>> 0;
    return (this._seed >>> 8) / 16777216;
  }

  clear() {
    this.life.fill(0);
    this.count = 0;
    this.cursor = 0;
  }

  spawn(x, y, opts = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const life = opts.life ?? 0.4;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = opts.vx ?? 0;
    this.vy[i] = opts.vy ?? 0;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = opts.size ?? 3;
    this.rot[i] = opts.rot ?? 0;
    this.spin[i] = opts.spin ?? 0;
    this.grav[i] = opts.grav ?? 0;
    this.drag[i] = opts.drag ?? 1.5;
    this.shape[i] = opts.shape ?? Shape.SQUARE;
    this.color[i] = opts.color ?? COLORS.player;
    this.additive[i] = opts.additive ? 1 : 0;
    return i;
  }

  /** Radial burst. `spread` in radians around `dir`. */
  burst(x, y, n, {
    color = COLORS.player,
    speed = 90,
    speedVar = 60,
    dir = -Math.PI / 2,
    spread = Math.PI * 2,
    life = 0.45,
    lifeVar = 0.2,
    size = 3,
    sizeVar = 2,
    grav = 500,
    drag = 1.6,
    shape = Shape.SQUARE,
    additive = false,
  } = {}) {
    for (let k = 0; k < n; k++) {
      const a = dir + (this._rand() - 0.5) * spread;
      const sp = speed + this._rand() * speedVar;
      this.spawn(x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: life + this._rand() * lifeVar,
        size: size + this._rand() * sizeVar,
        spin: (this._rand() - 0.5) * 14,
        grav,
        drag,
        color,
        shape,
        additive,
      });
    }
  }

  update(dt) {
    if (dt <= 0) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const nl = l - dt;
      if (nl <= 0) {
        this.life[i] = 0;
        continue;
      }
      this.life[i] = nl;
      this.vy[i] += this.grav[i] * dt;
      const d = 1 - Math.min(0.98, this.drag[i] * dt);
      this.vx[i] *= d;
      this.vy[i] *= d;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      alive++;
    }
    this.count = alive;
  }

  draw(gfx) {
    const c = gfx.ctx;
    for (let pass = 0; pass < 2; pass++) {
      c.globalCompositeOperation = pass === 0 ? 'source-over' : 'lighter';
      for (let i = 0; i < this.max; i++) {
        const l = this.life[i];
        if (l <= 0) continue;
        if ((this.additive[i] === 1) !== (pass === 1)) continue;
        const t = l / this.maxLife[i];
        const s = this.size[i] * (0.35 + t * 0.65);
        c.globalAlpha = Math.min(1, t * 1.4);
        c.fillStyle = this.color[i];
        if (this.shape[i] === Shape.CIRCLE) {
          c.beginPath();
          c.arc(this.x[i], this.y[i], s * 0.5, 0, Math.PI * 2);
          c.fill();
        } else if (this.shape[i] === Shape.SPARK) {
          const vx = this.vx[i];
          const vy = this.vy[i];
          const len = Math.min(14, Math.hypot(vx, vy) * 0.045);
          const inv = 1 / (Math.hypot(vx, vy) || 1);
          c.strokeStyle = this.color[i];
          c.lineWidth = Math.max(1, s * 0.4);
          c.beginPath();
          c.moveTo(this.x[i], this.y[i]);
          c.lineTo(this.x[i] - vx * inv * len, this.y[i] - vy * inv * len);
          c.stroke();
        } else {
          const r = this.rot[i];
          if (r === 0) {
            c.fillRect(this.x[i] - s * 0.5, this.y[i] - s * 0.5, s, s);
          } else {
            c.save();
            c.translate(this.x[i], this.y[i]);
            c.rotate(r);
            c.fillRect(-s * 0.5, -s * 0.5, s, s);
            c.restore();
          }
        }
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }
}
