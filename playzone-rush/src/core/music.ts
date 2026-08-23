/**
 * Musica procedural por capas.
 *
 * Cero ficheros de audio: se genera con osciladores, igual que los efectos.
 * Un tema son cuatro cosas —tempo, escala, patron de bajo y patron de lead—
 * y con eso cada juego suena distinto sin descargar un solo byte.
 *
 * EL PUNTO IMPORTANTE: el planificador con anticipacion.
 *
 * setTimeout y setInterval en el navegador son imprecisos (se van decenas de
 * milisegundos, y mas si la pestana pierde el foco). El reloj de WebAudio, en
 * cambio, es exacto. Asi que aqui NO se toca una nota cuando salta el timer:
 * el timer solo despierta cada 25 ms, mira que notas caen en los proximos
 * 150 ms, y las deja PROGRAMADAS en el reloj de audio con su instante exacto.
 * El timer puede llegar tarde sin que se note, porque las notas ya estaban
 * puestas.
 *
 * Sin esto, un juego de ritmo no se sostiene: el compas se oiria irregular y
 * el jugador no podria acertar aunque lo hiciera todo bien.
 */
import type { AudioBus } from './audio';

/** Pasos por compas. 16 = semicorcheas, la rejilla habitual. */
export const STEPS_PER_BAR = 16;

export interface MusicTheme {
  /** Pulsos por minuto. */
  bpm: number;
  /** Semitonos sobre la tonica que forman la escala. */
  scale: number[];
  /** Nota tonica (MIDI: 57 = La2). */
  root: number;
  /** Que pasos llevan bombo. */
  kick: number[];
  /** Que pasos llevan caja. */
  snare: number[];
  /** Que pasos llevan charles. */
  hat: number[];
  /** Grado de la escala por paso; -1 = silencio. */
  bass: number[];
  /** Igual, para la melodia. Suena solo con intensidad alta. */
  lead: number[];
  bassWave: OscillatorType;
  leadWave: OscillatorType;
}

const N = -1; // silencio, mas legible que -1 dentro de los patrones

/**
 * Los temas. Cada uno busca un caracter distinto, no solo notas distintas:
 * DRIFT tiene que sonar a tension sostenida y MEMORY a calculo frio.
 */
export const THEMES: Record<string, MusicTheme> = {
  // Tenso, empujando hacia delante. Para supervivencia.
  drift: {
    bpm: 132,
    root: 45,
    scale: [0, 2, 3, 5, 7, 8, 10], // menor natural
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    bass: [0, N, N, 0, N, 0, N, N, 4, N, N, 4, N, 3, N, N],
    lead: [N, N, 7, N, N, 5, N, N, N, N, 4, N, N, N, 3, N],
    bassWave: 'sawtooth',
    leadWave: 'square',
  },
  // Nervioso y brillante. Para reflejos.
  pulse: {
    bpm: 140,
    root: 48,
    scale: [0, 2, 4, 7, 9], // pentatonica mayor
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, N, 0, N, 2, N, N, N, 4, N, 4, N, 2, N, N, N],
    lead: [7, N, N, 4, N, 2, N, N, 7, N, N, 9, N, 7, N, N],
    bassWave: 'square',
    leadWave: 'triangle',
  },
  // Frio, calculado, con espacio. Para memoria.
  memory: {
    bpm: 96,
    root: 50,
    scale: [0, 2, 3, 5, 7, 10],
    kick: [0, 8],
    snare: [8],
    hat: [4, 12],
    bass: [0, N, N, N, N, N, N, N, 3, N, N, N, N, N, N, N],
    lead: [N, N, N, N, 5, N, N, N, N, N, N, N, 3, N, 2, N],
    bassWave: 'triangle',
    leadWave: 'sine',
  },
  // Preciso, seco. Para punteria.
  snap: {
    bpm: 124,
    root: 47,
    scale: [0, 3, 5, 6, 7, 10], // blues
    kick: [0, 3, 8, 11],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    bass: [0, N, 3, N, N, 0, N, N, 5, N, N, 3, N, N, 0, N],
    lead: [N, N, N, 6, N, N, 5, N, N, N, N, 3, N, N, N, N],
    bassWave: 'sawtooth',
    leadWave: 'square',
  },
  // Fiesta. Para el juego de ritmo.
  ritmo: {
    bpm: 128,
    root: 48,
    scale: [0, 2, 4, 5, 7, 9, 11],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    bass: [0, N, N, 0, N, N, 5, N, 4, N, N, 4, N, N, 2, N],
    lead: [7, N, 9, N, 11, N, 9, N, 7, N, 4, N, 2, N, N, N],
    bassWave: 'sawtooth',
    leadWave: 'square',
  },
  // Roto a proposito, incomodo. Para el evento CHAOS.
  chaos: {
    bpm: 150,
    root: 44,
    scale: [0, 1, 4, 6, 7, 10], // con tritono, deliberadamente inestable
    kick: [0, 3, 6, 9, 12],
    snare: [5, 11],
    hat: [1, 3, 5, 7, 9, 11, 13, 15],
    bass: [0, N, 1, N, 6, N, N, 4, N, 6, N, N, 1, N, 0, N],
    lead: [N, 6, N, 10, N, N, 7, N, N, 1, N, 6, N, N, 4, N],
    bassWave: 'square',
    leadWave: 'sawtooth',
  },
  // Portada: calmado, invita sin agobiar.
  home: {
    bpm: 100,
    root: 45,
    scale: [0, 2, 3, 5, 7, 8, 10],
    kick: [0, 8],
    snare: [],
    hat: [4, 12],
    bass: [0, N, N, N, N, N, 4, N, N, N, N, N, 3, N, N, N],
    lead: [N, N, 7, N, N, N, N, N, N, N, 5, N, N, N, N, N],
    bassWave: 'triangle',
    leadWave: 'sine',
  },
};

