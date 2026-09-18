/**
 * CORTA - el dedo como cuchilla.
 *
 * Suben piezas por el aire y se cortan arrastrando el dedo por encima. Un
 * trazo largo parte varias de golpe, que es donde estan los puntos gordos.
 * Las bombas tambien se cortan, y ahi esta la gracia: hay que frenar.
 *
 * Habilidad que mide: trazo, anticipacion y saber cuando NO cortar.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label } from '../../game/draw';

const ACCENT = '#4ade80';
const BOMBA = '#ef4444';
const COLORES = ['#4ade80', '#facc15', '#fb7185', '#38bdf8', '#a855f7'];

interface Pieza {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radio: number;
  giro: number;
  vGiro: number;
  color: string;
  bomba: boolean;
  cortada: boolean;
  /** Animacion de las dos mitades al separarse. */
  fade: number;
}

interface Punto {
  x: number;
  y: number;
  vida: number;
}

export const META: GameMeta = {
  id: 'corta',
  name: 'CORTA',
  tagline: 'Arrastra el dedo. Las bombas no.',
  skill: 'precision',
  defaultDurationMs: 30_000,
  instructions: [
    'Arrastra el dedo por encima de las piezas para cortarlas.',
    'Un solo trazo puede partir varias: ahi estan los puntos.',
    'Cortar una BOMBA cuesta una vida.',
  ],
  icon: '🔪',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'heavy', 'sprint', 'rush', 'swarm', 'tiny', 'chaos'],
};

class CortaGame extends BaseMiniGame {
  readonly meta = META;

