/**
 * AUDIO — sonido sintetizado, cero archivos.
 *
 * En un juego donde no puedes verlo todo, oír ES otra forma de ver. Por eso
 * el audio no es decoración de última hora: es un canal de información con
 * las mismas reglas espaciales que la luz — paneo estéreo por posición y
 * atenuación por distancia. Los pasos de un enemigo a tu izquierda SUENAN a
 * tu izquierda, y eso es jugable.
 *
 * Todo se genera con osciladores y ruido en el momento. Placeholders: no
 * gastamos tiempo en una biblioteca de samples antes de saber si el juego
 * funciona. La API (`play(nombre, x, y)`) no cambia cuando lleguen los
 * sonidos definitivos.
 *
 * iOS exige un gesto del usuario antes de sonar: de ahí `unlock()`.
 */

import { Config } from '../config/Config.js';
import { clamp } from '../core/MathUtils.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.listenerX = 0;
    this.listenerY = 0;
    this.ready = false;
    this.breath = null;
  }

  /** Debe llamarse dentro de un gesto del usuario (toque, tecla, clic). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = Config.audio.enabled ? Config.audio.master : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.#makeNoise(2.0);
    this.ready = true;
    this.#startAmbience();
  }

  setListener(x, y) { this.listenerX = x; this.listenerY = y; }

  setMuted(muted) {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(muted ? 0 : Config.audio.master, this.ctx.currentTime, 0.05);
  }

  #makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /**
   * Cadena espacial: fuente → filtro → ganancia(distancia) → paneo → master.
   * Devuelve null si la fuente está tan lejos que no aporta información.
   */
  #spatial(x, y, gain) {
    const dx = x - this.listenerX;
    const dy = y - this.listenerY;
    const d = Math.hypot(dx, dy);
    const atten = clamp(1 - d / Config.audio.falloff, 0, 1);
    if (atten <= 0.004) return null;

    const g = this.ctx.createGain();
    g.gain.value = gain * atten * atten;   // cuadrática: la distancia se nota
    const pan = this.ctx.createStereoPanner
      ? this.ctx.createStereoPanner()
      : null;
    if (pan) {
      pan.pan.value = clamp(dx / Config.audio.panWidth, -1, 1);
      g.connect(pan);
      pan.connect(this.master);
    } else {
      g.connect(this.master); // Safari antiguo: mono, pero suena
    }
    return g;
  }

  #burst(dest, { dur = 0.1, freq = 900, q = 1, type = 'bandpass', vol = 1, curve = 3 }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const env = this.ctx.createGain();
    const t = this.ctx.currentTime;
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(filt); filt.connect(env); env.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
    // Barrido descendente del filtro: convierte un "shhh" plano en un golpe.
    filt.frequency.setValueAtTime(freq, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(90, freq / curve), t + dur);
  }

  #tone(dest, { f0 = 200, f1 = 60, dur = 0.15, vol = 0.5, type = 'sine' }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    const env = this.ctx.createGain();
    const t = this.ctx.currentTime;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env.gain.setValueAtTime(vol, t);
    env.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(env); env.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  /** Zumbido de fondo continuo. Da presencia al vacío y enmascara el silencio. */
  #startAmbience() {
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.055;
    g.connect(this.master);

    for (const f of [47, 71.5]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.07 + Math.random() * 0.06;
      lfoGain.gain.value = f * 0.012;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      osc.connect(g);
      osc.start(t); lfo.start(t);
    }

    // Capa de aire: ruido muy filtrado, casi subliminal.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 220;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.05;
    src.connect(filt); filt.connect(ng); ng.connect(this.master);
    src.start(t);
  }

  /**
   * @param {string} name  identificador del sonido
   * @param {number} x,y   posición en el mundo (para paneo y distancia)
   */
  play(name, x, y, opts = {}) {
    if (!this.ready || !Config.audio.enabled) return;
    const gainFor = {
      shot: 0.85, enemyShot: 0.6, impact: 0.4, shell: 0.28,
      step: Config.audio.footstepVolume, enemyStep: Config.audio.footstepVolume * 1.15,
      hurt: 0.9, enemyHit: 0.55, enemyDie: 0.7, pickup: 0.5,
      reload: 0.45, alert: 0.6, dryFire: 0.4, playerDie: 1.0,
    }[name] ?? 0.5;

    const dest = this.#spatial(x, y, gainFor);
    if (!dest) return;

    switch (name) {
      case 'shot':
        this.#burst(dest, { dur: 0.16, freq: 2600, q: 0.6, vol: 0.9, curve: 9 });
        this.#tone(dest, { f0: 220, f1: 42, dur: 0.2, vol: 0.75 });
        this.#tone(dest, { f0: 1100, f1: 300, dur: 0.05, vol: 0.3, type: 'square' });
        break;
      case 'enemyShot':
        this.#burst(dest, { dur: 0.14, freq: 1500, q: 0.8, vol: 0.7, curve: 6 });
        this.#tone(dest, { f0: 150, f1: 48, dur: 0.18, vol: 0.5 });
        break;
      case 'impact':
        this.#burst(dest, { dur: 0.07, freq: 3400, q: 1.6, vol: 0.8, curve: 5 });
        this.#tone(dest, { f0: 340, f1: 110, dur: 0.06, vol: 0.25 });
        break;
      case 'shell':
        // Casquillo: dos parciales metálicos y un rebote a destiempo.
        this.#tone(dest, { f0: 3100, f1: 2400, dur: 0.05, vol: 0.22, type: 'triangle' });
        setTimeout(() => {
          if (!this.ready) return;
          const d2 = this.#spatial(x, y, gainFor * 0.6);
          if (d2) this.#tone(d2, { f0: 2600, f1: 1900, dur: 0.04, vol: 0.18, type: 'triangle' });
        }, 90 + Math.random() * 70);
        break;
      case 'step':
      case 'enemyStep':
        this.#burst(dest, {
          dur: 0.085, freq: name === 'step' ? 380 : 300, q: 1.1,
          vol: 0.55, curve: 2.4,
        });
        break;
      case 'hurt':
        this.#burst(dest, { dur: 0.3, freq: 700, q: 0.5, vol: 0.9, curve: 4 });
        this.#tone(dest, { f0: 130, f1: 55, dur: 0.35, vol: 0.7, type: 'sawtooth' });
        break;
      case 'enemyHit':
        this.#burst(dest, { dur: 0.09, freq: 1200, q: 1.2, vol: 0.7, curve: 3 });
        break;
      case 'enemyDie':
        this.#tone(dest, { f0: 420, f1: 38, dur: 0.55, vol: 0.6, type: 'sawtooth' });
        this.#burst(dest, { dur: 0.4, freq: 900, q: 0.5, vol: 0.5, curve: 6 });
        break;
      case 'playerDie':
        this.#tone(dest, { f0: 90, f1: 26, dur: 1.4, vol: 0.9, type: 'sawtooth' });
        break;
      case 'pickup':
        this.#tone(dest, { f0: 780, f1: 1560, dur: 0.09, vol: 0.4, type: 'triangle' });
        break;
      case 'reload':
        this.#tone(dest, { f0: 1500, f1: 700, dur: 0.04, vol: 0.35, type: 'square' });
        setTimeout(() => {
          if (!this.ready) return;
          const d2 = this.#spatial(x, y, gainFor);
          if (d2) this.#tone(d2, { f0: 1100, f1: 480, dur: 0.05, vol: 0.35, type: 'square' });
        }, Math.max(60, opts.delay ?? 220));
        break;
      case 'dryFire':
        this.#tone(dest, { f0: 900, f1: 400, dur: 0.035, vol: 0.4, type: 'square' });
        break;
      case 'alert':
        // Aviso de que te han visto. Ascendente: es una amenaza, no un premio.
        this.#tone(dest, { f0: 180, f1: 640, dur: 0.28, vol: 0.5, type: 'sawtooth' });
        break;
    }
  }

  /**
   * Respiración enemiga: drone continuo cuya intensidad marca la proximidad
   * del enemigo MÁS cercano. Es el sonar del jugador cuando no ve nada.
   */
  updateBreath(nearestDist) {
    if (!this.ready || !Config.audio.enabled) return;
    if (!this.breath) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 62;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 180;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.55;          // ritmo de respiración
      lfoGain.gain.value = 0.5;
      const lfoBase = this.ctx.createGain();
      lfoBase.gain.value = 0;
      lfo.connect(lfoGain); lfoGain.connect(lfoBase.gain);
      osc.connect(filt); filt.connect(g); g.connect(lfoBase); lfoBase.connect(this.master);
      osc.start(); lfo.start();
      this.breath = { g, lfoBase };
    }
    const t = clamp(1 - nearestDist / Config.audio.enemyBreathRange, 0, 1);
    this.breath.g.gain.setTargetAtTime(t * t * 0.5, this.ctx.currentTime, 0.25);
  }
}