/** Si existe tema para ese nombre. El host prefiere silencio a un tema ajeno. */
export function hasTheme(name: string): boolean {
  return name in THEMES;
}

/** MIDI a hercios. */
function hz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Grado de la escala a nota MIDI, subiendo de octava si se pasa. */
function noteFor(theme: MusicTheme, degree: number): number {
  const octave = Math.floor(degree / theme.scale.length);
  const index = ((degree % theme.scale.length) + theme.scale.length) % theme.scale.length;
  return theme.root + (theme.scale[index] as number) + octave * 12;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.15;

export interface BeatInfo {
  /** Paso dentro del compas, 0..15. */
  step: number;
  /** Instante exacto en el reloj de audio. */
  time: number;
  /** true si cae en negra (los pasos 0, 4, 8, 12). */
  strong: boolean;
}

export class MusicEngine {
  private bus: AudioBus;
  private theme: MusicTheme | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private _intensity = 0.6;
  private beatListeners: ((beat: BeatInfo) => void)[] = [];

  constructor(bus: AudioBus) {
    this.bus = bus;
  }

  get playing(): boolean {
    return this.timer !== null;
  }

  /**
   * Reloj de audio, que es el unico fiable para juzgar el ritmo.
   *
   * performance.now() y el reloj del bucle de render van por su cuenta y se
   * desvian del audio; comparar un toque contra el compas usando otra cosa
   * que no sea esto da fallos que el jugador no entiende. Devuelve -1 si no
   * hay contexto (todavia sin gesto del usuario, o navegador sin WebAudio).
   */
  get now(): number {
    return this.bus.musicChannel()?.ctx.currentTime ?? -1;
  }

  get bpm(): number {
    return this.theme?.bpm ?? 120;
  }

  /** Duracion de un paso (semicorchea) en segundos. */
  get stepDuration(): number {
    return 60 / this.bpm / 4;
  }

  /**
   * Sube o baja la tension sin cambiar de tema: con poca intensidad solo
   * queda la percusion, y segun sube entran bajo y melodia. Sirve para que la
   * musica acompane lo que pasa en la partida (combo alto, tiempo acabandose)
   * en vez de sonar igual de principio a fin.
   */
  setIntensity(value: number): void {
    this._intensity = Math.max(0, Math.min(1, value));
  }

  get intensity(): number {
    return this._intensity;
  }

  /**
   * Avisa en cada paso, con el instante EXACTO en que va a sonar.
   *
   * Lo usa el juego de ritmo: necesita saber cuando cae el pulso en el reloj
   * de audio, no cuando se entero el navegador. Devuelve la funcion para
   * darse de baja.
   */
  onBeat(listener: (beat: BeatInfo) => void): () => void {
    this.beatListeners.push(listener);
    return () => {
      this.beatListeners = this.beatListeners.filter((fn) => fn !== listener);
    };
  }

  start(themeName: string, options: { intensity?: number } = {}): void {
    const theme = THEMES[themeName];
    if (!theme) return;
    const channel = this.bus.musicChannel();
    if (!channel) return;

    this.stop();
    this.theme = theme;
    this._intensity = options.intensity ?? this._intensity;
    this.step = 0;
    this.nextStepTime = channel.ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Cambia de tema sin cortar: termina el compas y entra el nuevo. */
  switchTo(themeName: string): void {
    const theme = THEMES[themeName];
    if (!theme || theme === this.theme) return;
    if (!this.playing) {
      this.start(themeName);
      return;
    }
    this.theme = theme;
  }

  private tick(): void {
    const channel = this.bus.musicChannel();
    const theme = this.theme;
    if (!channel || !theme) return;

    // Se programa todo lo que cae dentro de la ventana de anticipacion. El
    // bucle puede meter varias notas de golpe si el timer llego tarde: es
    // justo lo que evita que se oiga el retraso.
    while (this.nextStepTime < channel.ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.scheduleStep(theme, this.step, this.nextStepTime);
      this.nextStepTime += this.stepDuration;
      this.step = (this.step + 1) % STEPS_PER_BAR;
    }
  }

  private scheduleStep(theme: MusicTheme, step: number, time: number): void {
    const channel = this.bus.musicChannel();
    if (!channel || this.bus.muted) return;
    const { ctx, out } = channel;
    const i = this._intensity;

    for (const listener of this.beatListeners) {
      listener({ step, time, strong: step % 4 === 0 });
    }

    if (theme.kick.includes(step)) this.kick(ctx, out, time);
    if (i > 0.25 && theme.snare.includes(step)) this.snare(ctx, out, time);
    if (i > 0.45 && theme.hat.includes(step)) this.hat(ctx, out, time, 0.05 + i * 0.05);

    const bassDegree = theme.bass[step];
    if (i > 0.15 && bassDegree !== undefined && bassDegree !== N) {
      this.voice(ctx, out, hz(noteFor(theme, bassDegree) - 12), time, this.stepDuration * 2.6, {
        wave: theme.bassWave,
        gain: 0.1 + i * 0.05,
      });
    }

    // La melodia solo entra cuando la cosa se pone seria.
    const leadDegree = theme.lead[step];
    if (i > 0.62 && leadDegree !== undefined && leadDegree !== N) {
      this.voice(ctx, out, hz(noteFor(theme, leadDegree) + 12), time, this.stepDuration * 1.7, {
        wave: theme.leadWave,
        gain: 0.045 + (i - 0.62) * 0.09,
      });
    }
  }

  private voice(
    ctx: AudioContext,
    out: GainNode,
    freq: number,
    time: number,
    duration: number,
    options: { wave: OscillatorType; gain: number },
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // El filtro se abre con la intensidad: mas brillo cuando hay mas tension.
    filter.frequency.value = 700 + this._intensity * 3200;
    osc.type = options.wave;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(options.gain, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter).connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  private kick(ctx: AudioContext, out: GainNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
    gain.gain.setValueAtTime(0.34, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private snare(ctx: AudioContext, out: GainNode, time: number): void {
    const frames = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 1.6;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    const gain = ctx.createGain();
    gain.gain.value = 0.16;
    src.connect(filter).connect(gain).connect(out);
    src.start(time);
  }

  private hat(ctx: AudioContext, out: GainNode, time: number, level: number): void {
    const frames = Math.floor(ctx.sampleRate * 0.035);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7200;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(out);
    src.start(time);
  }
}
