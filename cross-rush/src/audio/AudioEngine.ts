/**
 * AudioEngine.ts
 *
 * Audio 100% procedural con Web Audio: un oscilador continuo de "motor" cuyo
 * pitch/ganancia reaccionan a la velocidad y el gas, mas efectos cortos para
 * aterrizaje y crash generados con osciladores/ruido de vida corta. Nada de
 * assets externos.
 */

import { AudioConfig } from '../config/GameConfig';

/** Lo que el motor necesita saber de la moto. Nada de esto es `vx`. */
export interface EngineAudioState {
  /** Revoluciones normalizadas 0..1, derivadas del giro REAL de la rueda trasera. */
  rpmRatio: number;
  /** Gas continuo 0..1. */
  throttle: number;
  /**
   * Escala de tiempo vigente (1 = tiempo real). En camara lenta baja el tono
   * del motor, igual que ralentizar una cinta. Opcional: sin ella suena a
   * velocidad normal.
   */
  timeScale?: number;
  /**
   * Carga del motor 0..1: cuanto le esta costando. Sube al arrancar, al subir
   * cuestas y al patinar; baja en rueda libre y en el aire.
   */
  load: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineDetuneOsc: OscillatorNode | null = null;
  private engineDetuneGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private started = false;

  /** Debe llamarse tras una interaccion del usuario (politica de autoplay). */
  start(): void {
    if (this.started) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = AudioConfig.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = AudioConfig.engine.baseGain;
    this.engineOsc.frequency.value = AudioConfig.engine.baseFrequency;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    // Segundo oscilador ligeramente desafinado: una sierra sola suena a
    // zumbador de microondas; dos batiendo entre si suenan a monocilindrico.
    this.engineDetuneOsc = this.ctx.createOscillator();
    this.engineDetuneOsc.type = 'square';
    this.engineDetuneGain = this.ctx.createGain();
    this.engineDetuneGain.gain.value = AudioConfig.engine.baseGain * AudioConfig.engine.detuneGain;
    this.engineDetuneOsc.frequency.value = AudioConfig.engine.baseFrequency * AudioConfig.engine.detuneRatio;
    this.engineDetuneOsc.connect(this.engineDetuneGain);
    this.engineDetuneGain.connect(this.masterGain);
    this.engineDetuneOsc.start();

    this.started = true;
  }

  suspend(): void {
    this.ctx?.suspend();
  }

  resume(): void {
    this.ctx?.resume();
  }

  /**
   * Motor ligado a la moto, no a la camara.
   *
   * El tono lo marcan las revoluciones REALES de la rueda trasera, asi que la
   * moto sube de vueltas cuando patina parada y las pierde cuando el neumatico
   * se bloquea al frenar: dos cosas que con el modelo anterior (tono = |vx|)
   * sonaban exactamente al reves de lo que se veia. El gas anade un empujon de
   * tono por encima -el motor "estira" antes de que la moto responda- y la
   * carga abre el volumen.
   */
  updateEngine(state: EngineAudioState): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const cfg = AudioConfig.engine;
    const rpm = Math.max(0, Math.min(1, Number.isFinite(state.rpmRatio) ? state.rpmRatio : 0));
    const throttle = Math.max(0, Math.min(1, Number.isFinite(state.throttle) ? state.throttle : 0));
    const load = Math.max(0, Math.min(1, Number.isFinite(state.load) ? state.load : 0));

    const pitchRatio = Math.min(1, rpm + throttle * cfg.throttleLift * (1 - rpm));
    // La camara lenta baja el tono. La simulacion no cambia de velocidad -las
    // vueltas de rueda son las mismas-, pero el jugador esta viendo el mundo
    // al 45%, y un motor que sigue sonando igual mientras la imagen se
    // arrastra delata el truco. Es el mismo efecto que ralentizar una cinta.
    const timeScale = Math.max(0.05, Math.min(1, Number.isFinite(state.timeScale ?? 1) ? (state.timeScale ?? 1) : 1));
    const freq = (cfg.baseFrequency + pitchRatio * (cfg.maxFrequency - cfg.baseFrequency)) * timeScale;

