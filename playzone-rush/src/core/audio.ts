/**
 * Audio 100% procedural (WebAudio). Cero assets, cero descargas, cero latencia
 * de red. Suficiente para que un impacto suene a impacto y un record suene a
 * record. Se puede sustituir por samples mas adelante sin tocar a quien llama:
 * el resto del juego solo dice audio.play('record').
 */
export type SoundName =
  | 'tap'
  | 'select'
  | 'back'
  | 'countdown'
  | 'go'
  | 'score'
  | 'combo'
  | 'error'
  | 'hit'
  | 'miss'
  | 'record'
  | 'overtake'
  | 'passed'
  | 'victory'
  | 'defeat'
  | 'unlock'
  | 'chaos';

type Ctor = typeof AudioContext;

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private _muted = false;
  private comboStep = 0;
  private lastPlay = new Map<SoundName, number>();

  constructor(muted = false) {
    this._muted = muted;
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(value: boolean): void {
    this._muted = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** Debe llamarse dentro de un gesto del usuario (iOS lo exige). */
  unlock(): void {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctx: Ctor | undefined =
      (globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ??
      (globalThis as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Canal propio para el motor de musica, colgado del master.
   *
   * Cuelga del master a proposito: asi el boton de silencio sigue apagandolo
   * todo de una vez, sin que musica y efectos se puedan desincronizar. Va algo
   * mas bajo que los efectos porque la musica acompana, no manda.
   */
  musicChannel(): { ctx: AudioContext; out: GainNode } | null {
    const ctx = this.ensure();
    if (!ctx || !this.master) return null;
    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.42;
      this.musicGain.connect(this.master);
    }
    return { ctx, out: this.musicGain };
  }

  private tone(
    freq: number,
    duration: number,
    options: {
      type?: OscillatorType;
      gain?: number;
      delay?: number;
      sweepTo?: number;
      attack?: number;
    } = {},
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this._muted) return;
    const t0 = ctx.currentTime + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type ?? 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (options.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.sweepTo), t0 + duration);
    const peak = options.gain ?? 0.18;
    const attack = options.attack ?? 0.006;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(duration: number, options: { gain?: number; delay?: number; hp?: number } = {}): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this._muted) return;
    const t0 = ctx.currentTime + (options.delay ?? 0);
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = options.hp ?? 700;
    const gain = ctx.createGain();
    gain.gain.value = options.gain ?? 0.15;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  /** Reinicia la escalera del combo (al empezar partida o al fallar). */
  resetCombo(): void {
    this.comboStep = 0;
  }

  play(name: SoundName, param = 0): void {
    if (this._muted) return;
    // Anti-metralleta: el mismo sonido no puede sonar dos veces en 25 ms.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastPlay.get(name) ?? -Infinity;
    if (now - last < 25) return;
    this.lastPlay.set(name, now);

    switch (name) {
      case 'tap':
        this.tone(440, 0.05, { type: 'triangle', gain: 0.1 });
        break;
      case 'select':
        this.tone(620, 0.07, { type: 'triangle', gain: 0.14, sweepTo: 900 });
        break;
      case 'back':
        this.tone(420, 0.08, { type: 'triangle', gain: 0.1, sweepTo: 260 });
        break;
      case 'countdown':
        this.tone(520, 0.1, { type: 'square', gain: 0.13 });
        break;
      case 'go':
        this.tone(660, 0.1, { type: 'square', gain: 0.16 });
        this.tone(990, 0.16, { type: 'square', gain: 0.13, delay: 0.08 });
        break;
      case 'score':
        this.tone(880, 0.06, { type: 'triangle', gain: 0.1 });
        break;
      case 'combo': {
        const step = param > 0 ? param : ++this.comboStep;
        const freq = 520 * Math.pow(1.0595, Math.min(24, step * 2));
        this.tone(freq, 0.08, { type: 'triangle', gain: 0.14 });
        this.tone(freq * 2, 0.05, { type: 'sine', gain: 0.06, delay: 0.02 });
        break;
      }
      case 'hit':
        this.tone(300, 0.06, { type: 'square', gain: 0.12, sweepTo: 160 });
        this.noise(0.05, { gain: 0.08 });
        break;
      case 'miss':
      case 'error':
        this.comboStep = 0;
        this.tone(180, 0.16, { type: 'sawtooth', gain: 0.13, sweepTo: 90 });
        break;
      case 'passed':
        this.tone(700, 0.07, { type: 'triangle', gain: 0.13 });
        this.tone(1050, 0.1, { type: 'triangle', gain: 0.11, delay: 0.06 });
        break;
      case 'overtake':
        [0, 0.07, 0.14].forEach((d, i) => this.tone(600 + i * 220, 0.11, { type: 'square', gain: 0.14, delay: d }));
        break;
      case 'record':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone(f, 0.22, { type: 'triangle', gain: 0.16, delay: i * 0.075 }),
        );
        this.noise(0.3, { gain: 0.05, hp: 2000, delay: 0.05 });
        break;
      case 'victory':
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.24, { type: 'triangle', gain: 0.15, delay: i * 0.09 }));
        break;
      case 'defeat':
        [330, 262, 196].forEach((f, i) => this.tone(f, 0.26, { type: 'sawtooth', gain: 0.1, delay: i * 0.1 }));
        break;
      case 'unlock':
        [440, 587, 880].forEach((f, i) => this.tone(f, 0.2, { type: 'square', gain: 0.13, delay: i * 0.08 }));
        this.noise(0.25, { gain: 0.06, hp: 1500, delay: 0.1 });
        break;
      case 'chaos':
        [660, 440, 880, 330].forEach((f, i) =>
          this.tone(f, 0.14, { type: 'sawtooth', gain: 0.12, delay: i * 0.05, sweepTo: f * 1.6 }),
        );
        break;
    }
  }
}
