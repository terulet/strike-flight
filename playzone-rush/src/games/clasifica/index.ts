/**
 * CLASIFICA - decidir rapido y no equivocarse de lado.
 *
 * Caen piezas y cada una va a un lado. Tocas la mitad izquierda o la derecha
 * de la pantalla para mandarla. La decision es trivial; lo dificil es tomarla
 * veinte veces seguidas sin que se te crucen los cables.
 *
 * Habilidad que mide: decision rapida y aguante del acierto en cadena.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, hexToRgba, label, roundRect } from '../../game/draw';

const IZQ = '#38bdf8';
const DER = '#fb7185';
const ACCENT = '#38bdf8';

interface Pieza {
  x: number;
  y: number;
  lado: -1 | 1;
  tam: number;
  giro: number;
  /** >0 mientras sale volando hacia su lado. */
  lanzada: number;
  vx: number;
}

export const META: GameMeta = {
  id: 'clasifica',
  name: 'CLASIFICA',
  tagline: 'Cada pieza a su lado. Rapido.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Las piezas AZULES van a la izquierda; las ROJAS, a la derecha.',
    'Toca la mitad de la pantalla del lado que toque.',
    'Equivocarte o dejarla caer cuesta una vida.',
  ],
  icon: '⇄',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'swarm', 'tiny', 'chaos'],
};

class ClasificaGame extends BaseMiniGame {
  readonly meta = META;

