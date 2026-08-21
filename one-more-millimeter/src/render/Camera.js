/**
 * Camera — the tension machine. It has one job: make the last millimetre feel huge
 * without ever losing the platform edge off screen.
 */
import { damp, dampLog, clamp } from '../core/math.js';
import { GameConfig } from '../config/GameConfig.js';

export class Camera {
  constructor() {
    this.cx = 0; this.cy = 0; this.span = GameConfig.camera.wideSpan;
    this.tx = 0; this.ty = 0; this.tspan = this.span;
    this.shake = 0; this.shakeX = 0; this.shakeY = 0; this.shakeSeed = 1;
    this.punch = 0;
    this.width = 1; this.height = 1;
    this.anchorX = GameConfig.camera.anchorX;
    this.anchorY = GameConfig.camera.anchorY;
    this.scale = 1;
    this._recompute();
  }

  setViewport(w, h) { this.width = w; this.height = h; this._recompute(); }

  snap(x, y, span) {
    this.cx = this.tx = x; this.cy = this.ty = y;
    this.span = this.tspan = span;
    this._recompute();
  }

  target(x, y, span) { this.tx = x; this.ty = y; this.tspan = span; }

  addShake(amount) { this.shake = Math.min(1.4, this.shake + amount); }
  addPunch(amount) { this.punch = Math.min(1, this.punch + amount); }

  update(dt, opts = {}) {
    const lerp = opts.lerp ?? GameConfig.camera.lerp;
    this.cx = damp(this.cx, this.tx, lerp, dt);
    this.cy = damp(this.cy, this.ty, lerp, dt);
    this.span = dampLog(this.span, this.tspan, opts.zoomLerp ?? lerp, dt);

    if (this.shake > 0.0005) {
      this.shakeSeed = (this.shakeSeed * 16807) % 2147483647;
      const r1 = (this.shakeSeed / 2147483647) * 2 - 1;
      this.shakeSeed = (this.shakeSeed * 16807) % 2147483647;
      const r2 = (this.shakeSeed / 2147483647) * 2 - 1;
      const mag = this.shake * this.shake * 26;
      this.shakeX = r1 * mag; this.shakeY = r2 * mag;
      this.shake = Math.max(0, this.shake - dt * 3.4);
    } else { this.shakeX = 0; this.shakeY = 0; this.shake = 0; }

    this.punch = Math.max(0, this.punch - dt * 4.5);
    this._recompute();
  }

  _recompute() {
    const zoom = 1 + this.punch * 0.06;
    this.scale = (this.width / Math.max(this.span, 1e-6)) * zoom;
    this.ox = this.width * this.anchorX + this.shakeX;
    this.oy = this.height * this.anchorY + this.shakeY;
  }

  /** World metres -> CSS pixels. World +y is up. */
  sx(x) { return this.ox + (x - this.cx) * this.scale; }
  sy(y) { return this.oy - (y - this.cy) * this.scale; }
  /** Pixels per metre. */
  get pxPerM() { return this.scale; }
  /** Metres visible across the height. */
  get spanY() { return this.height / this.scale; }

  /**
   * Applies the world transform to a 2D context. Must agree exactly with sx()/sy():
   *   device = dpr * (ox + (x - cx) * scale,  oy - (y - cy) * scale)
   */
  applyTo(ctx, dpr) {
    const s = this.scale * dpr;
    ctx.setTransform(s, 0, 0, -s, (this.ox - this.cx * this.scale) * dpr, (this.oy + this.cy * this.scale) * dpr);
  }

  visibleWorld() {
    const halfW = this.span / 2;
    return {
      x0: this.cx - this.width * this.anchorX / this.scale,
      x1: this.cx + this.width * (1 - this.anchorX) / this.scale,
      y0: this.cy - this.height * (1 - this.anchorY) / this.scale,
      y1: this.cy + this.height * this.anchorY / this.scale,
      halfW,
    };
  }
}

export { clamp };
