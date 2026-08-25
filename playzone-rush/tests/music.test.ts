/**
 * Motor de musica: lo que se prueba aqui es el PLANIFICADOR, que es la parte
 * de la que depende que un juego de ritmo sea jugable.
 *
 * No se comprueba que "suene bien" (eso no se puede automatizar), sino que las
 * notas quedan programadas por delante y en los instantes correctos aunque el
 * temporizador del navegador llegue tarde. Se usa un contexto de audio falso
 * que apunta que se programa y cuando.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MusicEngine, STEPS_PER_BAR, THEMES } from '../src/core/music';
import type { AudioBus } from '../src/core/audio';

/** Nodo de audio falso: solo apunta las llamadas, no suena nada. */
function fakeNode() {
  return {
    type: '',
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(function (this: unknown, dest: unknown) {
      return dest;
    }),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null as unknown,
  };
}

function fakeAudio() {
  const started: number[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 48_000,
    createOscillator: () => {
      const node = fakeNode();
      node.start = vi.fn((t: number) => started.push(t));
      return node;
    },
    createGain: () => fakeNode(),
    createBiquadFilter: () => fakeNode(),
    createBufferSource: () => {
      const node = fakeNode();
      node.start = vi.fn((t: number) => started.push(t));
      return node;
    },
    createBuffer: (_ch: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    }),
  };
  const out = fakeNode();
  const bus = {
    muted: false,
    musicChannel: () => ({ ctx, out }),
  } as unknown as AudioBus;
  return { bus, ctx, started };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * Avanza el tiempo del temporizador Y el del reloj de audio a la vez, que es
 * lo que pasa de verdad. Si solo se mueve el temporizador, el planificador
 * llena la ventana de anticipacion una vez y para — comportamiento correcto,
 * pero que no deja ver si el compas se mantiene.
 */
function avanzar(ctx: { currentTime: number }, ms: number, paso = 10): void {
  for (let restante = ms; restante > 0; restante -= paso) {
    const trozo = Math.min(paso, restante);
    ctx.currentTime += trozo / 1000;
    vi.advanceTimersByTime(trozo);
  }
}

describe('planificador de musica', () => {
  it('programa notas por delante, no en el momento de sonar', () => {
    const { bus, ctx, started } = fakeAudio();
    const music = new MusicEngine(bus);
    music.start('ritmo', { intensity: 1 });

    vi.advanceTimersByTime(30); // un solo tick del temporizador

    // Con una sola vuelta ya tiene que haber varias notas puestas: todas las
    // que caen en la ventana de anticipacion, no solo la de ahora mismo.
    expect(started.length).toBeGreaterThan(1);
    // Y todas por delante del reloj actual.
    for (const t of started) expect(t).toBeGreaterThanOrEqual(ctx.currentTime);
    music.stop();
  });

  it('los pasos caen separados exactamente por la duracion de semicorchea', () => {
    const { bus, ctx } = fakeAudio();
    const music = new MusicEngine(bus);
    const beats: number[] = [];
    music.onBeat((b) => beats.push(b.time));
    music.start('ritmo', { intensity: 1 });

    avanzar(ctx, 800);
    music.stop();

    expect(beats.length).toBeGreaterThan(2);
    const paso = music.stepDuration;
    for (let i = 1; i < beats.length; i++) {
      expect((beats[i] as number) - (beats[i - 1] as number)).toBeCloseTo(paso, 6);
    }
  });

  it('un temporizador que llega tarde no descuadra el compas', () => {
    const { bus, ctx } = fakeAudio();
    const music = new MusicEngine(bus);
    const beats: number[] = [];
    music.onBeat((b) => beats.push(b.time));
    music.start('ritmo', { intensity: 1 });

    // El navegador se atasca: pasa medio segundo real de golpe.
    ctx.currentTime = 0.5;
    vi.advanceTimersByTime(30);
    music.stop();

    // Se recuperan todos los pasos perdidos, sin huecos ni saltos.
    const paso = music.stepDuration;
    for (let i = 1; i < beats.length; i++) {
      expect((beats[i] as number) - (beats[i - 1] as number)).toBeCloseTo(paso, 6);
    }
  });

  it('marca como fuertes solo las negras', () => {
    const { bus, ctx } = fakeAudio();
    const music = new MusicEngine(bus);
    const fuertes: number[] = [];
    music.onBeat((b) => {
      if (b.strong) fuertes.push(b.step);
    });
    music.start('ritmo', { intensity: 1 });
    avanzar(ctx, 1200);
    music.stop();

    expect(fuertes.length).toBeGreaterThan(0);
    for (const step of fuertes) expect(step % 4).toBe(0);
  });

  it('con intensidad baja suena menos que con intensidad alta', () => {
    const flojo = fakeAudio();
    const fuerte = fakeAudio();

    const a = new MusicEngine(flojo.bus);
    a.start('ritmo', { intensity: 0.1 });
    avanzar(flojo.ctx, 1500);
    a.stop();

    const b = new MusicEngine(fuerte.bus);
    b.start('ritmo', { intensity: 1 });
    avanzar(fuerte.ctx, 1500);
    b.stop();

    expect(fuerte.started.length).toBeGreaterThan(flojo.started.length);
  });

  it('en silencio no programa nada', () => {
    const { bus, ctx, started } = fakeAudio();
    (bus as { muted: boolean }).muted = true;
    const music = new MusicEngine(bus);
    music.start('ritmo', { intensity: 1 });
    avanzar(ctx, 1000);
    music.stop();

    expect(started).toHaveLength(0);
  });

  it('stop() deja de programar', () => {
    const { bus, ctx, started } = fakeAudio();
    const music = new MusicEngine(bus);
    music.start('ritmo', { intensity: 1 });
    avanzar(ctx, 400);
    const antes = started.length;
    music.stop();
    avanzar(ctx, 1000);

    expect(started.length).toBe(antes);
    expect(music.playing).toBe(false);
  });

  it('todos los temas tienen patrones de la longitud del compas', () => {
    for (const [nombre, tema] of Object.entries(THEMES)) {
      expect(tema.bass, nombre).toHaveLength(STEPS_PER_BAR);
      expect(tema.lead, nombre).toHaveLength(STEPS_PER_BAR);
      expect(tema.bpm, nombre).toBeGreaterThan(60);
      expect(tema.scale.length, nombre).toBeGreaterThan(2);
    }
  });

  it('un tema que no existe no revienta', () => {
    const { bus } = fakeAudio();
    const music = new MusicEngine(bus);
    expect(() => music.start('no-existe')).not.toThrow();
    expect(music.playing).toBe(false);
  });
});