  private piezas: Pieza[] = [];
  private spawn = 0;
  private bien = 0;
  private mal = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.piezas = [];
    this.spawn = 0.3;
    this.bien = 0;
    this.mal = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
  }

  private get caida(): number {
    const base = this.areaHeight * (0.3 + this.config.difficulty * 0.22 + this.progress * 0.3);
    return base * Math.max(0.5, this.mut.speed);
  }

  private get tamPieza(): number {
    return Math.min(this.width * 0.15, this.areaHeight * 0.1) * this.mut.sizeMultiplier;
  }

  protected tick(dt: number): void {
    this.time += dt;

    this.spawn -= dt;
    if (this.spawn <= 0) {
      const intervalo = Math.max(
        0.45,
        (1.5 - this.config.difficulty * 0.35 - this.progress * 0.45) / Math.max(0.5, this.mut.spawnRate),
      );
      this.spawn = intervalo;
      this.crear();
      for (let i = 0; i < this.mut.extraHazards; i++) if (this.rng.chance(0.4)) this.crear();
    }

    const caida = this.caida;
    for (let i = this.piezas.length - 1; i >= 0; i--) {
      const pieza = this.piezas[i] as Pieza;
      pieza.giro += dt * (pieza.lanzada > 0 ? 9 : 1.4);

      if (pieza.lanzada > 0) {
        pieza.lanzada -= dt;
        pieza.x += pieza.vx * dt;
        pieza.y += caida * 0.35 * dt;
        if (pieza.lanzada <= 0) this.piezas.splice(i, 1);
        continue;
      }

      pieza.y += caida * dt;
      if (pieza.y - pieza.tam / 2 > this.areaBottom) {
        this.piezas.splice(i, 1);
        this.mal++;
        // Dejarla caer rompe la racha y cuenta como fallo de punteria, pero no
        // cuesta vida: igual que los nodos que se apagan en PULSE. Las vidas se
        // pagan por equivocarse, no por despistarse un segundo.
        this.misses++;
        this.breakCombo();
        this.announce('SE TE HA CAIDO', 'bad');
        this.services.audio.play('miss');
        this.services.fx.flash('#ef4444', 0.16);
      }
    }

    this.resolverToques();
  }

  private crear(): void {
    const tam = this.tamPieza;
    this.piezas.push({
      x: this.width / 2 + this.rng.range(-this.width * 0.12, this.width * 0.12),
      y: this.areaTop - tam,
      lado: this.rng.chance(0.5) ? -1 : 1,
      tam,
      giro: this.rng.range(0, Math.PI),
      lanzada: 0,
      vx: 0,
    });
  }

  /** La pieza viva mas baja: es la que se esta clasificando. */
  private activa(): Pieza | null {
    let mejor: Pieza | null = null;
    for (const pieza of this.piezas) {
      if (pieza.lanzada > 0) continue;
      if (!mejor || pieza.y > mejor.y) mejor = pieza;
    }
    return mejor;
  }

  private resolverToques(): void {
    const decisiones: (-1 | 1)[] = [];
    for (const punto of this.tapPoints()) decisiones.push(punto.x < this.width / 2 ? -1 : 1);
    for (const code of this.services.input.keyTaps) {
      if (code === 'ArrowLeft' || code === 'KeyA') decisiones.push(-1);
      if (code === 'ArrowRight' || code === 'KeyD') decisiones.push(1);
    }

    for (const lado of decisiones) {
      const pieza = this.activa();
      if (!pieza) continue;
      if (pieza.lado === lado) {
        this.bien++;
        this.registerHit();
        const combo = this.bumpCombo();
        // Cuanto mas arriba la resuelves, mas margen te queda: mas puntos.
        const margen = 1 - Math.min(1, (pieza.y - this.areaTop) / this.areaHeight);
        const multiplicador = 1 + Math.min(12, combo) * 0.06;
        this.addScore(Math.round((35 + margen * 55) * multiplicador), pieza.x, pieza.y);
        pieza.lanzada = 0.45;
        pieza.vx = lado * this.width * 1.6;
        this.services.audio.play('hit');
        this.services.haptics.fire('tick');
        this.services.fx.burst(pieza.x, pieza.y, {
          count: 10,
          color: lado < 0 ? IZQ : DER,
          speed: 220,
          size: 4,
        });
      } else {
        this.mal++;
        this.registerMistake(30);
        this.announce('LADO EQUIVOCADO', 'bad');
        this.services.audio.play('error');
        this.services.haptics.fire('error');
        this.services.fx.shake(5);
        pieza.lanzada = 0.3;
        pieza.vx = lado * this.width * 0.8;
      }
    }
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, this.time * 6, this.width / 3);

    // Los dos destinos, siempre a la vista: la regla se lee sin instrucciones.
    const altoZona = Math.max(54, this.areaHeight * 0.1);
    const yZona = this.areaBottom - altoZona;
    for (const [lado, color] of [[-1, IZQ], [1, DER]] as const) {
      const x = lado < 0 ? 0 : this.width / 2;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = color;
      roundRect(ctx, x + 6, yZona, this.width / 2 - 12, altoZona, 14);
      ctx.fill();
      ctx.restore();
      label(ctx, lado < 0 ? '◀ AZUL' : 'ROJO ▶', x + this.width / 4, yZona + altoZona / 2, {
        size: 15,
        color: hexToRgba(color, 0.8),
      });
    }

    const activa = this.activa();
    for (const pieza of this.piezas) {
      const color = pieza.lado < 0 ? IZQ : DER;
      ctx.save();
      ctx.translate(pieza.x, pieza.y);
      ctx.rotate(pieza.giro);
      ctx.globalAlpha = pieza.lanzada > 0 ? Math.max(0, pieza.lanzada / 0.45) : 1;
      ctx.fillStyle = color;
      roundRect(ctx, -pieza.tam / 2, -pieza.tam / 2, pieza.tam, pieza.tam, pieza.tam * 0.28);
      ctx.fill();
      if (pieza === activa) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        roundRect(ctx, -pieza.tam / 2, -pieza.tam / 2, pieza.tam, pieza.tam, pieza.tam * 0.28);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  protected override metrics(): Record<string, number> {
    return { bien: this.bien, mal: this.mal };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'clasifica', piezas: this.piezas.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new ClasificaGame(services, config),
};
