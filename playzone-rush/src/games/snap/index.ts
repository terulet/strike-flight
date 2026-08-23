/**
 * SNAP - precision.
 *
 * Regla unica: dispara lo mas cerca posible del centro de la diana. La diana
 * se mueve y despues de cada disparo salta a otro sitio, mas rapida.
 *
 * Habilidad que mide: punteria y control del impulso (disparar rapido tienta,
 * pero un fallo rompe el combo).
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { backdropGrid, hexToRgba, label } from '../../game/draw';

const ACCENT = '#facc15';
const PERFECT = '#7cf3c0';
const DANGER = '#ff2d55';

interface Shot {
  x: number;
  y: number;
  life: number;
  quality: number;
}

export const META: GameMeta = {
  id: 'snap',
  name: 'SNAP',
  tagline: 'Dispara al centro. Encadena dianas.',
  skill: 'precision',
  defaultDurationMs: 30_000,
  instructions: [
    'Tienes 18 disparos. Cada uno cuenta.',
    'Cuanto mas cerca del centro, mas puntos. Fuera = disparo perdido.',
    'Con teclado: flechas para mover la mira y ESPACIO para disparar.',
  ],
  icon: '◉',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
};

class SnapGame extends BaseMiniGame {
  readonly meta = META;

  private tx = 0;
  private ty = 0;
  private vx = 0;
  private vy = 0;
  private radius = 60;
  private shots: Shot[] = [];
  private perfects = 0;
  private jumpFlash = 0;
  private crossX = 0;
  private crossY = 0;
  private usingKeyboard = false;
  private shotsFired = 0;
  private accuracySum = 0;
  private cooldown = 0;
  private ammo = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
    this.tx = this.width / 2;
    this.ty = this.height / 2;
  }

  protected setup(): void {
    this.radius = Math.min(this.width, this.areaHeight) * 0.17 * this.mut.sizeMultiplier;
    this.tx = this.width / 2;
    this.ty = this.areaTop + this.areaHeight * 0.45;
    this.crossX = this.width / 2;
    this.crossY = this.height / 2;
    this.shots = [];
    this.perfects = 0;
    this.shotsFired = 0;
    this.accuracySum = 0;
    this.jumpFlash = 0;
    this.usingKeyboard = false;
    this.cooldown = 0;
    this.ammo = SnapGame.AMMO;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.launch();
  }

  protected override onResize(): void {
    this.radius = Math.min(this.width, this.areaHeight) * 0.17 * this.mut.sizeMultiplier;
    this.tx = Math.min(this.width - this.radius, Math.max(this.radius, this.tx));
    this.ty = Math.min(this.areaBottom - this.radius, Math.max(this.areaTop + this.radius, this.ty));
  }

  private get speed(): number {
    const ramp = 0.55 + this.progress * 0.85 + this.config.difficulty * 0.4;
    const combo = 1 + Math.min(10, this.combo) * 0.045;
    return Math.min(this.width, this.areaHeight) * 0.44 * ramp * combo * this.mut.speed;
  }

  private launch(): void {
    const angle = this.rng.range(0, Math.PI * 2);
    this.vx = Math.cos(angle);
    this.vy = Math.sin(angle);
  }

  protected tick(dt: number): void {
    // Movimiento con rebote y pequenas correcciones de rumbo.
    const speed = this.speed;
    if (this.rng.chance(dt * 1.2)) {
      const turn = this.rng.range(-0.7, 0.7);
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const nx = this.vx * cos - this.vy * sin;
      const ny = this.vx * sin + this.vy * cos;
      this.vx = nx;
      this.vy = ny;
    }
    this.tx += this.vx * speed * dt;
    this.ty += this.vy * speed * dt;

    const margin = this.radius * 1.05;
    const topLimit = this.areaTop;
    const bottomLimit = this.areaBottom - 34;
    if (this.tx < margin) {
      this.tx = margin;
      this.vx = Math.abs(this.vx);
    }
    if (this.tx > this.width - margin) {
      this.tx = this.width - margin;
      this.vx = -Math.abs(this.vx);
    }
    if (this.ty < topLimit + margin) {
      this.ty = topLimit + margin;
      this.vy = Math.abs(this.vy);
    }
    if (this.ty > bottomLimit - margin) {
      this.ty = bottomLimit - margin;
      this.vy = -Math.abs(this.vy);
    }

    this.jumpFlash = Math.max(0, this.jumpFlash - dt * 3);
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i] as Shot;
      shot.life -= dt;
      if (shot.life <= 0) this.shots.splice(i, 1);
    }

    this.handleInput(dt);
  }

  private handleInput(dt: number): void {
    const input = this.services.input;

    // Mira de teclado
    const ax = this.axisX();
    const ay = this.axisY();
    if (ax !== 0 || ay !== 0) {
      this.usingKeyboard = true;
      const speed = Math.min(this.width, this.height) * 1.1;
      this.crossX = Math.max(0, Math.min(this.width, this.crossX + ax * speed * dt));
      this.crossY = Math.max(0, Math.min(this.height, this.crossY + ay * speed * dt));
    }
    if (input.keyTaps.includes('Space') || input.keyTaps.includes('Enter')) {
      this.usingKeyboard = true;
      this.shoot(this.crossX, this.crossY);
    }

    for (const tap of input.taps) {
      this.usingKeyboard = false;
      const x = this.mut.invertControls ? this.width - tap.x : tap.x;
      const y = this.mut.invertControls ? this.height - tap.y : tap.y;
      this.crossX = x;
      this.crossY = y;
      this.shoot(x, y);
    }
  }

  /** Cargador: la tension no es el reloj, es que cada bala cuenta. */
  private static readonly AMMO = 18;
  /** Pequeno margen para que un doble toque accidental no gaste dos balas. */
  private static readonly COOLDOWN = 0.12;

  private shoot(x: number, y: number): void {
    if (this.cooldown > 0 || this.ammo <= 0) return;
    this.cooldown = SnapGame.COOLDOWN;
    this.ammo--;
    const dist = Math.hypot(x - this.tx, y - this.ty);
    const ratio = dist / this.radius;
    this.shotsFired++;
    this.shots.push({ x, y, life: 0.7, quality: Math.max(0, 1 - ratio) });

    if (ratio > 1) {
      this.accuracySum += 0;
      this.registerMistake(0);
      this.services.fx.burst(x, y, { count: 8, color: DANGER, speed: 180, size: 3, shape: 'chispa' });
      this.services.fx.float(x, y, 'FUERA', { color: DANGER, size: 20 });
      this.checkAmmo();
      return;
    }

    this.registerHit();
    this.accuracySum += Math.max(0, 1 - ratio);
    const combo = this.bumpCombo();
    const multiplier = 1 + Math.min(10, combo) * 0.05;

    let base: number;
    let color: string;
    let text: string;
    if (ratio <= 0.18) {
      base = 200;
      color = PERFECT;
      text = 'PERFECTO';
      this.perfects++;
      this.services.fx.ring(this.tx, this.ty, this.radius * 2.2, PERFECT, 4);
      this.services.fx.shake(0.25);
      this.services.haptics.fire('medium');
    } else if (ratio <= 0.45) {
      base = 120;
      color = ACCENT;
      text = 'BUENO';
      this.services.haptics.fire('light');
    } else {
      base = 50;
      color = '#94a3b8';
      text = 'ROZADO';
    }

    this.addScore(Math.round(base * multiplier), x, y);
    this.services.fx.float(x, y - 30, text, { color, size: 16 });
    this.services.fx.burst(this.tx, this.ty, { count: 14, color, speed: 240, size: 4, shape: 'chispa' });

    // La diana salta: nueva posicion lejos de la anterior.
    this.jumpTo();
    this.checkAmmo();
  }

  /** Sin balas se acaba la partida, aunque quede tiempo. */
  private checkAmmo(): void {
    if (this.ammo > 0) return;
    this.announce('SIN BALAS', 'bad');
    this.finish('death');
  }

  private jumpTo(): void {
    const margin = this.radius * 1.15;
    let x = this.tx;
    let y = this.ty;
    for (let i = 0; i < 8; i++) {
      x = this.rng.range(margin, this.width - margin);
      y = this.rng.range(this.areaTop + margin, this.areaBottom - 34 - margin);
      if (Math.hypot(x - this.tx, y - this.ty) > Math.min(this.width, this.height) * 0.28) break;
    }
    this.tx = x;
    this.ty = y;
    this.jumpFlash = 1;
    this.launch();
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, 0, 52);

    // Marcas de disparos anteriores
    for (const shot of this.shots) {
      const t = shot.life / 0.7;
      ctx.save();
      ctx.globalAlpha = t * 0.8;
      ctx.strokeStyle = shot.quality > 0 ? '#ffffff' : DANGER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shot.x - 7, shot.y);
      ctx.lineTo(shot.x + 7, shot.y);
      ctx.moveTo(shot.x, shot.y - 7);
      ctx.lineTo(shot.x, shot.y + 7);
      ctx.stroke();
      ctx.restore();
    }

    // Diana
    const pop = 1 + this.jumpFlash * 0.12;
    const r = this.radius * pop;
    ctx.save();
    ctx.translate(this.tx, this.ty);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const rings: [number, string, number][] = [
      [1, hexToRgba(ACCENT, 0.55), 2],
      [0.62, hexToRgba(ACCENT, 0.85), 2.5],
      [0.28, hexToRgba(PERFECT, 0.95), 3],
    ];
    for (const [scale, color, width] of rings) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(0, 0, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PERFECT;
    ctx.shadowColor = PERFECT;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mira de teclado
    if (this.usingKeyboard) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.crossX, this.crossY, 12, 0, Math.PI * 2);
      ctx.moveTo(this.crossX - 18, this.crossY);
      ctx.lineTo(this.crossX + 18, this.crossY);
      ctx.moveTo(this.crossX, this.crossY - 18);
      ctx.lineTo(this.crossX, this.crossY + 18);
      ctx.stroke();
      ctx.restore();
    }

    this.drawAmmo();

    if (this.combo >= 3) {
      label(ctx, `COMBO x${(1 + Math.min(10, this.combo) * 0.05).toFixed(2)}`, this.width / 2, this.areaBottom - 42, {
        size: 18,
        color: hexToRgba(PERFECT, 0.9),
      });
    }
  }

  /** Cargador dibujado abajo: se lee de un vistazo cuantas balas quedan. */
  private drawAmmo(): void {
    const ctx = this.ctx;
    const total = SnapGame.AMMO;
    const gap = 4;
    const width = Math.min(this.width * 0.8, 240);
    const tick = (width - gap * (total - 1)) / total;
    const x0 = (this.width - width) / 2;
    const y = this.areaBottom - 14;
    ctx.save();
    for (let i = 0; i < total; i++) {
      const spent = i >= this.ammo;
      ctx.fillStyle = spent ? 'rgba(255,255,255,0.14)' : ACCENT;
      if (!spent && this.ammo <= 4) ctx.fillStyle = DANGER;
      ctx.fillRect(x0 + i * (tick + gap), y, tick, 6);
    }
    label(ctx, `${this.ammo} DISPAROS`, this.width / 2, y - 14, {
      size: 11,
      color: this.ammo <= 4 ? DANGER : 'rgba(255,255,255,0.55)',
      weight: 800,
    });
    ctx.restore();
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'snap', target: { x: this.tx, y: this.ty, r: this.radius }, ammo: this.ammo };
  }

  protected override metrics(): Record<string, number> {
    return {
      perfects: this.perfects,
      shots: this.shotsFired,
      meanAccuracy: this.shotsFired > 0 ? Math.round((this.accuracySum / this.shotsFired) * 100) : 0,
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new SnapGame(services, config),
};
