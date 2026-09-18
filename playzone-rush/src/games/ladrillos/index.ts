/**
 * LADRILLOS - la pala y la bola de siempre.
 *
 * Con un cambio: la bola sale por donde le da la gana y la pala se encoge
 * cada vez que limpias un muro. Los puntos estan en encadenar sin que se te
 * escape, no en durar.
 *
 * Habilidad que mide: seguimiento continuo y anticipar el rebote.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#f472b6';
const COLORES = ['#f472b6', '#a855f7', '#38bdf8', '#4ade80', '#facc15'];

interface Ladrillo {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vivo: boolean;
}

const COLS = 7;
const FILAS = 4;

export const META: GameMeta = {
  id: 'ladrillos',
  name: 'LADRILLOS',
  tagline: 'Mueve la pala. Que no se te escape.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Arrastra el dedo para mover la pala.',
    'Rompe todos los ladrillos y sale un muro nuevo.',
    'Si la bola se te escapa, pierdes una vida.',
  ],
  icon: '🧱',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'tiny', 'chaos'],
};

class LadrillosGame extends BaseMiniGame {
  readonly meta = META;

  private ladrillos: Ladrillo[] = [];
  private palaX = 0;
  private bx = 0;
  private by = 0;
  private vx = 0;
  private vy = 0;
  private rotos = 0;
  private muros = 0;
  private perdidas = 0;
  private anchoPala = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.anchoPala = this.width * 0.26 * this.mut.sizeMultiplier;
    this.palaX = this.width / 2;
    this.rotos = 0;
    this.muros = 0;
    this.perdidas = 0;
    this.time = 0;
    this.tracksAccuracy = false;
    this.setLives(3);
    this.nuevoMuro();
    this.sacar();
  }

  private get palaY(): number {
    return this.areaBottom - Math.max(24, this.areaHeight * 0.05);
  }

  private get radio(): number {
    return Math.max(5, Math.min(this.width, this.areaHeight) * 0.018);
  }

  private get velBola(): number {
    return this.areaHeight * (0.85 + this.config.difficulty * 0.3 + this.progress * 0.4) * Math.max(0.5, this.mut.speed);
  }

  private nuevoMuro(): void {
    this.muros++;
    // Cada muro limpiado estrecha la pala: la partida sube sola de nivel.
    if (this.muros > 1) this.anchoPala = Math.max(this.width * 0.13, this.anchoPala * 0.86);
    const margen = this.width * 0.04;
    const w = (this.width - margen * 2) / COLS;
    const h = Math.max(14, this.areaHeight * 0.045);
    this.ladrillos = [];
    for (let fila = 0; fila < FILAS; fila++) {
      for (let col = 0; col < COLS; col++) {
        this.ladrillos.push({
          x: margen + col * w,
          y: this.areaTop + this.areaHeight * 0.08 + fila * h,
          w,
          h,
          color: COLORES[fila % COLORES.length] as string,
          vivo: true,
        });
      }
    }
  }

  private sacar(): void {
    this.bx = this.palaX;
    this.by = this.palaY - this.radio * 3;
    const ang = this.rng.range(-Math.PI * 0.72, -Math.PI * 0.28);
    this.vx = Math.cos(ang) * this.velBola;
    this.vy = Math.sin(ang) * this.velBola;
  }

  protected tick(dt: number): void {
    this.time += dt;

    const input = this.services.input;
    if (input.down) {
      const objetivo = this.pointerX();
      this.palaX += (objetivo - this.palaX) * Math.min(1, dt * 18);
    } else {
      this.palaX += this.axisX() * this.width * 0.9 * dt;
    }
    this.palaX = Math.max(this.anchoPala / 2, Math.min(this.width - this.anchoPala / 2, this.palaX));

    // Paso partido: a esta velocidad, un solo paso se colaria entre ladrillos.
    const pasos = 3;
    for (let i = 0; i < pasos; i++) this.mover(dt / pasos);
  }

  private mover(dt: number): void {
    const r = this.radio;
    this.bx += this.vx * dt;
    this.by += this.vy * dt;

    if (this.bx < r) {
      this.bx = r;
      this.vx = Math.abs(this.vx);
    } else if (this.bx > this.width - r) {
      this.bx = this.width - r;
      this.vx = -Math.abs(this.vx);
    }
    if (this.by < this.areaTop + r) {
      this.by = this.areaTop + r;
      this.vy = Math.abs(this.vy);
    }

    // Pala: el punto de impacto decide el angulo, como debe ser.
    if (this.vy > 0 && this.by + r >= this.palaY && this.by - r <= this.palaY + 14) {
      const desvio = (this.bx - this.palaX) / (this.anchoPala / 2);
      if (Math.abs(desvio) <= 1.15) {
        const ang = -Math.PI / 2 + desvio * 1.05;
        const vel = this.velBola;
        this.vx = Math.cos(ang) * vel;
        this.vy = Math.sin(ang) * vel;
        this.by = this.palaY - r;
        this.services.audio.play('tap');
        this.services.haptics.fire('tick');
      }
    }

    if (this.by - r > this.areaBottom) {
      this.perdidas++;
      this.registerMistake(0);
      this.breakCombo();
      this.announce('SE TE HA ESCAPADO', 'bad');
      this.services.audio.play('defeat');
      this.services.fx.flash('#ef4444', 0.25);
      if (this.state === 'playing') this.sacar();
      return;
    }

    for (const lad of this.ladrillos) {
      if (!lad.vivo) continue;
      if (this.bx + r < lad.x || this.bx - r > lad.x + lad.w) continue;
      if (this.by + r < lad.y || this.by - r > lad.y + lad.h) continue;

      lad.vivo = false;
      this.rotos++;
      const combo = this.bumpCombo();
      this.addScore(Math.round(35 * (1 + Math.min(15, combo) * 0.07)), lad.x + lad.w / 2, lad.y);
      this.services.audio.play('hit');
      this.services.fx.burst(lad.x + lad.w / 2, lad.y + lad.h / 2, {
        count: 10,
        color: lad.color,
        speed: 200,
        size: 4,
      });

      // Rebote por el lado de menor penetracion: evita atravesar en diagonal.
      const solapeX = Math.min(this.bx + r - lad.x, lad.x + lad.w - (this.bx - r));
      const solapeY = Math.min(this.by + r - lad.y, lad.y + lad.h - (this.by - r));
      if (solapeX < solapeY) this.vx *= -1;
      else this.vy *= -1;

      if (!this.ladrillos.some((l) => l.vivo)) {
        this.addScore(300, this.width / 2, this.areaTop + 40);
        this.announce('MURO LIMPIO', 'good');
        this.services.audio.play('record');
        this.nuevoMuro();
      }
      return;
    }
  }

  protected draw(): void {
    const ctx = this.ctx;

    for (const lad of this.ladrillos) {
      if (!lad.vivo) continue;
      ctx.fillStyle = lad.color;
      roundRect(ctx, lad.x + 1.5, lad.y + 1.5, lad.w - 3, lad.h - 3, 4);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, this.palaX - this.anchoPala / 2, this.palaY, this.anchoPala, 11, 6);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.bx, this.by, this.radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    label(ctx, `MURO ${this.muros}`, this.width / 2, this.areaTop + 10, {
      size: 12,
      color: hexToRgba('#ffffff', 0.35),
    });
  }

  protected override metrics(): Record<string, number> {
    return { rotos: this.rotos, muros: this.muros, perdidas: this.perdidas };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'ladrillos', vivos: this.ladrillos.filter((l) => l.vivo).length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new LadrillosGame(services, config),
};
