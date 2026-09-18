/**
 * TUNEL - volar sin tocar nada.
 *
 * Un toque sube, la gravedad baja. El tunel se estrecha y se retuerce segun
 * avanzas. Se aprende en dos segundos y no se domina en toda la partida.
 *
 * Habilidad que mide: control fino de un solo boton.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label } from '../../game/draw';

const ACCENT = '#22d3ee';

interface Pared {
  x: number;
  /** Centro del hueco, en pixeles. */
  centro: number;
  hueco: number;
  pasada: boolean;
}

export const META: GameMeta = {
  id: 'tunel',
  name: 'TUNEL',
  tagline: 'Toca para subir. No roces las paredes.',
  skill: 'supervivencia',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca para dar un impulso hacia arriba.',
    'Pasa por el hueco de cada pared.',
    'Chocar cuesta una vida y te frena.',
  ],
  icon: '🛸',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'heavy', 'mirror', 'sprint', 'rush', 'tiny', 'chaos'],
};

class TunelGame extends BaseMiniGame {
  readonly meta = META;

  private y = 0;
  private vy = 0;
  private paredes: Pared[] = [];
  private pasadas = 0;
  private choques = 0;
  private invulnerable = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.y = this.areaTop + this.areaHeight / 2;
    this.vy = 0;
    this.paredes = [];
    this.pasadas = 0;
    this.choques = 0;
    this.invulnerable = 0;
    this.time = 0;
    this.tracksAccuracy = false;
    this.setLives(3);
    for (let i = 0; i < 3; i++) this.crearPared(this.width * (0.9 + i * 0.55));
  }

  private get gravedad(): number {
    return this.areaHeight * 2.4 * Math.max(0.5, this.mut.gravity);
  }

  private get impulso(): number {
    return -this.areaHeight * 0.78 * Math.sqrt(Math.max(0.5, this.mut.gravity));
  }

  private get velX(): number {
    return this.width * (0.34 + this.config.difficulty * 0.14 + this.progress * 0.2) * Math.max(0.5, this.mut.speed);
  }

  private get radio(): number {
    return Math.min(this.width, this.areaHeight) * 0.038 * this.mut.sizeMultiplier;
  }

  private crearPared(x: number): void {
    // El hueco se cierra segun avanza la partida, pero nunca por debajo de lo
    // que cabe la nave con margen para corregir.
    const minimo = this.radio * 6;
    const hueco = Math.max(minimo, this.areaHeight * (0.42 - this.config.difficulty * 0.1 - this.progress * 0.12));
    const margen = hueco / 2 + this.areaHeight * 0.06;
    this.paredes.push({
      x,
      centro: this.rng.range(this.areaTop + margen, this.areaBottom - margen),
      hueco,
      pasada: false,
    });
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    if (this.tapPoints().length > 0 || this.services.input.keyTaps.length > 0) {
      this.vy = this.impulso;
      this.services.audio.play('tap');
      this.services.fx.burst(this.naveX, this.y + this.radio, { count: 5, color: ACCENT, speed: 120, size: 3 });
    }

    this.vy += this.gravedad * dt;
    this.y += this.vy * dt;

    // Techo y suelo: no matan, pero frenan en seco y cortan la racha.
    if (this.y < this.areaTop + this.radio) {
      this.y = this.areaTop + this.radio;
      this.vy = 0;
      this.breakCombo();
    } else if (this.y > this.areaBottom - this.radio) {
      this.y = this.areaBottom - this.radio;
      this.vy = 0;
      this.breakCombo();
    }

    const avance = this.velX * dt;
    for (let i = this.paredes.length - 1; i >= 0; i--) {
      const pared = this.paredes[i] as Pared;
      pared.x -= avance;
      if (!pared.pasada && pared.x + this.anchoPared < this.naveX) {
        pared.pasada = true;
        this.pasadas++;
        const combo = this.bumpCombo();
        this.addScore(Math.round(90 * (1 + Math.min(10, combo) * 0.08)), this.naveX, this.y);
        this.services.audio.play('hit');
      }
      if (pared.x + this.anchoPared < -10) this.paredes.splice(i, 1);
    }

    const ultima = this.paredes.reduce((max, p) => Math.max(max, p.x), 0);
    if (ultima < this.width - this.width * 0.5) this.crearPared(this.width + this.anchoPared);

    this.comprobarChoque();
  }

  private get naveX(): number {
    return this.width * 0.3;
  }

  private get anchoPared(): number {
    return Math.max(18, this.width * 0.075);
  }

  private comprobarChoque(): void {
    if (this.invulnerable > 0) return;
    const r = this.radio;
    for (const pared of this.paredes) {
      if (this.naveX + r < pared.x || this.naveX - r > pared.x + this.anchoPared) continue;
      const dentro = this.y - r > pared.centro - pared.hueco / 2 && this.y + r < pared.centro + pared.hueco / 2;
      if (dentro) continue;
      this.choques++;
      this.registerMistake(0);
      this.announce('CHOQUE', 'bad');
      this.services.audio.play('defeat');
      this.services.haptics.fire('heavy');
      this.services.fx.flash('#ef4444', 0.28);
      this.services.fx.shake(9);
      this.invulnerable = 1;
      // Recolocar en el hueco para que no encadene choques sin poder hacer nada.
      this.y = pared.centro;
      this.vy = 0;
      return;
    }
  }

  protected draw(): void {
    const ctx = this.ctx;

    for (const pared of this.paredes) {
      const arriba = pared.centro - pared.hueco / 2;
      const abajo = pared.centro + pared.hueco / 2;
      ctx.save();
      ctx.fillStyle = hexToRgba(ACCENT, 0.5);
      ctx.fillRect(pared.x, this.areaTop, this.anchoPared, arriba - this.areaTop);
      ctx.fillRect(pared.x, abajo, this.anchoPared, this.areaBottom - abajo);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pared.x, arriba);
      ctx.lineTo(pared.x + this.anchoPared, arriba);
      ctx.moveTo(pared.x, abajo);
      ctx.lineTo(pared.x + this.anchoPared, abajo);
      ctx.stroke();
      ctx.restore();
    }

    // La nave, inclinada segun sube o baja: da sensacion de vuelo.
    const r = this.radio;
    ctx.save();
    ctx.translate(this.naveX, this.y);
    ctx.rotate(Math.max(-0.6, Math.min(0.9, this.vy / (this.areaHeight * 1.6))));
    if (this.invulnerable > 0) ctx.globalAlpha = 0.45 + Math.sin(this.time * 32) * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(r * 1.6, 0);
    ctx.lineTo(-r, -r * 0.9);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r, r * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    label(ctx, `${this.pasadas}`, this.width / 2, this.areaTop + 26, {
      size: 30,
      color: hexToRgba('#ffffff', 0.18),
    });
  }

  protected override metrics(): Record<string, number> {
    return { pasadas: this.pasadas, choques: this.choques };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'tunel', y: Math.round(this.y), paredes: this.paredes.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new TunelGame(services, config),
};
