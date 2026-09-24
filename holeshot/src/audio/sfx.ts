/**
 * Sonido sintetizado con WebAudio (sin archivos): motor monocilindrico con
 * cambio de marchas, viento en el aire, golpes de recepcion, caidas,
 * recogibles, pitidos de salida y el rugido del publico.
 */
import { clamp } from '../core/math';

const GEARS = [0, 6.5, 11.5, 16.5, 22, 28, 60];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineGain!: GainNode;
  private oscA!: OscillatorNode;
  private oscB!: OscillatorNode;
  private oscC!: OscillatorNode;
  private filter!: BiquadFilterNode;
  private trem!: OscillatorNode;
  private tremGain!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private crowd!: GainNode;
  private noise!: AudioBuffer;
  private rpm = 0.2;
  muted = false;

  /** Hay que llamarlo desde un gesto del usuario (click, tecla, toque). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Motor.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 3;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.6);
    }
    shaper.curve = curve;
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'square';
    this.oscC = ctx.createOscillator();
    this.oscC.type = 'sawtooth';
    const gB = ctx.createGain();
    gB.gain.value = 0.55;
    const gC = ctx.createGain();
    gC.gain.value = 0.25;
    this.oscA.connect(pre);
    this.oscB.connect(gB).connect(pre);
    this.oscC.connect(gC).connect(pre);
    // Pulsos de explosion: el tipico "petardeo" de monocilindrico.
    const pulse = ctx.createGain();
    pulse.gain.value = 0.65;
    this.trem = ctx.createOscillator();
    this.trem.type = 'square';
    this.tremGain = ctx.createGain();
    this.tremGain.gain.value = 0.35;
    this.trem.connect(this.tremGain).connect(pulse.gain);
    pre.connect(shaper).connect(pulse).connect(this.filter).connect(this.engineGain).connect(this.master);
    for (const o of [this.oscA, this.oscB, this.oscC, this.trem]) o.start();

    // Viento.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noise;
    windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.6;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    windSrc.connect(this.windFilter).connect(this.wind).connect(this.master);
    windSrc.start();

    // Publico.
    const crowdSrc = ctx.createBufferSource();
    crowdSrc.buffer = this.noise;
    crowdSrc.loop = true;
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 1100;
    cf.Q.value = 0.4;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = 0;
    crowdSrc.connect(cf).connect(this.crowd).connect(this.master);
    crowdSrc.start();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  /** Actualiza el motor cada frame. `wheelSpeed` en m/s de la rueda trasera. */
  engine(on: boolean, wheelSpeed: number, throttle: number, airborne: boolean, speed: number, nitro: boolean, pitch = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    let target: number;
    if (airborne) target = 0.35 + throttle * 0.65;
    else {
      const v = Math.max(0, wheelSpeed);
      let g = 1;
      while (g < GEARS.length - 1 && v > GEARS[g]) g++;
      const lo = GEARS[g - 1];
      const hi = GEARS[g];
      target = 0.3 + clamp((v - lo) / (hi - lo), 0, 1) * 0.6 + throttle * 0.1;
    }
    if (!on) target = 0.12;
    this.rpm += (target - this.rpm) * 0.18;
    const f = (34 + this.rpm * 105 + (nitro ? 12 : 0)) * pitch;
    this.oscA.frequency.setTargetAtTime(f, now, 0.02);
    this.oscB.frequency.setTargetAtTime(f * 0.5, now, 0.02);
    this.oscC.frequency.setTargetAtTime(f * 2.01, now, 0.02);
    this.trem.frequency.setTargetAtTime(f * 0.5, now, 0.02);
    this.filter.frequency.setTargetAtTime(300 + throttle * 1900 + this.rpm * 900, now, 0.04);
    this.engineGain.gain.setTargetAtTime(on ? 0.16 + throttle * 0.16 : 0.07, now, 0.05);
    this.wind.gain.setTargetAtTime(clamp((speed - 6) / 30, 0, 1) * (airborne ? 0.22 : 0.08), now, 0.1);
    this.windFilter.frequency.setTargetAtTime(400 + speed * 30, now, 0.1);
  }

  stopEngine(): void {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.wind.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(now, Math.random() * 1.5, dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  land(strength: number): void {
    const s = clamp(strength, 0.2, 1.5);
    this.burst(0.25 + s * 0.15, 180 + s * 120, 0.8, 0.5 * s);
    this.tone(70, 0.18, 'sine', 0.35 * s, 0, 40);
  }

  crash(): void {
    this.burst(0.9, 900, 0.5, 0.7);
    this.burst(0.5, 150, 1, 0.8);
    this.tone(220, 0.3, 'square', 0.08, 0.05, 90);
  }

  pickup(kind: 'plate' | 'nitro'): void {
    if (kind === 'plate') {
      this.tone(880, 0.12, 'triangle', 0.25);
      this.tone(1320, 0.18, 'triangle', 0.22, 0.07);
    } else {
      this.tone(300, 0.3, 'sawtooth', 0.12, 0, 900);
    }
  }

  checkpoint(): void {
    this.tone(660, 0.1, 'square', 0.1);
    this.tone(990, 0.16, 'square', 0.1, 0.09);
  }

  beep(high: boolean): void {
    this.tone(high ? 1046 : 523, high ? 0.45 : 0.18, 'square', 0.14);
  }

  trick(flips: number): void {
    this.tone(523, 0.1, 'triangle', 0.2);
    this.tone(784, 0.14, 'triangle', 0.2, 0.08);
    if (flips > 0) this.tone(1046, 0.25, 'triangle', 0.2, 0.16);
    this.cheer(0.4 + flips * 0.3);
  }

  cheer(amount: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    this.crowd.gain.cancelScheduledValues(now);
    this.crowd.gain.setTargetAtTime(clamp(amount, 0, 1) * 0.3, now, 0.15);
    this.crowd.gain.setTargetAtTime(0, now + 1.2, 0.6);
  }

  fanfare(medal: number): void {
    const notes = medal >= 3 ? [523, 659, 784, 1046] : medal === 2 ? [523, 659, 784] : [523, 659];
    notes.forEach((n, i) => this.tone(n, 0.3, 'triangle', 0.22, i * 0.13));
    this.cheer(0.9);
  }

  fail(): void {
    this.tone(330, 0.3, 'sawtooth', 0.14, 0, 220);
    this.tone(220, 0.5, 'sawtooth', 0.14, 0.25, 110);
  }

  /** Lamina de las gafas arrancada de un tiron. */
  tearOff(): void {
    this.burst(0.18, 3500, 0.7, 0.35, 'highpass');
    this.tone(1800, 0.08, 'triangle', 0.05, 0, 600);
  }

  /** Golpe grave al entrar en camara lenta. */
  slowmo(): void {
    this.tone(90, 0.9, 'sine', 0.3, 0, 40);
    this.burst(0.6, 400, 0.6, 0.25);
  }

  holeshot(): void {
    [659, 784, 988, 1318].forEach((n, i) => this.tone(n, 0.22, 'square', 0.1, i * 0.07));
    this.cheer(0.8);
  }

  click(): void {
    this.tone(1400, 0.04, 'square', 0.06);
  }
}
