/**
 * Loop — one rAF driver. It owns wall-clock time; the physics accumulator lives in
 * the Game so it can apply slow motion without touching the render cadence.
 */
export class Loop {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.running = false;
    this.last = 0;
    this.rafId = 0;
    this.fps = 60;
    this._acc = 0;
    this._frames = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = now();
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  _tick(ts) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);
    const t = ts || now();
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.5) dt = 1 / 60; // came back from background: do not integrate the gap
    this._acc += dt;
    this._frames++;
    if (this._acc >= 0.5) {
      this.fps = this._frames / this._acc;
      this._acc = 0;
      this._frames = 0;
    }
    this.onFrame(dt, t);
  }
}

const now = () =>
  typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
export { now };