  private piezas: Pieza[] = [];
  private estela: Punto[] = [];
  private prevX = 0;
  private prevY = 0;
  private teniaDedo = false;
  private spawn = 0;
  private cortadas = 0;
  private bombas = 0;
  private mejorTrazo = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.piezas = [];
    this.estela = [];
    this.prevX = 0;
    this.prevY = 0;
    this.teniaDedo = false;
    this.spawn = 0.4;
    this.cortadas = 0;
    this.bombas = 0;
    this.mejorTrazo = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
  }

  private get gravedad(): number {
    return this.areaHeight * 1.5 * Math.max(0.5, this.mut.gravity);
  }

  private lanzar(): void {
    const radio = Math.min(this.width, this.areaHeight) * 0.07 * this.mut.sizeMultiplier;
    const x = this.rng.range(this.width * 0.15, this.width * 0.85);
    // Altura de subida: entre media zona y casi toda, para que de tiempo.
    const alto = this.areaHeight * this.rng.range(0.55, 0.85);
    const vy = -Math.sqrt(2 * this.gravedad * alto);
    const bomba = this.rng.chance(0.12 + this.config.difficulty * 0.1);
    this.piezas.push({
      x,
      y: this.areaBottom + radio,
      vx: ((this.width / 2 - x) / this.width) * this.width * this.rng.range(0.1, 0.35),
      vy,
      radio,
      giro: this.rng.range(0, Math.PI * 2),
      vGiro: this.rng.range(-3, 3),
      color: bomba ? BOMBA : (this.rng.pick(COLORES) as string),
      bomba,
      cortada: false,
      fade: 0,
    });
  }

  protected tick(dt: number): void {
    this.time += dt;

    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = Math.max(
        0.35,
        (1.15 - this.config.difficulty * 0.3 - this.progress * 0.4) / Math.max(0.5, this.mut.spawnRate),
      );
      const tanda = 1 + (this.rng.chance(0.3 + this.progress * 0.3) ? 1 : 0) + this.mut.extraHazards;
      for (let i = 0; i < tanda; i++) this.lanzar();
    }

    const g = this.gravedad;
    for (let i = this.piezas.length - 1; i >= 0; i--) {
      const pieza = this.piezas[i] as Pieza;
      pieza.vy += g * dt;
      pieza.x += pieza.vx * dt;
      pieza.y += pieza.vy * dt;
      pieza.giro += pieza.vGiro * dt;
      if (pieza.cortada) pieza.fade += dt * 2.2;
      if (pieza.fade > 1 || pieza.y - pieza.radio > this.areaBottom + this.areaHeight * 0.2) {
        this.piezas.splice(i, 1);
        // Dejar escapar fruta no mata: solo te quedas sin sus puntos.
        if (!pieza.cortada && !pieza.bomba) this.breakCombo();
      }
    }

    this.seguirDedo(dt);
  }

  private seguirDedo(dt: number): void {
    for (const punto of this.estela) punto.vida -= dt * 3.5;
    this.estela = this.estela.filter((p) => p.vida > 0);

    const input = this.services.input;
    const x = this.pointerX();
    const y = this.pointerY();

    if (!input.down) {
      this.teniaDedo = false;
      return;
    }

    this.estela.push({ x, y, vida: 1 });
    if (this.estela.length > 14) this.estela.shift();

    if (this.teniaDedo) {
      const cortadasAhora = this.cortarSegmento(this.prevX, this.prevY, x, y);
      if (cortadasAhora > this.mejorTrazo) this.mejorTrazo = cortadasAhora;
    }
    this.prevX = x;
    this.prevY = y;
    this.teniaDedo = true;
  }

  /** Corta todo lo que cruce el segmento recorrido por el dedo este frame. */
  private cortarSegmento(x1: number, y1: number, x2: number, y2: number): number {
    if (Math.hypot(x2 - x1, y2 - y1) < 4) return 0; // dedo parado: no es un tajo
    let n = 0;
    for (const pieza of this.piezas) {
      if (pieza.cortada) continue;
      if (!this.segmentoTocaCirculo(x1, y1, x2, y2, pieza.x, pieza.y, pieza.radio)) continue;
      pieza.cortada = true;
      if (pieza.bomba) {
        this.bombas++;
        this.registerMistake(60);
        this.announce('BOMBA', 'bad');
        this.services.audio.play('error');
        this.services.haptics.fire('heavy');
        this.services.fx.flash(BOMBA, 0.35);
        this.services.fx.shake(10);
        this.services.fx.burst(pieza.x, pieza.y, { count: 30, color: BOMBA, speed: 380, size: 6 });
        continue;
      }
      n++;
      this.cortadas++;
      this.registerHit();
      const combo = this.bumpCombo();
      this.addScore(Math.round(40 * (1 + Math.min(12, combo) * 0.07)), pieza.x, pieza.y);
      this.services.fx.burst(pieza.x, pieza.y, { count: 14, color: pieza.color, speed: 260, size: 4 });
    }
    if (n > 0) {
      this.services.audio.play(n > 1 ? 'combo' : 'hit');
      this.services.haptics.fire('light');
    }
    // Un trazo que parte varias de golpe merece premio aparte: es la jugada.
    if (n >= 2) {
      this.addScore(60 * n, x2, y2);
      this.services.fx.float(x2, y2, `x${n} DE UN TAJO`, { color: ACCENT, size: 22 });
    }
    return n;
  }

  private segmentoTocaCirculo(
    x1: number, y1: number, x2: number, y2: number,
    cx: number, cy: number, r: number,
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x1 + t * dx - cx, y1 + t * dy - cy) <= r;
  }

  protected draw(): void {
    const ctx = this.ctx;

    for (const pieza of this.piezas) {
      ctx.save();
      ctx.translate(pieza.x, pieza.y);
      ctx.rotate(pieza.giro);
      ctx.globalAlpha = pieza.cortada ? Math.max(0, 1 - pieza.fade) : 1;

      if (pieza.cortada) {
        // Dos mitades que se separan: se lee al instante que la has partido.
        const sep = pieza.fade * pieza.radio * 1.2;
        for (const lado of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(lado * sep, 0, pieza.radio, lado < 0 ? Math.PI / 2 : -Math.PI / 2, lado < 0 ? -Math.PI / 2 : Math.PI / 2);
          ctx.closePath();
          ctx.fillStyle = pieza.color;
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pieza.radio, 0, Math.PI * 2);
        ctx.fillStyle = pieza.color;
        ctx.fill();
        ctx.strokeStyle = hexToRgba('#ffffff', 0.3);
        ctx.lineWidth = 2;
        ctx.stroke();
        if (pieza.bomba) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${pieza.radio}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✕', 0, 0);
        }
      }
      ctx.restore();
    }

    // La estela del dedo.
    if (this.estela.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < this.estela.length; i++) {
        const a = this.estela[i - 1] as Punto;
        const b = this.estela[i] as Punto;
        ctx.globalAlpha = b.vida * 0.85;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 + (i / this.estela.length) * 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.mejorTrazo >= 2) {
      label(ctx, `MEJOR TAJO: ${this.mejorTrazo}`, this.width / 2, this.areaTop + 18, {
        size: 14,
        color: hexToRgba(ACCENT, 0.8),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { cortadas: this.cortadas, bombas: this.bombas, mejorTrazo: this.mejorTrazo };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'corta', piezas: this.piezas.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new CortaGame(services, config),
};
