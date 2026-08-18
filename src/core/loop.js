/**
 * Fixed-timestep loop with a render interpolation-free draw (we draw the
 * simulated state directly — at 120Hz steps the visual difference is nil and
 * it keeps entity code free of "previous position" bookkeeping).
 *
 * Why fixed step: hazards are timing puzzles. A variable step would make a
 * 30fps device a different (unfair) game.
 */

export const FIXED_DT = 1 / 120;
const MAX_FRAME = 0.25; // Never simulate more than 250ms after a tab stall.

export class GameLoop {
  constructor({ update, render, raf = requestAnimationFrame, now = () => performance.now() }) {
    this.update = update;
    this.render = render;
    this.raf = raf;
    this.now = now;
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.fps = 60;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = this.now();
    this.accumulator = 0;
    this.raf(this._tick);
  }

  stop() {
    this.running = false;
  }

  _tick(t) {
    if (!this.running) return;
    this.raf(this._tick);
    const time = typeof t === 'number' ? t : this.now();
    let frame = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (!Number.isFinite(frame) || frame < 0) frame = 0;
    if (frame > MAX_FRAME) frame = MAX_FRAME;

    this._fpsAccum += frame;
    this._fpsFrames += 1;
    if (this._fpsAccum >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAccum;
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }

    this.accumulator += frame;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 8) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= 8) this.accumulator = 0; // Give up on catching up; stay responsive.
    this.render(frame);
  }
}
