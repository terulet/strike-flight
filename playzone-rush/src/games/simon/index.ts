/**
 * SIMON - la secuencia que siempre crece uno mas.
 *
 * Mira y repite. Cada ronda anade un paso, asi que la ronda que te sabes es
 * la anterior: siempre estas apostando el trabajo de toda la partida al paso
 * nuevo. Por eso duele fallar en la octava.
 *
 * Habilidad que mide: memoria de secuencia bajo presion.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#38bdf8';

const COLORES = ['#ef4444', '#38bdf8', '#4ade80', '#facc15'];
/** Un tono por boton: la secuencia tambien se recuerda de oido. */
const NOTAS = [0, 1, 2, 3];

type Fase = 'mostrando' | 'repitiendo' | 'premio' | 'error';

interface Boton {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  brillo: number;
}

export const META: GameMeta = {
  id: 'simon',
  name: 'SIMON',
  tagline: 'Mira la secuencia y repitela. Una mas cada vez.',
  skill: 'memoria',
  defaultDurationMs: 30_000,
  instructions: [
    'Mira la secuencia que se enciende.',
    'Repitela tocando los botones en el mismo orden.',
    'Cada ronda anade un paso. Fallar cuesta una vida.',
  ],
  icon: '🔴',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'chaos'],
};

class SimonGame extends BaseMiniGame {
  readonly meta = META;

  private botones: Boton[] = [];
  private secuencia: number[] = [];
  private fase: Fase = 'mostrando';
  private indiceMostrar = 0;
  private indiceRepetir = 0;
  private timer = 0;
  private rondas = 0;
  private mejorRonda = 0;
  private fallos = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
    this.colocar();
  }

  protected setup(): void {
    this.colocar();
    this.secuencia = [];
    this.rondas = 0;
    this.mejorRonda = 0;
    this.fallos = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
    this.nuevaRonda();
  }

  protected override onResize(): void {
    this.colocar();
  }

  private colocar(): void {
    const margen = this.width * 0.06;
    const hueco = this.width * 0.035;
    const ancho = (this.width - margen * 2 - hueco) / 2;
    const alto = Math.min(ancho, (this.areaHeight * 0.74 - hueco) / 2);
    const top = this.areaTop + (this.areaHeight - (alto * 2 + hueco)) / 2;
    this.botones = COLORES.map((color, i) => ({
      x: margen + (i % 2) * (ancho + hueco),
      y: top + Math.floor(i / 2) * (alto + hueco),
      w: ancho,
      h: alto,
      color,
      brillo: 0,
    }));
  }

  /** Lo que dura cada destello al mostrar la secuencia. */
  private get ritmo(): number {
    const base = 0.46 - this.config.difficulty * 0.09 - Math.min(0.14, this.secuencia.length * 0.012);
    return Math.max(0.2, base / Math.max(0.6, this.mut.speed));
  }

  private nuevaRonda(): void {
    this.secuencia.push(this.rng.int(0, 3));
    this.fase = 'mostrando';
    this.indiceMostrar = 0;
    this.indiceRepetir = 0;
    this.timer = 0.45;
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.timer -= dt;
    for (const boton of this.botones) boton.brillo = Math.max(0, boton.brillo - dt * 3.4);

    if (this.fase === 'mostrando') {
      if (this.timer > 0) return;
      if (this.indiceMostrar >= this.secuencia.length) {
        this.fase = 'repitiendo';
        this.timer = 0;
        return;
      }
      const idx = this.secuencia[this.indiceMostrar] as number;
      this.encender(idx, false);
      this.indiceMostrar++;
      this.timer = this.ritmo;
      return;
    }

    if (this.fase === 'premio' || this.fase === 'error') {
      if (this.timer <= 0) this.nuevaRonda();
      return;
    }

    for (const punto of this.tapPoints()) {
      const i = this.botones.findIndex(
        (b) => punto.x >= b.x && punto.x <= b.x + b.w && punto.y >= b.y && punto.y <= b.y + b.h,
      );
      if (i < 0) continue;
      this.pulsar(i);
    }
  }

  private encender(indice: number, propio: boolean): void {
    const boton = this.botones[indice] as Boton;
    boton.brillo = 1;
    this.services.audio.play(propio ? 'tap' : 'select', NOTAS[indice]);
    if (propio) this.services.haptics.fire('tick');
  }

  private pulsar(indice: number): void {
    this.encender(indice, true);
    const esperado = this.secuencia[this.indiceRepetir] as number;

    if (indice !== esperado) {
      this.fallos++;
      this.misses++;
      this.registerMistake(0);
      this.announce(`FALLASTE EN EL PASO ${this.indiceRepetir + 1}`, 'bad');
      this.services.audio.play('error');
      this.services.haptics.fire('error');
      this.services.fx.flash('#ef4444', 0.26);
      this.services.fx.shake(7);
      // Se recorta la secuencia en vez de empezar de cero: sigue habiendo
      // partida, pero el trabajo acumulado se nota perdido.
      this.secuencia = this.secuencia.slice(0, Math.max(0, this.secuencia.length - 2));
      this.fase = 'error';
      this.timer = 0.8;
      return;
    }

    this.indiceRepetir++;
    this.registerHit();
    if (this.indiceRepetir < this.secuencia.length) return;

    this.rondas++;
    if (this.secuencia.length > this.mejorRonda) this.mejorRonda = this.secuencia.length;
    const combo = this.bumpCombo();
    // El premio crece con la longitud: la ronda 8 vale mucho mas que la 2.
    const valor = 60 + this.secuencia.length * 45;
    this.addScore(Math.round(valor * (1 + Math.min(10, combo) * 0.08)), this.width / 2, this.areaTop + 30);
    this.announce(`${this.secuencia.length} DE SEGUIDO`, 'good');
    this.services.audio.play('record');
    this.services.fx.burst(this.width / 2, this.areaTop + this.areaHeight / 2, {
      count: 18,
      color: ACCENT,
      speed: 260,
      size: 4,
    });
    this.fase = 'premio';
    this.timer = 0.6;
  }

  protected draw(): void {
    const ctx = this.ctx;

    for (const boton of this.botones) {
      ctx.save();
      ctx.globalAlpha = 0.22 + boton.brillo * 0.78;
      ctx.fillStyle = boton.color;
      if (boton.brillo > 0.1) {
        ctx.shadowColor = boton.color;
        ctx.shadowBlur = 30 * boton.brillo;
      }
      roundRect(ctx, boton.x, boton.y, boton.w, boton.h, 18);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = boton.color;
      ctx.lineWidth = 2;
      roundRect(ctx, boton.x, boton.y, boton.w, boton.h, 18);
      ctx.stroke();
      ctx.restore();
    }

    const pie = this.areaBottom - 24;
    if (this.fase === 'mostrando') {
      label(ctx, 'MIRA', this.width / 2, pie, { size: 20, color: hexToRgba('#ffffff', 0.7) });
    } else if (this.fase === 'repitiendo') {
      label(ctx, `REPITE · ${this.indiceRepetir}/${this.secuencia.length}`, this.width / 2, pie, {
        size: 20,
        color: ACCENT,
      });
    }

    label(ctx, `MEJOR: ${this.mejorRonda}`, this.width / 2, this.areaTop + 12, {
      size: 12,
      color: hexToRgba('#ffffff', 0.35),
    });
  }

  protected override metrics(): Record<string, number> {
    return { rondas: this.rondas, mejorRonda: this.mejorRonda, fallos: this.fallos };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'simon', secuencia: this.secuencia.length, fase: this.fase };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new SimonGame(services, config),
};
