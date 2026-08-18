/** Bucle de render con dt acotado y medidor de FPS. */
export type TickFn = (dt: number, now: number) => void;

const MAX_DT = 1 / 20; // si la pestana se va a segundo plano no queremos saltos

export class Ticker {
  private raf = 0;
  private last = 0;
  private running = false;
  private frames = 0;
  private fpsAccum = 0;
  private _fps = 0;

  constructor(private onTick: TickFn) {}

  get fps(): number {
    return this._fps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const step = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(MAX_DT, (now - this.last) / 1000);
      this.last = now;
      this.frames++;
      this.fpsAccum += dt;
      if (this.fpsAccum >= 0.5) {
        this._fps = Math.round(this.frames / this.fpsAccum);
        this.frames = 0;
        this.fpsAccum = 0;
      }
      this.onTick(dt, now);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
