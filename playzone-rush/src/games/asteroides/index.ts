/**
 * ASTEROIDES - las rocas grandes son el problema pequeno.
 *
 * Disparar una roca no la quita: la parte en dos mas rapidas. Vaciar la
 * pantalla a lo loco llena el sitio de metralla, asi que hay que decidir que
 * romper y que esquivar.
 *
 * Habilidad que mide: esquivar mientras decides, en dos ejes.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label } from '../../game/draw';

const ACCENT = '#facc15';
const ROCA = '#94a3b8';

interface Roca {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radio: number;
  /** 2 = grande, 1 = mediana, 0 = metralla. */
  nivel: number;
  giro: number;
  vGiro: number;
  vertices: number[];
}

interface Disparo {
  x: number;
  y: number;
  vy: number;
}

export const META: GameMeta = {
  id: 'asteroides',
  name: 'ASTEROIDES',
  tagline: 'Dispara sola. Las rocas se parten en dos.',
  skill: 'supervivencia',
  defaultDurationMs: 30_000,
  instructions: [
    'Arrastra el dedo: la nave te sigue por toda la pantalla.',
    'Dispara sola. Una roca grande se parte en dos medianas.',
    'Chocar con una roca cuesta una vida.',
  ],
  icon: '☄',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'swarm', 'tiny', 'chaos'],
};

class AsteroidesGame extends BaseMiniGame {
  readonly meta = META;

