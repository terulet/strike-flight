/**
 * MEMORY - memoria visual.
 *
 * Regla unica: se encienden unas casillas, se apagan, y tienes que tocarlas.
 * El orden da igual (eso lo hace rapido); lo que sube es la cantidad y la
 * velocidad. Nada de Simon Says lento: ronda tras ronda sin respirar.
 *
 * Habilidad que mide: memoria espacial bajo presion de reloj.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#c084fc';
const GOOD = '#7cf3c0';
const BAD = '#ff2d55';

const GRID = 4;
const CELLS = GRID * GRID;
const MAX_PATTERN = 8;

/** Teclado: la rejilla 4x4 sobre las cuatro filas de teclas. */
const KEY_CELLS: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
  KeyQ: 4, KeyW: 5, KeyE: 6, KeyR: 7,
  KeyA: 8, KeyS: 9, KeyD: 10, KeyF: 11,
  KeyZ: 12, KeyX: 13, KeyC: 14, KeyV: 15,
};

type Phase = 'flash' | 'input' | 'pause';

export const META: GameMeta = {
  id: 'memory',
  name: 'MEMORY',
  tagline: 'Memoriza las casillas y tocalas todas.',
  skill: 'memoria',
  defaultDurationMs: 30_000,
  instructions: [
    'Se encienden varias casillas durante un instante.',
    'Cuando se apaguen, tocalas todas. El orden da igual.',
    'Cada ronda anade una casilla y acorta el destello.',
  ],
  icon: '▦',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  // GRAVEDAD X2 no pinta nada aqui: no hay inercia que doblar.
  supportedMutators: ['rush', 'onelife', 'blackout', 'mirror', 'swarm', 'sprint', 'double', 'tiny', 'chaos'],
};

class MemoryGame extends BaseMiniGame {
  readonly meta = META;