    const openness = Math.min(1, 0.35 * rpm + 0.4 * throttle + cfg.loadGain * load);
    const gain = cfg.baseGain + openness * (cfg.maxGain - cfg.baseGain);

    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(freq, now, cfg.frequencyGlide);
    this.engineGain.gain.setTargetAtTime(gain, now, 0.06);
    if (this.engineDetuneOsc && this.engineDetuneGain) {
      this.engineDetuneOsc.frequency.setTargetAtTime(freq * cfg.detuneRatio, now, cfg.frequencyGlide);
      this.engineDetuneGain.gain.setTargetAtTime(gain * cfg.detuneGain, now, 0.06);
    }
  }

  private playBlip(frequency: number, duration: number, gain: number, type: OscillatorType): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(this.masterGain);
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Golpe de tierra: un ruido de banda ancha filtrado y corto. Es lo que suena
   * cuando una rueda se clava en el suelo, y ningun oscilador lo imita: un
   * tono puro suena a videojuego de 1980, no a impacto.
   */
  private playThump(strength: number): void {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const duration = 0.16 + strength * 0.14;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Ruido con envolvente exponencial: ataque instantaneo y cola corta.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.4);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Paso bajo: la tierra absorbe los agudos, la piedra no.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260 + strength * 520;
    filter.Q.value = 0.9;
    const gain = ctx.createGain();
    gain.gain.value = AudioConfig.landing.gain * (0.5 + strength * 1.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
  }

  /**
   * Aterrizaje. `strength` en 0..1 lo pone quien lo llama a partir de la
   * velocidad de impacto: el mismo evento suena distinto si se posa o si se
   * estampa, que es lo que hace que el sonido informe en vez de decorar.
   */
  playLandingCue(quality: 'PERFECT' | 'GOOD' | 'ROUGH' | 'BAD' | 'CRASH', strength = 0.5): void {
    if (quality === 'CRASH') {
      this.playCrashCue();
      return;
    }
    this.playThump(Math.max(0, Math.min(1, strength)));
    // Y encima del golpe, una nota corta que dice si ha estado bien o mal.
    const freqByQuality: Record<string, number> = { PERFECT: 620, GOOD: 430, ROUGH: 240, BAD: 165 };
    this.playBlip(freqByQuality[quality] ?? 220, 0.14, AudioConfig.landing.gain * 0.55, 'triangle');
  }

  playCrashCue(): void {
    this.playThump(1);
    this.playBlip(90, 0.4, AudioConfig.crash.gain, 'square');
    this.playBlip(55, 0.5, AudioConfig.crash.gain * 0.8, 'sawtooth');
  }

  /**
   * Cuenta atras. Los tres numeros son un pitido seco; el "GO" es otra cosa:
   * dos notas a la vez y un golpe grave debajo, para que la salida se oiga
   * como un banderazo y no como el cuarto pitido de la serie.
   */
  playCountdownCue(final: boolean): void {
    if (!final) {
      this.playBlip(440, 0.12, AudioConfig.landing.gain * 0.7, 'square');
      return;
    }
    this.playBlip(880, 0.34, AudioConfig.landing.gain * 0.85, 'square');
    this.playBlip(1320, 0.24, AudioConfig.landing.gain * 0.45, 'triangle');
    this.playThump(0.55);
  }

  /**
   * Meta: arpegio ascendente corto. Se dispara al cruzar la linea, antes de
   * que aparezca el panel de resultados, para que el final de carrera tenga
   * un instante propio.
   */
  playFinishCue(): void {
    this.playThump(0.7);
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      window.setTimeout(() => this.playBlip(freq, 0.28, AudioConfig.landing.gain * 0.7, 'triangle'), i * 90);
    });
  }

  /** Empujon de una pieza de riesgo/recompensa (speed_pad, flow_ring acertado, risk_gap superado). */
  playBoostCue(): void {
    this.playBlip(440, 0.1, AudioConfig.landing.gain, 'triangle');
    this.playBlip(660, 0.14, AudioConfig.landing.gain, 'triangle');
  }
}
