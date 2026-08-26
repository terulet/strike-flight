/**
 * Fixed-timestep loop on top of requestAnimationFrame.
 * `timeScale` lets systems (slow motion) dilate simulation time without touching rAF itself.
 */
export class GameLoop {
  private readonly stepMs: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafHandle = 0;
  private running = false;
  timeScale = 1;

  constructor(
    private readonly onFixedUpdate: (dtMs: number) => void,
    private readonly onRender: (alpha: number, realDtMs: number) => void,
    stepHz = 60
  ) {
    this.stepMs = 1000 / stepHz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    let realDt = now - this.lastTime;
    this.lastTime = now;
    // Clamp to avoid a huge catch-up burst after a tab is backgrounded.
    realDt = Math.min(realDt, 250);

    this.accumulator += realDt * this.timeScale;
    let steps = 0;
    while (this.accumulator >= this.stepMs && steps < 8) {
      this.onFixedUpdate(this.stepMs);
      this.accumulator -= this.stepMs;
      steps++;
    }
    const alpha = this.accumulator / this.stepMs;
    this.onRender(alpha, realDt);

    this.rafHandle = requestAnimationFrame(this.tick);
  };
}