  private cells: { x: number; y: number; size: number }[] = [];
  private pattern = new Set<number>();
  private found = new Set<number>();
  private wrong = new Map<number, number>();
  private phase: Phase = 'flash';
  private phaseTimer = 0;
  private round = 0;
  private rounds = 0;
  private perfectRounds = 0;
  private failedRounds = 0;
  private inputStart = 0;
  private inputLimit = 0;
  private revealing = false;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
    this.layout();
  }

  protected setup(): void {
    this.pattern = new Set();
    this.found = new Set();
    this.wrong = new Map();
    this.round = 0;
    this.rounds = 0;
    this.perfectRounds = 0;
    this.failedRounds = 0;
    this.revealing = false;
    this.tracksAccuracy = true;
    this.setLives(3);
    this.layout();
    this.nextRound();
  }

  protected override onResize(): void {
    this.layout();
  }

  private layout(): void {
    const padX = this.width * 0.08;
    const available = Math.min(this.width - padX * 2, this.areaHeight * 0.78);
    const gap = available * 0.045;
    const size = (available - gap * (GRID - 1)) / GRID;
    const left = (this.width - available) / 2;
    const top = this.areaTop + (this.areaHeight - available) / 2;

    this.cells = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        this.cells.push({
          x: left + col * (size + gap),
          y: top + row * (size + gap),
          size,
        });
      }
    }
  }

  /** Cuantas casillas toca memorizar en esta ronda. */
  private get patternSize(): number {
    const base = 3 + Math.floor(this.round * 0.9) + Math.round(this.config.difficulty * 1.5);
    return Math.min(MAX_PATTERN, base + this.mut.extraHazards);
  }

  /**
   * Cuanto dura el destello: baja con las rondas y con ACELERON, pero nunca
   * por debajo de lo que un ojo humano puede leer. Ademas es lo que marca el
   * ritmo: sin suelo, un jugador perfecto encadenaria rondas sin fin.
   */
  private get flashMs(): number {
    const base = 1000 - this.round * 45 - this.config.difficulty * 120;
    return Math.max(500, base) / Math.max(0.6, this.mut.speed);
  }

  /**
   * Cuanto tiempo hay para tocar las casillas. Sin este limite, quien no
   * recuerda el patron se queda ahi parado y la partida se congela: el reloj
   * corre pero no pasa nada. Con limite, fallar cuesta pero el juego sigue.
   */
  private get inputMs(): number {
    return (1400 + this.pattern.size * 650) / Math.max(0.6, this.mut.speed);
  }

  private nextRound(): void {
    this.round++;
    this.pattern = new Set();
    this.found = new Set();
    this.wrong.clear();
    this.revealing = false;
    const size = this.patternSize;
    while (this.pattern.size < size) this.pattern.add(this.rng.int(0, CELLS - 1));
    this.phase = 'flash';
    this.phaseTimer = this.flashMs / 1000;
    this.services.audio.play('countdown');
  }

  /** Se acabo el tiempo de la ronda: se ensena lo que faltaba y a la siguiente. */
  private failRound(): void {
    this.failedRounds++;
    this.misses += this.pattern.size - this.found.size;
    this.breakCombo();
    this.announce('SE ACABO EL TIEMPO', 'bad');
    this.services.audio.play('miss');
    this.services.fx.shake(0.4);
    this.revealing = true;
    this.phase = 'pause';
    this.phaseTimer = 0.7;
  }

  protected tick(dt: number): void {
    for (const [index, value] of this.wrong) {
      const next = value - dt;
      if (next <= 0) this.wrong.delete(index);
      else this.wrong.set(index, next);
    }

    this.phaseTimer -= dt;
    if (this.phase === 'flash') {
      if (this.phaseTimer <= 0) {
        this.phase = 'input';
        this.inputStart = this.elapsedMs;
        this.inputLimit = this.inputMs / 1000;
        this.phaseTimer = this.inputLimit;
      }
      return;
    }
    if (this.phase === 'pause') {
      if (this.phaseTimer <= 0) this.nextRound();
      return;
    }

    if (this.phaseTimer <= 0) {
      this.failRound();
      return;
    }

    this.handleTaps();
  }

  private handleTaps(): void {
    const points: { x: number; y: number }[] = [];
    for (const tap of this.services.input.taps) {
      points.push(
        this.mut.invertControls
          ? { x: this.width - tap.x, y: this.height - tap.y }
          : { x: tap.x, y: tap.y },
      );
    }
    for (const code of this.services.input.keyTaps) {
      const index = KEY_CELLS[code];
      if (index === undefined) continue;
      const cell = this.cells[index];
      if (cell) points.push({ x: cell.x + cell.size / 2, y: cell.y + cell.size / 2 });
    }

    for (const point of points) {
      const index = this.cellAt(point.x, point.y);
      if (index === null || this.found.has(index)) continue;
      const cell = this.cells[index] as { x: number; y: number; size: number };
      const cx = cell.x + cell.size / 2;
      const cy = cell.y + cell.size / 2;

      if (!this.pattern.has(index)) {
        this.wrong.set(index, 0.45);
        this.registerMistake(0);
        this.services.fx.burst(cx, cy, { count: 12, color: BAD, speed: 220, size: 4, shape: 'cuadro' });
        continue;
      }

      this.found.add(index);
      this.registerHit();
      const combo = this.bumpCombo();
      const multiplier = 1 + Math.min(10, combo) * 0.05;
      // Bonus por rapidez: recordar deprisa vale mas que recordar despacio.
      const elapsed = (this.elapsedMs - this.inputStart) / 1000;
      const speed = Math.max(0, 1 - elapsed / (1.2 + this.pattern.size * 0.35));
      // La casilla suelta vale poco: lo que puntua de verdad es cerrar la
      // ronda. Asi el techo lo marca el reloj (rondas posibles en 30 s) y no
      // lo rapido que uno mueva el dedo.
      this.addScore(Math.round((12 + speed * 12) * multiplier), cx, cy);
      this.services.fx.burst(cx, cy, { count: 8, color: GOOD, speed: 180, size: 3.5, shape: 'cuadro' });
      this.services.haptics.fire('light');

      if (this.found.size === this.pattern.size) this.completeRound();
    }
  }

  private completeRound(): void {
    this.rounds++;
    this.revealing = false;
    if (this.mistakes === 0 || this.wrong.size === 0) this.perfectRounds++;
    const bonus = 120 + 25 * this.pattern.size;
    const center = this.gridCenter();
    this.addScore(bonus, center.x, center.y);
    this.announce(`RONDA ${this.rounds}`, 'good');
    this.services.audio.play('passed');
    this.services.fx.flash(hexToRgba(ACCENT, 0.5), 0.18);
    this.phase = 'pause';
    // Medio segundo de respiro: da tiempo a ver el acierto y evita que la
    // partida se convierta en una metralleta para quien va sobrado.
    this.phaseTimer = 0.6;
  }

  /** Barra fina bajo la rejilla: cuanto queda para que se acabe la ronda. */
  private drawInputTimer(): void {
    const first = this.cells[0];
    const last = this.cells[CELLS - 1];
    if (!first || !last) return;
    const ctx = this.ctx;
    const left = first.x;
    const width = last.x + last.size - first.x;
    const y = last.y + last.size + 12;
    const ratio = Math.max(0, Math.min(1, this.phaseTimer / Math.max(0.001, this.inputLimit)));

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, left, y, width, 4, 2);
    ctx.fill();
    ctx.fillStyle = ratio < 0.3 ? BAD : hexToRgba(ACCENT, 0.9);
    roundRect(ctx, left, y, width * ratio, 4, 2);
    ctx.fill();
    ctx.restore();
  }

  private gridCenter(): { x: number; y: number } {
    const first = this.cells[0];
    const last = this.cells[CELLS - 1];
    if (!first || !last) return { x: this.width / 2, y: this.height / 2 };
    return {
      x: (first.x + last.x + last.size) / 2,
      y: (first.y + last.y + last.size) / 2,
    };
  }

  private cellAt(x: number, y: number): number | null {
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i] as { x: number; y: number; size: number };
      if (x >= cell.x && x <= cell.x + cell.size && y >= cell.y && y <= cell.y + cell.size) return i;
    }
    return null;
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, 0, 58);

    const scale = Math.max(0.55, Math.min(1, this.mut.sizeMultiplier));
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i] as { x: number; y: number; size: number };
      const size = cell.size * scale;
      const offset = (cell.size - size) / 2;
      const x = cell.x + offset;
      const y = cell.y + offset;

      const lit = (this.phase === 'flash' || this.revealing) && this.pattern.has(i);
      const done = this.found.has(i);
      const failed = this.wrong.has(i);

      ctx.save();
      if (lit) {
        ctx.fillStyle = ACCENT;
        ctx.shadowColor = ACCENT;
        ctx.shadowBlur = 22;
      } else if (done) {
        ctx.fillStyle = hexToRgba(GOOD, 0.85);
        ctx.shadowColor = GOOD;
        ctx.shadowBlur = 14;
      } else if (failed) {
        ctx.fillStyle = hexToRgba(BAD, 0.8);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
      }
      roundRect(ctx, x, y, size, size, size * 0.18);
      ctx.fill();

      if (!lit && !done && !failed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    const center = this.gridCenter();
    const top = (this.cells[0]?.y ?? this.areaTop) - 26;
    if (this.phase === 'flash') {
      label(ctx, 'MEMORIZA', center.x, top, { size: 15, color: hexToRgba(ACCENT, 0.9) });
    } else if (this.phase === 'input') {
      label(ctx, `${this.pattern.size - this.found.size} CASILLAS`, center.x, top, {
        size: 15,
        color: 'rgba(255,255,255,0.75)',
      });
      this.drawInputTimer();
    } else if (this.revealing) {
      label(ctx, 'ERAN ESTAS', center.x, top, { size: 15, color: hexToRgba(BAD, 0.9) });
    }

    label(ctx, `RONDA ${this.round}`, center.x, this.areaBottom - 16, {
      size: 13,
      color: 'rgba(255,255,255,0.45)',
      weight: 800,
    });
  }

  protected override metrics(): Record<string, number> {
    return { rounds: this.rounds, perfectRounds: this.perfectRounds, failedRounds: this.failedRounds };
  }

  debugInfo(): Record<string, unknown> {
    return {
      game: 'memory',
      phase: this.phase,
      round: this.round,
      inputLeft: this.phase === 'input' ? Math.max(0, this.phaseTimer) : null,
      pattern: Array.from(this.pattern),
      found: Array.from(this.found),
      cells: this.cells.map((cell) => ({
        x: cell.x + cell.size / 2,
        y: cell.y + cell.size / 2,
        size: cell.size,
      })),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new MemoryGame(services, config),
};