  private rocas: Roca[] = [];
  private disparos: Disparo[] = [];
  private x = 0;
  private y = 0;
  private cadencia = 0;
  private spawn = 0;
  private rotas = 0;
  private choques = 0;
  private invulnerable = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.rocas = [];
    this.disparos = [];
    this.x = this.width / 2;
    this.y = this.areaBottom - this.areaHeight * 0.18;
    this.cadencia = 0;
    this.spawn = 0.4;
    this.rotas = 0;
    this.choques = 0;
    this.invulnerable = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
  }

  private get radioNave(): number {
    return Math.min(this.width, this.areaHeight) * 0.035 * this.mut.sizeMultiplier;
  }

  private radioNivel(nivel: number): number {
    return Math.min(this.width, this.areaHeight) * (nivel === 2 ? 0.085 : nivel === 1 ? 0.052 : 0.03);
  }

  private crearRoca(nivel: number, x: number, y: number, vx: number, vy: number): void {
    const vertices: number[] = [];
    for (let i = 0; i < 9; i++) vertices.push(this.rng.range(0.74, 1.15));
    this.rocas.push({
      x, y, vx, vy,
      radio: this.radioNivel(nivel),
      nivel,
      giro: this.rng.range(0, Math.PI * 2),
      vGiro: this.rng.range(-1.6, 1.6),
      vertices,
    });
  }

  private lanzarDesdeArriba(): void {
    const vel = this.areaHeight * (0.2 + this.config.difficulty * 0.12 + this.progress * 0.2) * Math.max(0.5, this.mut.speed);
    const x = this.rng.range(this.width * 0.1, this.width * 0.9);
    this.crearRoca(2, x, this.areaTop - this.radioNivel(2), this.rng.range(-vel * 0.4, vel * 0.4), vel);
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    const input = this.services.input;
    if (input.down) {
      const ox = this.pointerX();
      const oy = this.pointerY();
      this.x += (ox - this.x) * Math.min(1, dt * 15);
      this.y += (oy - this.y) * Math.min(1, dt * 15);
    } else {
      this.x += this.axisX() * this.width * 0.8 * dt;
      this.y += this.axisY() * this.areaHeight * 0.8 * dt;
    }
    this.x = Math.max(this.radioNave, Math.min(this.width - this.radioNave, this.x));
    this.y = Math.max(this.areaTop + this.radioNave, Math.min(this.areaBottom - this.radioNave, this.y));

    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = Math.max(
        0.5,
        (1.6 - this.config.difficulty * 0.4 - this.progress * 0.5) / Math.max(0.5, this.mut.spawnRate),
      );
      this.lanzarDesdeArriba();
      for (let i = 0; i < this.mut.extraHazards; i++) if (this.rng.chance(0.5)) this.lanzarDesdeArriba();
    }

    this.cadencia -= dt;
    if (this.cadencia <= 0) {
      this.cadencia = 0.26 / Math.max(0.6, this.mut.speed);
      this.disparos.push({ x: this.x, y: this.y - this.radioNave, vy: -this.areaHeight * 2.1 });
      this.services.audio.play('tap');
    }

    for (let i = this.disparos.length - 1; i >= 0; i--) {
      const d = this.disparos[i] as Disparo;
      d.y += d.vy * dt;
      if (d.y < this.areaTop - 10) {
        this.disparos.splice(i, 1);
        this.misses++;
      }
    }

    for (let i = this.rocas.length - 1; i >= 0; i--) {
      const roca = this.rocas[i] as Roca;
      roca.x += roca.vx * dt;
      roca.y += roca.vy * dt;
      roca.giro += roca.vGiro * dt;
      if (roca.x < roca.radio || roca.x > this.width - roca.radio) roca.vx *= -1;
      if (roca.y - roca.radio > this.areaBottom) this.rocas.splice(i, 1);
    }

    this.impactos();
    this.colisiones();
  }

  private impactos(): void {
    for (let i = this.disparos.length - 1; i >= 0; i--) {
      const d = this.disparos[i] as Disparo;
      const j = this.rocas.findIndex((r) => Math.hypot(r.x - d.x, r.y - d.y) <= r.radio);
      if (j < 0) continue;
      const roca = this.rocas.splice(j, 1)[0] as Roca;
      this.disparos.splice(i, 1);
      this.rotas++;
      this.registerHit();
      const combo = this.bumpCombo();
      // La metralla vale mas: es lo que cuesta acertar de verdad.
      const valor = roca.nivel === 2 ? 30 : roca.nivel === 1 ? 55 : 110;
      this.addScore(Math.round(valor * (1 + Math.min(12, combo) * 0.06)), roca.x, roca.y);
      this.services.audio.play('hit');
      this.services.fx.burst(roca.x, roca.y, { count: 10, color: ROCA, speed: 220, size: 4 });

      if (roca.nivel > 0) {
        const vel = Math.hypot(roca.vx, roca.vy) * 1.25;
        for (const lado of [-1, 1]) {
          const ang = Math.atan2(roca.vy, roca.vx) + lado * 0.6;
          this.crearRoca(roca.nivel - 1, roca.x, roca.y, Math.cos(ang) * vel, Math.sin(ang) * vel);
        }
      }
    }
  }

  private colisiones(): void {
    if (this.invulnerable > 0) return;
    const i = this.rocas.findIndex((r) => Math.hypot(r.x - this.x, r.y - this.y) <= r.radio + this.radioNave * 0.8);
    if (i < 0) return;
    const roca = this.rocas.splice(i, 1)[0] as Roca;
    this.choques++;
    this.registerMistake(0);
    this.announce('IMPACTO', 'bad');
    this.services.audio.play('defeat');
    this.services.haptics.fire('heavy');
    this.services.fx.flash('#ef4444', 0.3);
    this.services.fx.shake(10);
    this.services.fx.burst(roca.x, roca.y, { count: 24, color: '#ef4444', speed: 320, size: 5 });
    this.invulnerable = 1.2;
  }

  protected draw(): void {
    const ctx = this.ctx;

    for (const roca of this.rocas) {
      ctx.save();
      ctx.translate(roca.x, roca.y);
      ctx.rotate(roca.giro);
      ctx.strokeStyle = ROCA;
      ctx.fillStyle = hexToRgba('#0b0b12', 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < roca.vertices.length; i++) {
        const ang = (i / roca.vertices.length) * Math.PI * 2;
        const r = roca.radio * (roca.vertices[i] as number);
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const d of this.disparos) {
      ctx.fillStyle = ACCENT;
      ctx.fillRect(d.x - 1.5, d.y - 10, 3, 14);
    }

    const r = this.radioNave;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.invulnerable > 0) ctx.globalAlpha = 0.4 + Math.sin(this.time * 32) * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.5);
    ctx.lineTo(r, r);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    label(ctx, `${this.rotas} ROTAS`, this.width / 2, this.areaTop + 12, {
      size: 12,
      color: hexToRgba('#ffffff', 0.35),
    });
  }

  protected override metrics(): Record<string, number> {
    return { rotas: this.rotas, choques: this.choques };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'asteroides', rocas: this.rocas.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new AsteroidesGame(services, config),
};
