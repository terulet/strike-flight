/**
 * SERPIENTE - la de siempre, en 30 segundos.
 *
 * Giros relativos: tocas a un lado y gira a ese lado. Es el control que
 * funciona con el pulgar sin mirar donde tocas. La serpiente acelera segun
 * crece, asi que el propio exito es lo que te mata.
 *
 * Habilidad que mide: planificar dos movimientos por delante.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#4ade80';
const FRUTA = '#f472b6';

interface Celda {
  x: number;
  y: number;
}

export const META: GameMeta = {
  id: 'serpiente',
  name: 'SERPIENTE',
  tagline: 'Toca a un lado y gira. Come y crece.',
  skill: 'supervivencia',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca en la mitad izquierda o derecha para girar a ese lado.',
    'Come las piezas rosas: cada una te hace mas largo y mas rapido.',
    'Morderte o salirte cuesta una vida y te deja a medio largo.',
  ],
  icon: '🐍',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'chaos'],
};

class SerpienteGame extends BaseMiniGame {
  readonly meta = META;

  private cuerpo: Celda[] = [];
  private dir: Celda = { x: 1, y: 0 };
  private pendiente: Celda | null = null;
  private fruta: Celda = { x: 0, y: 0 };
  private paso = 0;
  private cols = 0;
  private filas = 0;
  private lado = 0;
  private comidas = 0;
  private muertes = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.medirTablero();
    this.reiniciarSerpiente();
    this.comidas = 0;
    this.muertes = 0;
    this.time = 0;
    this.paso = 0;
    this.tracksAccuracy = false;
    this.setLives(3);
    this.colocarFruta();
  }

  protected override onResize(): void {
    this.medirTablero();
    this.reiniciarSerpiente();
    this.colocarFruta();
  }

  private medirTablero(): void {
    this.cols = 13;
    this.lado = this.width / this.cols;
    this.filas = Math.max(8, Math.floor(this.areaHeight / this.lado));
  }

  private reiniciarSerpiente(): void {
    const y = Math.floor(this.filas / 2);
    this.cuerpo = [
      { x: 4, y },
      { x: 3, y },
      { x: 2, y },
    ];
    this.dir = { x: 1, y: 0 };
    this.pendiente = null;
  }

  /** Segundos entre paso y paso: baja segun crece. */
  private get intervalo(): number {
    const largo = this.cuerpo.length;
    const base = 0.21 - Math.min(0.1, largo * 0.004) - this.config.difficulty * 0.03;
    return Math.max(0.075, base / Math.max(0.5, this.mut.speed));
  }

  private colocarFruta(): void {
    for (let intento = 0; intento < 80; intento++) {
      const celda = { x: this.rng.int(0, this.cols - 1), y: this.rng.int(0, this.filas - 1) };
      if (this.cuerpo.some((c) => c.x === celda.x && c.y === celda.y)) continue;
      this.fruta = celda;
      return;
    }
  }

  protected tick(dt: number): void {
    this.time += dt;

    // Giro relativo: izquierda de la pantalla gira a la izquierda.
    for (const punto of this.tapPoints()) this.girar(punto.x < this.width / 2 ? -1 : 1);
    for (const code of this.services.input.keyTaps) {
      if (code === 'ArrowLeft' || code === 'KeyA') this.girar(-1);
      if (code === 'ArrowRight' || code === 'KeyD') this.girar(1);
    }

    this.paso += dt;
    while (this.paso >= this.intervalo) {
      this.paso -= this.intervalo;
      this.avanzar();
    }
  }

  private girar(sentido: -1 | 1): void {
    // Rotacion de 90 grados sobre la direccion actual.
    const base = this.pendiente ?? this.dir;
    this.pendiente = sentido === 1 ? { x: -base.y, y: base.x } : { x: base.y, y: -base.x };
  }

  private avanzar(): void {
    if (this.pendiente) {
      this.dir = this.pendiente;
      this.pendiente = null;
    }
    const cabeza = this.cuerpo[0] as Celda;
    const nueva: Celda = { x: cabeza.x + this.dir.x, y: cabeza.y + this.dir.y };

    if (nueva.x < 0 || nueva.x >= this.cols || nueva.y < 0 || nueva.y >= this.filas) {
      this.morir('CONTRA LA PARED');
      return;
    }
    if (this.cuerpo.some((c) => c.x === nueva.x && c.y === nueva.y)) {
      this.morir('TE HAS MORDIDO');
      return;
    }

    this.cuerpo.unshift(nueva);

    if (nueva.x === this.fruta.x && nueva.y === this.fruta.y) {
      this.comidas++;
      const combo = this.bumpCombo();
      this.addScore(Math.round(70 * (1 + Math.min(12, combo) * 0.08)), this.celdaX(nueva), this.celdaY(nueva));
      this.services.audio.play('hit');
      this.services.haptics.fire('light');
      this.services.fx.burst(this.celdaX(nueva), this.celdaY(nueva), { count: 12, color: FRUTA, speed: 200, size: 4 });
      this.colocarFruta();
      return;
    }
    this.cuerpo.pop();
  }

  private morir(motivo: string): void {
    this.muertes++;
    this.registerMistake(0);
    this.breakCombo();
    this.announce(motivo, 'bad');
    this.services.audio.play('defeat');
    this.services.haptics.fire('heavy');
    this.services.fx.flash('#ef4444', 0.28);
    this.services.fx.shake(8);
    if (this.lives !== null && this.lives <= 0) return;
    // Se conserva la mitad del largo: castigo real, pero sigues en la partida.
    const largo = Math.max(3, Math.floor(this.cuerpo.length / 2));
    this.reiniciarSerpiente();
    while (this.cuerpo.length < largo) {
      const ultimo = this.cuerpo[this.cuerpo.length - 1] as Celda;
      this.cuerpo.push({ x: Math.max(0, ultimo.x - 1), y: ultimo.y });
    }
    this.colocarFruta();
  }

  private celdaX(c: Celda): number {
    return (c.x + 0.5) * this.lado;
  }

  private celdaY(c: Celda): number {
    return this.areaTop + (c.y + 0.5) * this.lado;
  }

  protected draw(): void {
    const ctx = this.ctx;
    const l = this.lado;

    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * l, this.areaTop);
      ctx.lineTo(x * l, this.areaTop + this.filas * l);
      ctx.stroke();
    }
    for (let y = 0; y <= this.filas; y++) {
      ctx.beginPath();
      ctx.moveTo(0, this.areaTop + y * l);
      ctx.lineTo(this.cols * l, this.areaTop + y * l);
      ctx.stroke();
    }
    ctx.restore();

    const pulso = 1 + Math.sin(this.time * 6) * 0.08;
    ctx.fillStyle = FRUTA;
    ctx.beginPath();
    ctx.arc(this.celdaX(this.fruta), this.celdaY(this.fruta), l * 0.32 * pulso, 0, Math.PI * 2);
    ctx.fill();

    for (let i = this.cuerpo.length - 1; i >= 0; i--) {
      const c = this.cuerpo[i] as Celda;
      const t = 1 - i / Math.max(1, this.cuerpo.length);
      ctx.save();
      ctx.globalAlpha = 0.45 + t * 0.55;
      ctx.fillStyle = ACCENT;
      roundRect(ctx, c.x * l + 2, this.areaTop + c.y * l + 2, l - 4, l - 4, i === 0 ? l * 0.36 : l * 0.22);
      ctx.fill();
      ctx.restore();
    }

    label(ctx, `LARGO ${this.cuerpo.length}`, this.width / 2, this.areaBottom - 14, {
      size: 13,
      color: hexToRgba('#ffffff', 0.4),
    });
  }

  protected override metrics(): Record<string, number> {
    return { comidas: this.comidas, largo: this.cuerpo.length, muertes: this.muertes };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'serpiente', largo: this.cuerpo.length, dir: this.dir };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new SerpienteGame(services, config),
};
