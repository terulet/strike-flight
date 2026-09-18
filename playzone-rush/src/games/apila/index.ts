/**
 * APILA - la torre que se estrecha sola.
 *
 * El bloque va y viene; tocas y se suelta. Lo que sobresale se cae, asi que
 * cada bloque es un poco mas estrecho que el anterior y el error se paga en
 * la jugada siguiente, no en esta. Clavarlo entero devuelve anchura: de ahi
 * sale la tension de toda la partida.
 *
 * Habilidad que mide: timing puro, con castigo acumulado.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#38bdf8';

interface Bloque {
  x: number;
  ancho: number;
  color: string;
}

interface Resto {
  x: number;
  y: number;
  ancho: number;
  vy: number;
  color: string;
}

export const META: GameMeta = {
  id: 'apila',
  name: 'APILA',
  tagline: 'Sueltalo justo encima. Lo que sobra se cae.',
  skill: 'precision',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca para soltar el bloque encima del anterior.',
    'Lo que sobresalga se cae y la torre se estrecha.',
    'Clavarlo entero da puntos extra y recupera anchura.',
  ],
  icon: '🧱',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'chaos'],
};

class ApilaGame extends BaseMiniGame {
  readonly meta = META;

  private torre: Bloque[] = [];
  private restos: Resto[] = [];
  private actual: Bloque = { x: 0, ancho: 0, color: ACCENT };
  private dir = 1;
  private alturaBloque = 0;
  private perfectos = 0;
  private colocados = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.alturaBloque = Math.max(18, this.areaHeight * 0.055);
    const ancho = this.width * 0.5;
    this.torre = [{ x: (this.width - ancho) / 2, ancho, color: ACCENT }];
    this.restos = [];
    this.perfectos = 0;
    this.colocados = 0;
    this.time = 0;
    this.dir = 1;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.nuevoBloque();
  }

  private get velocidad(): number {
    const base = this.width * (0.55 + this.config.difficulty * 0.35 + this.progress * 0.6);
    return base * Math.max(0.5, this.mut.speed);
  }

  /** Y del borde superior de la torre (con el scroll ya aplicado). */
  private get cima(): number {
    const alto = this.torre.length * this.alturaBloque;
    return Math.max(this.areaTop + this.alturaBloque * 2, this.areaBottom - alto);
  }

  private nuevoBloque(): void {
    const ultimo = this.torre[this.torre.length - 1] as Bloque;
    const tono = 190 + ((this.torre.length * 14) % 130);
    this.actual = {
      x: this.dir > 0 ? 0 : this.width - ultimo.ancho,
      ancho: ultimo.ancho,
      color: `hsl(${tono}, 85%, 62%)`,
    };
  }

  protected tick(dt: number): void {
    this.time += dt;

    this.actual.x += this.dir * this.velocidad * dt;
    if (this.actual.x <= 0) {
      this.actual.x = 0;
      this.dir = 1;
    } else if (this.actual.x + this.actual.ancho >= this.width) {
      this.actual.x = this.width - this.actual.ancho;
      this.dir = -1;
    }

    for (let i = this.restos.length - 1; i >= 0; i--) {
      const resto = this.restos[i] as Resto;
      resto.vy += this.areaHeight * 3 * dt;
      resto.y += resto.vy * dt;
      if (resto.y > this.height) this.restos.splice(i, 1);
    }

    const suelta = this.tapPoints().length > 0 || this.services.input.keyTaps.length > 0;
    if (suelta) this.soltar();
  }

  private soltar(): void {
    const ultimo = this.torre[this.torre.length - 1] as Bloque;
    const izq = Math.max(this.actual.x, ultimo.x);
    const der = Math.min(this.actual.x + this.actual.ancho, ultimo.x + ultimo.ancho);
    const solape = der - izq;
    const y = this.cima - this.alturaBloque;

    if (solape <= 2) {
      // Fuera del todo: la torre se queda como esta y se pierde el bloque.
      this.misses++;
      this.breakCombo();
      this.announce('FUERA', 'bad');
      this.services.audio.play('miss');
      this.restos.push({ x: this.actual.x, y, ancho: this.actual.ancho, vy: 0, color: this.actual.color });
      this.nuevoBloque();
      return;
    }

    const sobra = this.actual.ancho - solape;
    const clavado = sobra <= Math.max(3, this.actual.ancho * 0.045);
    this.colocados++;
    this.registerHit();

    if (clavado) {
      this.perfectos++;
      const combo = this.bumpCombo();
      // Recupera un poco de anchura: premia clavarlo y alarga la partida.
      const ancho = Math.min(this.width * 0.5, solape + this.width * 0.02);
      this.torre.push({ x: izq - (ancho - solape) / 2, ancho, color: this.actual.color });
      this.addScore(Math.round(120 * (1 + Math.min(10, combo) * 0.1)), izq + solape / 2, y);
      this.announce(combo >= 3 ? `${combo} CLAVADOS` : 'CLAVADO', 'good');
      this.services.audio.play('record');
      this.services.haptics.fire('medium');
      this.services.fx.ring(izq + solape / 2, y, this.width * 0.2, ACCENT, 3);
    } else {
      this.breakCombo();
      this.torre.push({ x: izq, ancho: solape, color: this.actual.color });
      this.addScore(Math.round(30 + solape / 6), izq + solape / 2, y);
      this.services.audio.play('hit');
      this.services.haptics.fire('tick');
      // El trozo que sobra cae por el lado por el que sobresalia.
      const restoX = this.actual.x < izq ? this.actual.x : der;
      this.restos.push({ x: restoX, y, ancho: sobra, vy: 0, color: this.actual.color });
    }

    if (solape < this.width * 0.04) {
      this.announce('SE ACABO LA TORRE', 'bad');
      this.services.audio.play('defeat');
      this.finish('death');
      return;
    }
    this.nuevoBloque();
  }

  protected draw(): void {
    const ctx = this.ctx;
    const cima = this.cima;

    // La torre, de arriba abajo desde la cima.
    for (let i = this.torre.length - 1; i >= 0; i--) {
      const bloque = this.torre[i] as Bloque;
      const y = cima + (this.torre.length - 1 - i) * this.alturaBloque;
      if (y > this.areaBottom + this.alturaBloque) break;
      ctx.fillStyle = bloque.color;
      roundRect(ctx, bloque.x, y, bloque.ancho, this.alturaBloque - 2, 4);
      ctx.fill();
    }

    for (const resto of this.restos) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = resto.color;
      roundRect(ctx, resto.x, resto.y, resto.ancho, this.alturaBloque - 2, 4);
      ctx.fill();
      ctx.restore();
    }

    // El bloque en movimiento, separado de la torre para que se vea que vuela.
    const yActual = cima - this.alturaBloque * 2.2;
    ctx.save();
    ctx.shadowColor = this.actual.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = this.actual.color;
    roundRect(ctx, this.actual.x, yActual, this.actual.ancho, this.alturaBloque - 2, 4);
    ctx.fill();
    ctx.restore();

    // Guia vertical: ayuda a leer el solape sin tener que adivinarlo.
    const ultimo = this.torre[this.torre.length - 1] as Bloque;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    for (const x of [ultimo.x, ultimo.x + ultimo.ancho]) {
      ctx.beginPath();
      ctx.moveTo(x, yActual);
      ctx.lineTo(x, cima);
      ctx.stroke();
    }
    ctx.restore();

    label(ctx, `${this.torre.length - 1} PISOS`, this.width / 2, this.areaTop + 16, {
      size: 14,
      color: hexToRgba('#ffffff', 0.5),
    });
  }

  protected override metrics(): Record<string, number> {
    return { pisos: this.torre.length - 1, perfectos: this.perfectos, colocados: this.colocados };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'apila', pisos: this.torre.length - 1, ancho: this.actual.ancho };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new ApilaGame(services, config),
};
