import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { MaterialId } from '../core/types';

/**
 * Fully procedural WebAudio SFX (section 23) — no audio files yet. Every sound is a short
 * oscillator/noise envelope keyed by a stable name, so swapping in real recordings later
 * only means replacing the call sites' logic with buffer playback, not the trigger wiring.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  enabled = true;

  constructor(private bus: EventBus<GameEvents>, private resolveMaterial: (pieceId: string) => MaterialId | undefined) {
    bus.on('shot_fired', () => this.playLaunch());
    bus.on('impact', (e) => {
      const material = this.resolveMaterial(e.pieceId);
      if (material) this.playImpact(material);
    });
    bus.on('structural_break', (e) => this.playBreak(e.material));
    bus.on('cable_cut', () => this.playCableSnap());
    bus.on('explosion', () => this.playExplosion());
    bus.on('chain_event', (e) => this.playChain(e.chainLength));
    bus.on('game_finish', (e) => (e.perfectCollapse ? this.playPerfectCollapse() : this.playVictory()));
  }

  /** Must be called from a user gesture (pointerdown) — browsers block audio before that. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.55;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(freq: number, durationSec: number, type: OscillatorType, gainPeak: number, glideTo?: number): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.now());
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(glideTo, 1), this.now() + durationSec);
    gain.gain.setValueAtTime(0.0001, this.now());
    gain.gain.exponentialRampToValueAtTime(gainPeak, this.now() + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.now() + durationSec);
    osc.connect(gain).connect(this.masterGain);
    osc.start();
    osc.stop(this.now() + durationSec + 0.02);
  }

  private noiseBurst(durationSec: number, gainPeak: number, filterFreq = 1200): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, this.now());
    gain.gain.exponentialRampToValueAtTime(0.0001, this.now() + durationSec);
    src.connect(filter).connect(gain).connect(this.masterGain);
    src.start();
  }

  playLaunch(): void {
    this.tone(220, 0.18, 'sawtooth', 0.25, 620);
  }

  playImpact(material: MaterialId): void {
    switch (material) {
      case 'metal':
        this.tone(340, 0.12, 'square', 0.2, 140);
        break;
      case 'concrete':
        this.noiseBurst(0.12, 0.3, 500);
        break;
      case 'wood':
        this.tone(180, 0.09, 'triangle', 0.18, 90);
        break;
      case 'glass':
        this.tone(1400, 0.08, 'sine', 0.15, 2200);
        break;
      default:
        this.noiseBurst(0.1, 0.2, 800);
    }
  }

  playBreak(material: MaterialId): void {
    this.playImpact(material);
    this.noiseBurst(0.22, 0.28, material === 'glass' ? 3000 : 700);
    if (material === 'concrete' || material === 'metal') this.tone(90, 0.3, 'sawtooth', 0.2, 40);
  }

  playCableSnap(): void {
    this.tone(900, 0.06, 'sawtooth', 0.25, 120);
    this.noiseBurst(0.05, 0.15, 2500);
  }

  playHeavyFall(): void {
    this.tone(70, 0.4, 'sine', 0.3, 35);
    this.noiseBurst(0.3, 0.2, 300);
  }

  playExplosion(): void {
    this.noiseBurst(0.6, 0.45, 900);
    this.tone(60, 0.5, 'sawtooth', 0.35, 25);
  }

  playChain(chainLength: number): void {
    const freq = 440 + chainLength * 60;
    this.tone(freq, 0.1, 'sine', 0.2 + Math.min(chainLength, 6) * 0.02, freq * 1.4);
  }

  playCombo(): void {
    this.tone(660, 0.08, 'square', 0.18, 900);
  }

  playMegaCollapse(): void {
    this.noiseBurst(1.1, 0.5, 400);
    this.tone(50, 0.9, 'sawtooth', 0.4, 20);
  }

  playVictory(): void {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.22), i * 90));
  }

  playPerfectCollapse(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.26, f * 1.05), i * 80));
  }
}
