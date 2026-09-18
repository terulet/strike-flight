/**
 * CRUZA - el trafico no para.
 *
 * Un toque, un carril. Todo el juego es elegir el momento: los coches van a
 * velocidades distintas y en direcciones distintas, asi que cruzar del tiron
 * funciona hasta que deja de funcionar.
 *
 * Habilidad que mide: lectura del hueco y paciencia (la parte dificil).
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#34d399';

interface Carril {
  dir: 1 | -1;
  vel: number;
  coches: number[];
  largo: number;
  hueco: number;
  color: string;
}

export const META: GameMeta = {
  id: 'cruza',
  name: 'CRUZA',
  tagline: 'Un toque, un carril. Que no te pillen.',
  skill: 'supervivencia',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca para avanzar un carril hacia arriba.',
    'Llegar arriba del todo suma y vuelves a empezar.',
    'Si te pilla un coche, vuelves abajo y pierdes vida.',
  ],
  icon: '🚗',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'sprint', 'rush', 'swarm', 'chaos'],
};

class CruzaGame extends BaseMiniGame {
  readonly meta = META;

  private carriles: Carril[] = [];
  private fila = 0;
  private cruces = 0;
  private atropellos = 0;
  private invulnerable = 0;
  private salto = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.fila = 0;
    this.cruces = 0;
    this.atropellos = 0;
    this.invulnerable = 0;
    this.salto = 0;
    this.time = 0;
    this.tracksAccuracy = false;
    this.setLives(3);
    this.generarCarriles();
  }

  protected override onResize(): void {
    this.generarCarriles();
  }

  private get numCarriles(): number {
    return 6;
  }

  private get altoFila(): number {
    // Una fila mas: la de abajo es la acera de salida.
    return this.areaHeight / (this.numCarriles + 1);
  }

  private generarCarriles(): void {
    const dificultad = this.config.difficulty;
    this.carriles = [];
    for (let i = 0; i < this.numCarriles; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      const vel = this.width * this.rng.range(0.16 + dificultad * 0.1, 0.34 + dificultad * 0.16);
      const largo = this.width * this.rng.range(0.16, 0.26);
      const hueco = largo * this.rng.range(1.9, 3.4) * (this.mut.extraHazards > 0 ? 0.7 : 1);
      const coches: number[] = [];
      for (let x = this.rng.range(0, hueco); x < this.width + largo; x += hueco + largo) coches.push(x);
      this.carriles.push({
        dir,
        vel,
        coches,
        largo,
        hueco,
        color: this.rng.pick(['#f472b6', '#38bdf8', '#fbbf24', '#a855f7']) as string,
      });
    }
  }

  /** Y del centro de una fila (0 = acera de abajo). */
  private filaY(fila: number): number {
    return this.areaBottom - this.altoFila * (fila + 0.5);
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.salto = Math.max(0, this.salto - dt * 6);

    const factor = Math.max(0.5, this.mut.speed) * (1 + this.progress * 0.35);
    for (const carril of this.carriles) {
      const paso = carril.vel * factor * dt * carril.dir;
      const ciclo = carril.largo + carril.hueco;
      for (let i = 0; i < carril.coches.length; i++) {
        let x = (carril.coches[i] as number) + paso;
        // Vuelta al principio por el lado contrario.
        if (carril.dir > 0 && x > this.width + carril.largo) x -= ciclo * carril.coches.length;
        if (carril.dir < 0 && x < -carril.largo * 2) x += ciclo * carril.coches.length;
        carril.coches[i] = x;
      }
    }

    if (this.tapPoints().length > 0 || this.services.input.keyTaps.length > 0) this.avanzar();
    this.comprobarAtropello();
  }

  private avanzar(): void {
    this.fila++;
    this.salto = 1;
    this.services.audio.play('tap');
    this.services.haptics.fire('tick');

    if (this.fila > this.numCarriles) {
      // Ha llegado a la acera de arriba.
      this.cruces++;
      const combo = this.bumpCombo();
      this.addScore(Math.round(250 * (1 + Math.min(8, combo) * 0.12)), this.width / 2, this.filaY(this.fila));
      this.announce(combo >= 2 ? `${combo} CRUCES SEGUIDOS` : 'AL OTRO LADO', 'good');
      this.services.audio.play('record');
      this.services.fx.burst(this.width / 2, this.areaTop + 20, { count: 20, color: ACCENT, speed: 280, size: 5 });
      this.fila = 0;
      this.generarCarriles();
      return;
    }
    this.addScore(20, this.width / 2, this.filaY(this.fila));
  }

  private comprobarAtropello(): void {
    if (this.invulnerable > 0 || this.fila === 0 || this.fila > this.numCarriles) return;
    const carril = this.carriles[this.fila - 1] as Carril;
    const x = this.width / 2;
    const medio = this.anchoJugador / 2;
    const pillado = carril.coches.some((cx) => x + medio > cx && x - medio < cx + carril.largo);
    if (!pillado) return;

    this.atropellos++;
    this.registerMistake(0);
    this.breakCombo();
    this.announce('ATROPELLADO', 'bad');
    this.services.audio.play('defeat');
    this.services.haptics.fire('heavy');
    this.services.fx.flash('#ef4444', 0.3);
    this.services.fx.shake(10);
    this.fila = 0;
    this.invulnerable = 0.9;
  }

  private get anchoJugador(): number {
    return Math.min(this.width * 0.1, this.altoFila * 0.62) * this.mut.sizeMultiplier;
  }

  protected draw(): void {
    const ctx = this.ctx;
    const alto = this.altoFila;

    for (let i = 0; i < this.numCarriles; i++) {
      const carril = this.carriles[i] as Carril;
      const y = this.filaY(i + 1) - alto / 2;
      ctx.save();
      ctx.fillStyle = hexToRgba('#ffffff', i % 2 === 0 ? 0.03 : 0.06);
      ctx.fillRect(0, y, this.width, alto);
      ctx.restore();

      for (const cx of carril.coches) {
        if (cx > this.width || cx + carril.largo < 0) continue;
        ctx.fillStyle = carril.color;
        roundRect(ctx, cx, y + alto * 0.18, carril.largo, alto * 0.64, 8);
        ctx.fill();
        // Parabrisas: da direccion de un vistazo.
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#0b0b12';
        const wx = carril.dir > 0 ? cx + carril.largo * 0.62 : cx + carril.largo * 0.14;
        roundRect(ctx, wx, y + alto * 0.26, carril.largo * 0.24, alto * 0.48, 4);
        ctx.fill();
        ctx.restore();
      }
    }

    // Aceras de salida y de llegada.
    ctx.save();
    ctx.fillStyle = hexToRgba(ACCENT, 0.12);
    ctx.fillRect(0, this.areaBottom - alto, this.width, alto);
    ctx.fillRect(0, this.areaTop, this.width, alto * 0.5);
    ctx.restore();

    const x = this.width / 2;
    const y = this.filaY(this.fila) - this.salto * alto * 0.18;
    const r = this.anchoJugador / 2;
    ctx.save();
    if (this.invulnerable > 0) ctx.globalAlpha = 0.4 + Math.sin(this.time * 30) * 0.3;
    ctx.fillStyle = ACCENT;
    roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.45);
    ctx.fill();
    ctx.fillStyle = '#0b0b12';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.2, r * 0.16, 0, Math.PI * 2);
    ctx.arc(x + r * 0.35, y - r * 0.2, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    label(ctx, `${this.cruces} CRUCES`, this.width / 2, this.areaTop + alto * 0.25, {
      size: 13,
      color: hexToRgba('#ffffff', 0.5),
    });
  }

  protected override metrics(): Record<string, number> {
    return { cruces: this.cruces, atropellos: this.atropellos };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'cruza', fila: this.fila, cruces: this.cruces };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new CruzaGame(services, config),
};
