/**
 * Time control: global time scale (slow motion) and hit stop (frame freeze).
 * Everything gameplay-related consumes Clock.dt, never the raw frame delta,
 * so juice never desyncs the simulation.
 */

export class Clock {
  constructor() {
    this.scale = 1;
    this.targetScale = 1;
    this.hitstop = 0;
    this.dt = 0;
    this.rawDt = 0;
    this.elapsed = 0;
  }

  /** Freezes the simulation for `seconds` of real time. Longest request wins. */
  freeze(seconds) {
    if (seconds > this.hitstop) this.hitstop = seconds;
  }

  slowmo(scale, _seconds = 0) {
    this.targetScale = scale;
  }

  resetScale() {
    this.targetScale = 1;
    this.scale = 1;
  }

  step(rawDt) {
    this.rawDt = rawDt;
    if (this.hitstop > 0) {
      this.hitstop -= rawDt;
      this.dt = 0;
      return 0;
    }
    // Ease towards the target scale so slow-mo never snaps.
    this.scale += (this.targetScale - this.scale) * Math.min(1, rawDt * 12);
    if (Math.abs(this.scale - this.targetScale) < 0.005) this.scale = this.targetScale;
    this.dt = rawDt * this.scale;
    this.elapsed += this.dt;
    return this.dt;
  }
}
