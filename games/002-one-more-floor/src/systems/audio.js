/**
 * AudioManager.
 *
 * Every sound is synthesised at runtime with WebAudio — no files, no licences
 * to chase, nothing to download. The point of this pass is the architecture:
 * gameplay calls `audio.play('jump')` and never knows what is behind it, so
 * swapping in real samples later touches this file only.
 *
 * The context is created on the first user gesture (mobile browsers require
 * it) and everything degrades to silence if WebAudio is unavailable.
 */

const CUES = {
  jump:       { throttle: 0.05 },
  land:       { throttle: 0.05 },
  dive:       { throttle: 0.08 },
  slam:       { throttle: 0.06 },
  bonk:       { throttle: 0.12 },
  complete:   { throttle: 0.1 },
  death:      { throttle: 0.2 },
  record:     { throttle: 0.5 },
  ui:         { throttle: 0.05 },
  start:      { throttle: 0.2 },
  laser:      { throttle: 0.05 },
  fire:       { throttle: 0.08 },
  crusher:    { throttle: 0.05 },
  crumble:    { throttle: 0.06 },
  stomp:      { throttle: 0.05 },
  boss_hit:   { throttle: 0.1 },
  boss_slam:  { throttle: 0.1 },
  boss_die:   { throttle: 0.5 },
  tick:       { throttle: 0.03 },
};

export class AudioManager {
  constructor({ muted = false } = {}) {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = muted;
    this.ready = false;
    this.lastPlayed = new Map();
    this.failed = false;
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock() {
    if (this.ready || this.failed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = true; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // One shared noise buffer for every percussive sound.
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = ((seed >>> 8) / 8388608) - 1;
      }
      this.noise = buf;
      this.ready = true;
    } catch {
      this.failed = true;
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  _tone(freq, { type = 'square', dur = 0.12, gain = 0.2, slideTo = null, delay = 0, attack = 0.004 } = {}) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noiseBurst({ dur = 0.12, gain = 0.2, freq = 1200, q = 1, type = 'lowpass', delay = 0, sweepTo = null } = {}) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + dur);
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(cue, opts = {}) {
    if (!this.ready || this.muted || this.failed) return;
    const meta = CUES[cue];
    const now = this.ctx.currentTime;
    if (meta?.throttle) {
      const last = this.lastPlayed.get(cue) ?? -99;
      if (now - last < meta.throttle) return;
      this.lastPlayed.set(cue, now);
    }
    try {
      this._render(cue, opts);
    } catch {
      /* never let a sound break a frame */
    }
  }

  _render(cue, opts) {
    switch (cue) {
      case 'jump':
        this._tone(330, { type: 'square', dur: 0.11, gain: 0.11, slideTo: 620 });
        break;
      case 'land':
        this._noiseBurst({ dur: 0.07, gain: 0.09 + (opts.impact ?? 0) * 0.12, freq: 900, sweepTo: 220 });
        this._tone(150, { type: 'sine', dur: 0.08, gain: 0.08, slideTo: 80 });
        break;
      case 'dive':
        this._tone(700, { type: 'sawtooth', dur: 0.16, gain: 0.08, slideTo: 180 });
        break;
      case 'slam':
        this._noiseBurst({ dur: 0.18, gain: 0.24, freq: 700, sweepTo: 90 });
        this._tone(90, { type: 'sine', dur: 0.16, gain: 0.2, slideTo: 45 });
        break;
      case 'bonk':
        this._tone(190, { type: 'square', dur: 0.06, gain: 0.06, slideTo: 130 });
        break;
      case 'complete':
        this._tone(523, { type: 'square', dur: 0.09, gain: 0.11 });
        this._tone(784, { type: 'square', dur: 0.11, gain: 0.1, delay: 0.07 });
        break;
      case 'start':
        this._tone(392, { type: 'square', dur: 0.1, gain: 0.12 });
        this._tone(587, { type: 'square', dur: 0.14, gain: 0.11, delay: 0.09 });
        break;
      case 'death':
        this._noiseBurst({ dur: 0.4, gain: 0.3, freq: 2400, sweepTo: 110 });
        this._tone(220, { type: 'sawtooth', dur: 0.42, gain: 0.16, slideTo: 55 });
        break;
      case 'record':
        [523, 659, 784, 1046].forEach((f, i) =>
          this._tone(f, { type: 'square', dur: 0.16, gain: 0.11, delay: i * 0.085 }));
        break;
      case 'ui':
        this._tone(660, { type: 'square', dur: 0.05, gain: 0.07 });
        break;
      case 'tick':
        this._tone(880, { type: 'square', dur: 0.03, gain: 0.04 });
        break;
      case 'laser':
        this._tone(1400, { type: 'sawtooth', dur: 0.16, gain: 0.07, slideTo: 900 });
        this._noiseBurst({ dur: 0.12, gain: 0.05, freq: 3000, type: 'highpass' });
        break;
      case 'fire':
        this._noiseBurst({ dur: 0.32, gain: 0.11, freq: 480, sweepTo: 1600, type: 'bandpass', q: 1.4 });
        break;
      case 'crusher':
        this._noiseBurst({ dur: 0.22, gain: 0.2, freq: 600, sweepTo: 70 });
        this._tone(70, { type: 'square', dur: 0.2, gain: 0.16, slideTo: 40 });
        break;
      case 'crumble':
        this._noiseBurst({ dur: 0.16, gain: 0.09, freq: 1800, sweepTo: 400, type: 'bandpass', q: 0.8 });
        break;
      case 'stomp':
        this._tone(420, { type: 'square', dur: 0.07, gain: 0.1, slideTo: 180 });
        this._noiseBurst({ dur: 0.1, gain: 0.1, freq: 1400, sweepTo: 300 });
        break;
      case 'boss_hit':
        this._tone(260, { type: 'square', dur: 0.16, gain: 0.16, slideTo: 90 });
        this._noiseBurst({ dur: 0.2, gain: 0.16, freq: 1800, sweepTo: 200 });
        break;
      case 'boss_slam':
        this._noiseBurst({ dur: 0.3, gain: 0.24, freq: 500, sweepTo: 60 });
        this._tone(60, { type: 'sine', dur: 0.28, gain: 0.22, slideTo: 34 });
        break;
      case 'boss_die':
        [330, 262, 196, 131].forEach((f, i) =>
          this._tone(f, { type: 'sawtooth', dur: 0.3, gain: 0.13, delay: i * 0.11, slideTo: f * 0.6 }));
        this._noiseBurst({ dur: 0.7, gain: 0.2, freq: 2200, sweepTo: 80 });
        break;
      default:
        break;
    }
  }
}
