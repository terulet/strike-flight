/**
 * DIANA - punteria contra el reloj.
 *
 * Aparecen dianas y se encogen solas. Darle al centro vale el triple que
 * rozarla, asi que hay una decision constante: disparar ya, o esperar medio
 * segundo a tenerla mejor encarada.
 *
 * Habilidad que mide: punteria fina y control del impulso.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, hexToRgba, label } from '../../game/draw';

const ACCENT = '#facc15';
const CENTRO = '#ef4444';

interface Blanco {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radio: number;
  vida: number;
  maxVida: number;
}

export const META: GameMeta = {
  id: 'diana',
  name: 'DIANA',
  tagline: 'Al centro. Las dianas no esperan.',
  skill: 'precision',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca las dianas antes de que se vayan.',
    'El circulo rojo del centro vale el triple.',
    'Fallar el tiro corta la racha.',
  ],
  icon: '🎯',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'swarm', 'tiny', 'chaos'],
};

class DianaGame extends BaseMiniGame {
  readonly meta = META;

  private blancos: Blanco[] = [];
  private spawn = 0;
  private centros = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.blancos = [];
    this.spawn = 0.25;
    this.centros = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(null);
  }

  private get radioBase(): number {
    return Math.min(this.width, this.areaHeight) * 0.11 * this.mut.sizeMultiplier;
  }

  private crear(): void {
    if (this.blancos.length > 5) return;
    const radio = this.radioBase * this.rng.range(0.85, 1.15);
    const margen = radio * 1.4;
    const vida = Math.max(
      0.8,
      (2.4 - this.config.difficulty * 0.6 - this.progress * 0.7) / Math.max(0.6, this.mut.speed),
    );
    // A partir de media partida empiezan a moverse: obliga a seguirlas.
    const movil = this.progress > 0.35 || this.config.difficulty > 0.5;
    const vel = movil ? this.width * this.rng.range(0.06, 0.16) * this.mut.speed : 0;
    const ang = this.rng.range(0, Math.PI * 2);
    this.blancos.push({
      x: this.rng.range(margen, this.width - margen),
      y: this.rng.range(this.areaTop + margen, this.areaBottom - margen),
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      radio,
      vida,
      maxVida: vida,
    });
  }

  protected tick(dt: number): void {
    this.time += dt;

    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = Math.max(
        0.3,
        (1.0 - this.config.difficulty * 0.25 - this.progress * 0.3) / Math.max(0.5, this.mut.spawnRate),
      );
      this.crear();
      for (let i = 0; i < this.mut.extraHazards; i++) if (this.rng.chance(0.45)) this.crear();
    }

    for (let i = this.blancos.length - 1; i >= 0; i--) {
      const blanco = this.blancos[i] as Blanco;
      blanco.x += blanco.vx * dt;
      blanco.y += blanco.vy * dt;
      // Rebote en los bordes de la zona util.
      if (blanco.x < blanco.radio || blanco.x > this.width - blanco.radio) blanco.vx *= -1;
      if (blanco.y < this.areaTop + blanco.radio || blanco.y > this.areaBottom - blanco.radio) blanco.vy *= -1;
      blanco.vida -= dt;
      if (blanco.vida > 0) continue;
      this.blancos.splice(i, 1);
      this.misses++;
      this.breakCombo();
      this.services.fx.ring(blanco.x, blanco.y, blanco.radio * 1.5, hexToRgba('#64748b', 0.8), 2);
      this.services.audio.play('miss');
    }

    for (const punto of this.tapPoints()) this.disparar(punto.x, punto.y);
  }

  private disparar(x: number, y: number): void {
    const i = this.blancos.findIndex((b) => Math.hypot(b.x - x, b.y - y) <= b.radio);
    if (i < 0) {
      this.breakCombo();
      this.misses++;
      this.services.fx.ring(x, y, 22, 'rgba(255,255,255,0.3)', 2);
      this.services.audio.play('error');
      return;
    }
    const blanco = this.blancos.splice(i, 1)[0] as Blanco;
    const dist = Math.hypot(blanco.x - x, blanco.y - y) / blanco.radio; // 0 = centro
    const centro = dist < 0.34;
    if (centro) this.centros++;
    this.registerHit();
    const combo = this.bumpCombo();
    const base = centro ? 150 : 50 + (1 - dist) * 40;
    this.addScore(Math.round(base * (1 + Math.min(10, combo) * 0.06)), blanco.x, blanco.y);
    this.services.audio.play(centro ? 'record' : 'hit');
    this.services.haptics.fire(centro ? 'medium' : 'light');
    this.services.fx.burst(blanco.x, blanco.y, {
      count: centro ? 24 : 12,
      color: centro ? CENTRO : ACCENT,
      speed: centro ? 320 : 220,
      size: 4,
    });
    if (centro) this.services.fx.float(blanco.x, blanco.y - blanco.radio, 'CENTRO', { color: CENTRO, size: 22 });
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, this.time * 8, this.width / 3);

    for (const blanco of this.blancos) {
      // Se encoge segun se le acaba el tiempo: se ve venir sin leer nada.
      const t = blanco.vida / blanco.maxVida;
      const r = blanco.radio * (0.55 + t * 0.45);

      ctx.save();
      ctx.globalAlpha = 0.9;
      for (let anillo = 3; anillo >= 1; anillo--) {
        ctx.beginPath();
        ctx.arc(blanco.x, blanco.y, (r * anillo) / 3, 0, Math.PI * 2);
        ctx.fillStyle = anillo % 2 === 0 ? hexToRgba('#0b0b12', 0.95) : hexToRgba(ACCENT, 0.85);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(blanco.x, blanco.y, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = CENTRO;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = hexToRgba('#ffffff', 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(blanco.x, blanco.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.centros > 0) {
      label(ctx, `${this.centros} AL CENTRO`, this.width / 2, this.areaBottom - 18, {
        size: 14,
        color: hexToRgba(CENTRO, 0.8),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { centros: this.centros, hits: this.hits };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'diana', blancos: this.blancos.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new DianaGame(services, config),
};
