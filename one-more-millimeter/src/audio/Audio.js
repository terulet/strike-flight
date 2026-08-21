/**
 * Audio — fully procedural WebAudio. No files, no network, works offline.
 *
 * Mobile rules honoured here:
 *   - the context is created lazily on the first real gesture and resumed on every
 *     later gesture (iOS suspends aggressively),
 *   - exactly one AudioContext for the lifetime of the page,
 *   - every node started is stopped and disconnected, so restarts never leak.
 */
import { clamp, clamp01, lerp } from '../core/math.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.unlocked = false;
    this.master = null;
    this.noiseBuffer = null;
    this.slide = null;
    this.charge = null;
    this.tension = null;
    this.failed = false;
  }

  /** Call from a user gesture. Safe to call many times. */
  unlock() {
    if (this.failed) return false;
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) { this.failed = true; return false; }
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 8;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        this.noiseBuffer = makeNoise(this.ctx, 1.4);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = this.ctx.state === 'running';
      return true;
    } catch (e) {
      this.failed = true;
      return false;
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
    if (!on) { this.stopCharge(); this.stopSlide(); this.stopTension(); }
  }

  suspend() { try { this.ctx && this.ctx.state === 'running' && this.ctx.suspend(); } catch (e) {} }
  resume() { try { this.ctx && this.ctx.state === 'suspended' && this.ctx.resume(); } catch (e) {} }

  get ok() { return !!(this.ctx && this.enabled && !this.failed); }
  get t() { return this.ctx.currentTime; }

  // ------------------------------------------------------------------ CHARGE
  startCharge() {
    if (!this.ok) return;
    this.stopCharge();
    const c = this.ctx;
    const osc = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();
    const filt = c.createBiquadFilter();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    filt.type = 'lowpass';
    filt.frequency.value = 700;
    filt.Q.value = 6;
    gain.gain.value = 0;
    osc.frequency.value = 110;
    osc2.frequency.value = 110 * 1.005;
    osc.connect(filt); osc2.connect(filt);
    filt.connect(gain); gain.connect(this.master);
    osc.start(); osc2.start();
    gain.gain.setTargetAtTime(0.075, this.t, 0.04);
    this.charge = { osc, osc2, gain, filt };
  }

  updateCharge(power) {
    if (!this.charge || !this.ok) return;
    const p = clamp01(power);
    const f = 110 * Math.pow(2, p * 1.85);
    const now = this.t;
    this.charge.osc.frequency.setTargetAtTime(f, now, 0.02);
    this.charge.osc2.frequency.setTargetAtTime(f * 1.008, now, 0.02);
    this.charge.filt.frequency.setTargetAtTime(600 + p * 2600, now, 0.03);
    this.charge.gain.gain.setTargetAtTime(0.055 + p * 0.075, now, 0.05);
  }

  stopCharge() {
    if (!this.charge) return;
    const { osc, osc2, gain } = this.charge;
    this.charge = null;
    try {
      gain.gain.cancelScheduledValues(this.t);
      gain.gain.setTargetAtTime(0, this.t, 0.02);
      osc.stop(this.t + 0.12); osc2.stop(this.t + 0.12);
      osc.onended = () => { try { osc.disconnect(); osc2.disconnect(); gain.disconnect(); } catch (e) {} };
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------- SLIDE
  startSlide(surface) {
    if (!this.ok) return;
    this.stopSlide();
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 900 * (surface.pitch || 1);
    filt.Q.value = surface.id === 'ice' ? 8 : 1.6;
    const gain = c.createGain();
    gain.gain.value = 0;
    // Grain LFO: at crawling speed you hear every micro-movement (spec 21).
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 30;
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    src.connect(filt); filt.connect(gain); gain.connect(this.master);
    src.start(); lfo.start();
    this.slide = { src, filt, gain, lfo, lfoGain, surface };
  }

  updateSlide(speed, tension) {
    if (!this.slide || !this.ok) return;
    const s = this.slide;
    const v = clamp(speed, 0, 3);
    const now = this.t;
    const base = s.surface.pitch || 1;
    s.filt.frequency.setTargetAtTime(300 * base + v * 900 * base, now, 0.03);
    const loud = Math.pow(clamp01(v / 1.8), 0.75) * 0.16 * (s.surface.noise ?? 0.6);
    s.gain.gain.setTargetAtTime(loud + (v > 0 ? 0.006 : 0), now, 0.04);
    // Slow crawl -> slow, audible grain
    const grainRate = clamp(6 + v * 90, 5, 120);
    s.lfo.frequency.setTargetAtTime(grainRate, now, 0.05);
    s.lfoGain.gain.setTargetAtTime(v < 0.35 ? 0.05 * (s.surface.noise ?? 0.6) : 0.012, now, 0.06);
    if (tension != null) this.updateTension(tension);
  }

  stopSlide() {
    if (!this.slide) return;
    const { src, gain, lfo, filt, lfoGain } = this.slide;
    this.slide = null;
    try {
      gain.gain.cancelScheduledValues(this.t);
      gain.gain.setTargetAtTime(0, this.t, 0.03);
      src.stop(this.t + 0.16);
      lfo.stop(this.t + 0.16);
      src.onended = () => { try { src.disconnect(); filt.disconnect(); gain.disconnect(); lfo.disconnect(); lfoGain.disconnect(); } catch (e) {} };
    } catch (e) { /* ignore */ }
  }

  // ----------------------------------------------------------------- TENSION
  updateTension(amount) {
    if (!this.ok) return;
    const a = clamp01(amount);
    if (a <= 0.001) { this.stopTension(); return; }
    if (!this.tension) {
      const c = this.ctx;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1760;
      gain.gain.value = 0;
      osc.connect(gain); gain.connect(this.master);
      osc.start();
      this.tension = { osc, gain };
    }
    const now = this.t;
    this.tension.osc.frequency.setTargetAtTime(1500 + a * 900, now, 0.1);
    this.tension.gain.gain.setTargetAtTime(a * 0.035, now, 0.08);
  }

  stopTension() {
    if (!this.tension) return;
    const { osc, gain } = this.tension;
    this.tension = null;
    try {
      gain.gain.setTargetAtTime(0, this.t, 0.06);
      osc.stop(this.t + 0.3);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
    } catch (e) {}
  }

  // ------------------------------------------------------------------- ONE-SHOTS
  play(name, opts = {}) {
    if (!this.ok) return;
    switch (name) {
      case 'release': this._noiseHit(0.09, 2400, 0.22, 0.55); this._tone(160, 0.10, 0.16, 'triangle', -60); break;
      case 'stop': this._noiseHit(0.05, 1200, 0.12, 0.6); this._tone(90, 0.09, 0.10, 'sine'); break;
      case 'brink': this._tone(1320, 0.16, 0.05, 'sine'); this._tone(1980, 0.22, 0.03, 'sine'); break;
      case 'fall': this._sweep(700, 90, 0.85, 0.16); break;
      case 'impact': this._noiseHit(0.28, 220, 0.16, 0.8); this._tone(52, 0.34, 0.14, 'sine'); break;
      case 'record': this._arp([523.25, 659.25, 783.99, 1046.5], 0.075, 0.14); break;
      case 'legendary': this._arp([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.06, 0.16); this._noiseHit(0.5, 6000, 0.06, 0.2); break;
      case 'beaten': this._chord([392, 493.88, 587.33], 0.30, 0.11); break;
      case 'lose': this._chord([196, 233.08], 0.34, 0.09); break;
      case 'ui': this._tone(880, 0.045, 0.05, 'square', 0, 0.004); break;
      case 'tick': this._tone(1400, 0.025, 0.03, 'square'); break;
      case 'final': this._tone(330, 0.5, 0.05, 'sine'); this._tone(495, 0.5, 0.035, 'sine'); break;
      default: break;
    }
  }

  _tone(freq, dur, gainV, type = 'sine', detune = 0, attack = 0.006) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    g.gain.value = 0;
    osc.connect(g); g.connect(this.master);
    const t0 = this.t;
    g.gain.linearRampToValueAtTime(gainV, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
  }

  _noiseHit(dur, cutoff, gainV, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cutoff;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gainV;
    src.connect(f); f.connect(g); g.connect(this.master);
    const t0 = this.t;
    g.gain.setValueAtTime(gainV, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
  }

  _sweep(from, to, dur, gainV) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    const g = c.createGain();
    src.connect(f); f.connect(g); g.connect(this.master);
    const t0 = this.t;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t0 + dur);
    g.gain.setValueAtTime(gainV, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (e) {} };
  }

  _arp(freqs, step, gainV) {
    freqs.forEach((f, i) => {
      setTimeout(() => { if (this.ok) this._tone(f, 0.26, gainV, 'triangle'); }, i * step * 1000);
    });
  }

  _chord(freqs, dur, gainV) {
    for (const f of freqs) this._tone(f, dur, gainV, 'sawtooth');
  }
}

function makeNoise(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return buf;
}

export { lerp };
