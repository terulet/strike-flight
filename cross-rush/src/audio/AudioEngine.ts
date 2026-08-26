/**
 * AudioEngine.ts
 *
 * Audio 100% procedural con Web Audio: un oscilador continuo de "motor" cuyo
 * pitch/ganancia reaccionan a la velocidad y el gas, mas efectos cortos para
 * aterrizaje y crash generados con osciladores/ruido de vida corta. Nada de
 * assets externos.
 */

import { AudioConfig } from '../config/GameConfig';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
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
    this.started = true;
  }

  suspend(): void {
    this.ctx?.suspend();
  }

  resume(): void {
    this.ctx?.resume();
  }

  updateEngine(speedRatio: number, throttling: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    const clamped = Math.max(0, Math.min(1, speedRatio));
    const freq = AudioConfig.engine.baseFrequency + clamped * (AudioConfig.engine.maxFrequency - AudioConfig.engine.baseFrequency);
    const gain =
      AudioConfig.engine.baseGain +
      (throttling ? 1 : 0.4) * clamped * (AudioConfig.engine.maxGain - AudioConfig.engine.baseGain);
    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.05);
    this.engineGain.gain.setTargetAtTime(gain, now, 0.08);
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

  playLandingCue(quality: 'PERFECT' | 'GOOD' | 'ROUGH' | 'BAD' | 'CRASH'): void {
    if (quality === 'CRASH') {
      this.playCrashCue();
      return;
    }
    const freqByQuality: Record<string, number> = { PERFECT: 520, GOOD: 380, ROUGH: 260, BAD: 180 };
    this.playBlip(freqByQuality[quality] ?? 220, 0.18, AudioConfig.landing.gain, 'triangle');
  }

  playCrashCue(): void {
    this.playBlip(90, 0.4, AudioConfig.crash.gain, 'square');
    this.playBlip(55, 0.5, AudioConfig.crash.gain * 0.8, 'sawtooth');
  }
}
