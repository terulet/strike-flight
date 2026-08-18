/**
 * PULSE - reflejos.
 *
 * Regla unica: toca los nodos azules antes de que se apaguen. Los rojos queman.
 * Cuanto antes tocas, mas puntos. El ritmo sube durante toda la partida.
 *
 * Habilidad que mide: velocidad de reaccion y capacidad de inhibirse
 * (no tocar lo que no toca).
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropGrid, glowCircle, hexToRgba, label, ringArc } from '../../game/draw';

const ACCENT = '#22d3ee';
const MINE = '#ff2d55';

interface Node {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  mine: boolean;
  cell: number;
  pop: number;
}

const KEY_CELLS: Record<string, number> = {
  KeyQ: 0, KeyW: 1, KeyE: 2,
  KeyA: 3, KeyS: 4, KeyD: 5,
  KeyZ: 6, KeyX: 7, KeyC: 8,
  Digit7: 0, Digit8: 1, Digit9: 2,
  Digit4: 3, Digit5: 4, Digit6: 5,
  Digit1: 6, Digit2: 7, Digit3: 8,
};

export const META: GameMeta = {
  id: 'pulse',
  name: 'PULSE',
  tagline: 'Toca los nodos vivos. Esquiva los rojos.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca los nodos AZULES antes de que se apaguen.',
    'NO toques los ROJOS: te quitan una vida.',
    'Cuanto antes tocas, mas puntos. Encadena para multiplicar.',
  ],
  icon: '◎',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
};

class PulseGame extends BaseMiniGame {
  readonly meta = META;

  private nodes: Node[] = [];
  private cells: { x: number; y: number }[] = [];
  private spawnTimer = 0;
  private perfect = 0;
  private expired = 0;
  private lastCell = -1;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
    this.layoutCells();
  }

  protected setup(): void {
    this.nodes = [];
    this.spawnTimer = 0.4;
    this.perfect = 0;
    this.expired = 0;
    this.lastCell = -1;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
    this.layoutCells();
  }

  protected override onResize(): void {
    this.layoutCells();
  }

  private layoutCells(): void {
    const padX = this.width * 0.14;
    const padY = this.height * 0.16;
    const w = this.width - padX * 2;
    const h = this.height - padY * 2;
    this.cells = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.cells.push({ x: padX + (w * (col + 0.5)) / 3, y: padY + (h * (row + 0.5)) / 3 });
      }
    }
  }

  /** 0..1: cuanto ha subido el ritmo. */
  private get ramp(): number {
    return Math.min(1, this.progress * 0.9 + this.config.difficulty * 0.35);
  }

  private get baseRadius(): number {
    return Math.min(this.width, this.height) * 0.085 * this.mut.sizeMultiplier;
  }

  protected tick(dt: number): void {
    this.time += dt;
    const ramp = this.ramp;

    // Aparicion
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const interval = Math.max(
        0.15,
        (0.68 - ramp * 0.36) / Math.max(0.5, this.mut.spawnRate * (0.7 + 0.3 * this.mut.speed)),
      );
      this.spawnTimer = interval;
      this.spawn(ramp);
      // Con ENJAMBRE salen mas nodos a la vez.
      for (let i = 0; i < this.mut.extraHazards; i++) if (this.rng.chance(0.5)) this.spawn(ramp);
    }

    // Caducidad
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i] as Node;
      node.life -= dt;
      node.pop = Math.max(0, node.pop - dt * 4);
      if (node.life > 0) continue;
      this.nodes.splice(i, 1);
      if (node.mine) continue;
      // Se te ha apagado: rompe combo y cuenta como fallo de punteria,
      // pero no cuesta vida (las vidas son solo para las minas).
      this.expired++;
      this.misses++;
      this.breakCombo();
      this.services.fx.ring(node.x, node.y, node.radius * 1.6, hexToRgba('#64748b', 0.9), 2);
      this.services.audio.play('miss');
    }

    this.handleTaps();
  }

  private spawn(ramp: number): void {
    if (this.nodes.length > 7) return;
    let cell = this.rng.int(0, 8);
    if (cell === this.lastCell) cell = (cell + this.rng.int(1, 8)) % 9;
    // No amontonar dos nodos en la misma celda.
    if (this.nodes.some((n) => n.cell === cell)) {
      const free = this.cells.map((_, i) => i).filter((i) => !this.nodes.some((n) => n.cell === i));
      if (free.length === 0) return;
      cell = this.rng.pick(free);
    }
    this.lastCell = cell;
    const spot = this.cells[cell] as { x: number; y: number };
    const jitter = this.baseRadius * 0.35;
    const mineChance = 0.13 + ramp * 0.17;
    const life = Math.max(0.42, (1.3 - ramp * 0.62) / Math.max(0.6, this.mut.speed));
    this.nodes.push({
      x: spot.x + this.rng.range(-jitter, jitter),
      y: spot.y + this.rng.range(-jitter, jitter),
      radius: this.baseRadius * this.rng.range(0.92, 1.08),
      life,
      maxLife: life,
      mine: this.rng.chance(mineChance),
      cell,
      pop: 1,
    });
  }

  private handleTaps(): void {
    const points: { x: number; y: number }[] = [];
    for (const tap of this.services.input.taps) {
      points.push(
        this.mut.invertControls ? { x: this.width - tap.x, y: this.height - tap.y } : { x: tap.x, y: tap.y },
      );
    }
    for (const code of this.services.input.keyTaps) {
      const cell = KEY_CELLS[code];
      if (cell === undefined) continue;
      const node = this.nodes.find((n) => n.cell === cell);
      if (node) points.push({ x: node.x, y: node.y });
      else {
        const spot = this.cells[cell];
        if (spot) points.push({ x: spot.x, y: spot.y });
      }
    }

    for (const point of points) {
      const index = this.nodes.findIndex(
        (n) => Math.hypot(n.x - point.x, n.y - point.y) <= n.radius * 1.35,
      );
      if (index < 0) {
        // Aire: no penaliza puntos, pero corta la racha.
        this.breakCombo();
        this.services.fx.ring(point.x, point.y, 26, 'rgba(255,255,255,0.35)', 2);
        continue;
      }
      const node = this.nodes.splice(index, 1)[0] as Node;
      if (node.mine) {
        this.registerMistake(70);
        this.services.fx.burst(node.x, node.y, { count: 22, color: MINE, speed: 300, size: 5 });
        this.services.fx.float(node.x, node.y, '-70', { color: MINE, size: 26 });
        continue;
      }
      const freshness = node.life / node.maxLife; // 1 = instantaneo
      const combo = this.bumpCombo();
      const multiplier = 1 + Math.min(12, combo) * 0.08;
      const base = 45 + freshness * 130;
      this.registerHit();
      if (freshness > 0.78) {
        this.perfect++;
        this.services.fx.ring(node.x, node.y, node.radius * 2.6, ACCENT, 3);
      }
      this.addScore(Math.round(base * multiplier), node.x, node.y);
      this.services.fx.burst(node.x, node.y, { count: 12, color: ACCENT, speed: 240, size: 4 });
      this.services.haptics.fire('light');
    }
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, this.time * 12, this.width / 3);

    // Celdas guia (muy tenues): dan estructura y explican el mapeo de teclado.
    ctx.save();
    ctx.globalAlpha = 0.1;
    for (const cell of this.cells) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, this.baseRadius * 1.25, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    for (const node of this.nodes) {
      const t = node.life / node.maxLife;
      const color = node.mine ? MINE : ACCENT;
      const pop = 1 + node.pop * 0.35;
      const radius = node.radius * pop;

      ctx.save();
      ctx.globalAlpha = 0.18;
      glowCircle(ctx, node.x, node.y, radius * 1.5, color, 24);
      ctx.restore();

      glowCircle(ctx, node.x, node.y, radius * (node.mine ? 0.72 : 0.78), color, node.mine ? 20 : 14);

      ringArc(ctx, node.x, node.y, radius * 1.12, t, node.mine ? hexToRgba(MINE, 0.9) : '#ffffff', 3.5);

      if (node.mine) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        const s = radius * 0.34;
        ctx.beginPath();
        ctx.moveTo(node.x - s, node.y - s);
        ctx.lineTo(node.x + s, node.y + s);
        ctx.moveTo(node.x + s, node.y - s);
        ctx.lineTo(node.x - s, node.y + s);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.combo >= 3) {
      label(ctx, `x${(1 + Math.min(12, this.combo) * 0.08).toFixed(2)}`, this.width / 2, this.height - 34, {
        size: 20,
        color: hexToRgba('#ffd23f', 0.9),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { perfect: this.perfect, expired: this.expired, hits: this.hits };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new PulseGame(services, config),
};
