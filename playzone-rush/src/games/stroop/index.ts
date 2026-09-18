/**
 * STROOP - reflejos con el cerebro en contra.
 *
 * Sale la palabra ROJO escrita en azul. Hay que tocar el AZUL. Leer es
 * automatico y mirar el color no lo es, asi que el cerebro se pelea consigo
 * mismo: por eso cuesta, y por eso pica.
 *
 * Habilidad que mide: inhibicion. Ignorar lo que se lee para responder a lo
 * que se ve.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#a855f7';

interface Tinta {
  nombre: string;
  color: string;
}

const TINTAS: Tinta[] = [
  { nombre: 'ROJO', color: '#ef4444' },
  { nombre: 'AZUL', color: '#3b82f6' },
  { nombre: 'VERDE', color: '#22c55e' },
  { nombre: 'AMBAR', color: '#f59e0b' },
];

interface Boton {
  tinta: Tinta;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const META: GameMeta = {
  id: 'stroop',
  name: 'STROOP',
  tagline: 'Toca el color de la tinta, no lo que pone.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Sale una palabra escrita en un color.',
    'Toca el boton del COLOR DE LA TINTA, no el de la palabra.',
    'Si tardas demasiado, la pierdes. Encadena para multiplicar.',
  ],
  icon: '🎨',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'chaos'],
};

class StroopGame extends BaseMiniGame {
  readonly meta = META;

  private botones: Boton[] = [];
  private palabra: Tinta = TINTAS[0] as Tinta;
  private tinta: Tinta = TINTAS[1] as Tinta;
  private restante = 0;
  private limite = 1;
  private aciertos = 0;
  private fallos = 0;
  private time = 0;
  private sacudida = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
    this.colocarBotones();
  }

  protected setup(): void {
    this.aciertos = 0;
    this.fallos = 0;
    this.time = 0;
    this.sacudida = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
    this.colocarBotones();
    this.nuevaRonda();
  }

  protected override onResize(): void {
    this.colocarBotones();
  }

  private colocarBotones(): void {
    // Rejilla 2x2 en la mitad de abajo: el pulgar llega a las cuatro.
    const margen = this.width * 0.07;
    const hueco = this.width * 0.04;
    const ancho = (this.width - margen * 2 - hueco) / 2;
    const alto = Math.min(ancho * 0.62, this.areaHeight * 0.17);
    const base = this.areaBottom - alto * 2 - hueco - 18;
    this.botones = TINTAS.map((tinta, i) => ({
      tinta,
      x: margen + (i % 2) * (ancho + hueco),
      y: base + Math.floor(i / 2) * (alto + hueco),
      w: ancho,
      h: alto,
    }));
  }

  private nuevaRonda(): void {
    const tinta = this.rng.pick(TINTAS);
    // La palabra casi nunca coincide con la tinta: si coinciden es regalo, y
    // un regalo de vez en cuando mantiene el ritmo sin quitar dificultad.
    const palabra = this.rng.chance(0.15) ? tinta : this.rng.pick(TINTAS.filter((t) => t !== tinta));
    this.tinta = tinta;
    this.palabra = palabra as Tinta;
    this.limite = Math.max(
      0.72,
      (2.1 - this.config.difficulty * 0.4 - this.progress * 0.55) / Math.max(0.6, this.mut.speed),
    );
    this.restante = this.limite;
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.restante -= dt;
    this.sacudida = Math.max(0, this.sacudida - dt * 5);

    for (const punto of this.tapPoints()) {
      const boton = this.botones.find(
        (b) => punto.x >= b.x && punto.x <= b.x + b.w && punto.y >= b.y && punto.y <= b.y + b.h,
      );
      if (!boton) continue;
      if (boton.tinta === this.tinta) this.acierto(boton);
      else this.fallo('ESE ES EL QUE PONE', true);
      return;
    }

    if (this.restante <= 0) this.fallo('DEMASIADO LENTO', false);
  }

  private acierto(boton: Boton): void {
    this.aciertos++;
    this.registerHit();
    const combo = this.bumpCombo();
    const rapidez = Math.max(0, this.restante / this.limite); // 1 = instantaneo
    const multiplicador = 1 + Math.min(10, combo) * 0.07;
    this.addScore(Math.round((45 + rapidez * 95) * multiplicador), boton.x + boton.w / 2, boton.y);
    this.services.audio.play('hit');
    this.services.haptics.fire('light');
    this.services.fx.burst(boton.x + boton.w / 2, boton.y + boton.h / 2, {
      count: 12,
      color: boton.tinta.color,
      speed: 230,
      size: 4,
    });
    this.nuevaRonda();
  }

  /** `activo` = has tocado el boton equivocado. Quedarte en blanco no mata. */
  private fallo(motivo: string, activo: boolean): void {
    this.fallos++;
    if (activo) {
      this.registerMistake(35);
    } else {
      this.misses++;
      this.breakCombo();
    }
    this.announce(motivo, 'bad');
    this.services.audio.play('error');
    this.services.haptics.fire('error');
    this.services.fx.flash('#ef4444', 0.2);
    this.sacudida = 1;
    this.nuevaRonda();
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, this.tinta.color, this.time * 8, this.width / 3);

    const cx = this.width / 2;
    const cy = this.areaTop + this.areaHeight * 0.26;

    // La palabra, con un temblor breve cuando se falla.
    const tiembla = this.sacudida > 0 ? Math.sin(this.time * 60) * this.sacudida * 8 : 0;
    const tam = Math.min(this.width * 0.19, this.areaHeight * 0.13);
    label(ctx, this.palabra.nombre, cx + tiembla, cy, { size: tam, color: this.tinta.color });

    // Cuenta atras de la ronda: una barra fina que se vacia.
    const anchoBarra = this.width * 0.5;
    const t = Math.max(0, this.restante / this.limite);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cx - anchoBarra / 2, cy + tam * 0.75, anchoBarra, 5, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = t < 0.3 ? '#ef4444' : hexToRgba('#ffffff', 0.85);
    roundRect(ctx, cx - anchoBarra / 2, cy + tam * 0.75, anchoBarra * t, 5, 3);
    ctx.fill();

    label(ctx, 'TOCA EL COLOR, NO LA PALABRA', cx, cy + tam * 0.75 + 28, {
      size: 12,
      color: hexToRgba('#ffffff', 0.4),
    });

    for (const boton of this.botones) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = boton.tinta.color;
      roundRect(ctx, boton.x, boton.y, boton.w, boton.h, 16);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      roundRect(ctx, boton.x, boton.y, boton.w, boton.h, 16);
      ctx.stroke();
      ctx.restore();
    }
  }

  protected override metrics(): Record<string, number> {
    return { aciertos: this.aciertos, fallos: this.fallos };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'stroop', palabra: this.palabra.nombre, tinta: this.tinta.nombre, restante: this.restante };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new StroopGame(services, config),
};
