/**
 * INVASORES - la oleada baja sola.
 *
 * La nave sigue el dedo y dispara sin parar: no hay boton de disparo, asi que
 * todo el juego es donde te pones. Bajar a por los de delante da puntos ya;
 * quedarse atras es mas seguro pero la fila de arriba sigue avanzando.
 *
 * Habilidad que mide: posicionamiento bajo presion.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#22d3ee';
const ENEMIGO = '#a855f7';

interface Invasor {
  col: number;
  fila: number;
  vivo: boolean;
}

interface Bala {
  x: number;
  y: number;
  vy: number;
  mia: boolean;
}

const COLS = 6;
const FILAS = 4;

export const META: GameMeta = {
  id: 'invasores',
  name: 'INVASORES',
  tagline: 'Muevete. La nave dispara sola.',
  skill: 'precision',
  defaultDurationMs: 30_000,
  instructions: [
    'Arrastra el dedo para mover la nave.',
    'Dispara sola: solo tienes que apuntar con el cuerpo.',
    'Si te dan o la oleada llega abajo, pierdes una vida.',
  ],
  icon: '👾',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'swarm', 'tiny', 'chaos'],
};

class InvasoresGame extends BaseMiniGame {
  readonly meta = META;

  private invasores: Invasor[] = [];
  private balas: Bala[] = [];
  private x = 0;
  private desplaz = 0;
  private dirFormacion = 1;
  private bajada = 0;
  private cadencia = 0;
  private cadenciaEnemiga = 0;
  private derribos = 0;
  private oleadas = 0;
  private invulnerable = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.balas = [];
    this.x = this.width / 2;
    this.desplaz = 0;
    this.dirFormacion = 1;
    this.bajada = 0;
    this.cadencia = 0;
    this.cadenciaEnemiga = 0.8;
    this.derribos = 0;
    this.oleadas = 0;
    this.invulnerable = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
    this.nuevaOleada();
  }

  private nuevaOleada(): void {
    this.invasores = [];
    for (let fila = 0; fila < FILAS; fila++) {
      for (let col = 0; col < COLS; col++) this.invasores.push({ col, fila, vivo: true });
    }
    this.bajada = 0;
    this.desplaz = 0;
    this.oleadas++;
  }

  private get paso(): number {
    return this.width / (COLS + 2);
  }

  private get naveY(): number {
    return this.areaBottom - Math.max(26, this.areaHeight * 0.06);
  }

  private invasorX(inv: Invasor): number {
    return this.paso * (inv.col + 1.5) + this.desplaz;
  }

  private invasorY(inv: Invasor): number {
    return this.areaTop + this.paso * 0.9 + inv.fila * this.paso * 0.85 + this.bajada;
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    const input = this.services.input;
    if (input.down) {
      const objetivo = this.pointerX();
      this.x += (objetivo - this.x) * Math.min(1, dt * 16);
    } else {
      this.x += this.axisX() * this.width * 0.8 * dt;
    }
    this.x = Math.max(this.paso * 0.5, Math.min(this.width - this.paso * 0.5, this.x));

    this.moverFormacion(dt);
    this.disparar(dt);
    this.moverBalas(dt);
  }

  private moverFormacion(dt: number): void {
    const vivos = this.invasores.filter((i) => i.vivo);
    if (vivos.length === 0) {
      this.addScore(400, this.width / 2, this.areaTop + 40);
      this.announce('OLEADA LIMPIA', 'good');
      this.services.audio.play('record');
      this.nuevaOleada();
      return;
    }

    // Cuantos menos quedan, mas rapido van: el clasico que pone nervioso.
    const prisa = 1 + (1 - vivos.length / (COLS * FILAS)) * 1.8 + this.progress * 0.5;
    const vel = this.paso * 0.9 * prisa * Math.max(0.5, this.mut.speed);
    this.desplaz += this.dirFormacion * vel * dt;

    const izq = Math.min(...vivos.map((i) => this.invasorX(i)));
    const der = Math.max(...vivos.map((i) => this.invasorX(i)));
    if (der > this.width - this.paso * 0.6 || izq < this.paso * 0.6) {
      this.dirFormacion *= -1;
      this.bajada += this.paso * 0.42;
    }

    const masBajo = Math.max(...vivos.map((i) => this.invasorY(i)));
    if (masBajo > this.naveY - this.paso * 0.5) {
      this.golpe('TE HAN DESBORDADO');
      this.nuevaOleada();
    }
  }

  private disparar(dt: number): void {
    this.cadencia -= dt;
    if (this.cadencia <= 0) {
      this.cadencia = 0.32 / Math.max(0.6, this.mut.speed);
      this.balas.push({ x: this.x, y: this.naveY - this.paso * 0.4, vy: -this.areaHeight * 1.9, mia: true });
      this.services.audio.play('tap');
    }

    this.cadenciaEnemiga -= dt;
    if (this.cadenciaEnemiga > 0) return;
    this.cadenciaEnemiga = Math.max(
      0.35,
      (1.5 - this.config.difficulty * 0.4 - this.progress * 0.5) / Math.max(0.5, this.mut.spawnRate),
    );
    const vivos = this.invasores.filter((i) => i.vivo);
    if (vivos.length === 0) return;
    // Solo dispara el de abajo de cada columna: si no, es una lluvia injusta.
    const tirador = this.rng.pick(vivos.filter((i) => !vivos.some((o) => o.col === i.col && o.fila > i.fila)));
    if (!tirador) return;
    this.balas.push({
      x: this.invasorX(tirador),
      y: this.invasorY(tirador) + this.paso * 0.3,
      vy: this.areaHeight * (0.75 + this.config.difficulty * 0.3),
      mia: false,
    });
  }

  private moverBalas(dt: number): void {
    const radio = this.paso * 0.34;
    for (let i = this.balas.length - 1; i >= 0; i--) {
      const bala = this.balas[i] as Bala;
      bala.y += bala.vy * dt;
      if (bala.y < this.areaTop - 20 || bala.y > this.areaBottom + 20) {
        this.balas.splice(i, 1);
        if (bala.mia) this.misses++;
        continue;
      }

      if (bala.mia) {
        const objetivo = this.invasores.find(
          (inv) => inv.vivo && Math.abs(this.invasorX(inv) - bala.x) < radio && Math.abs(this.invasorY(inv) - bala.y) < radio,
        );
        if (!objetivo) continue;
        objetivo.vivo = false;
        this.balas.splice(i, 1);
        this.derribos++;
        this.registerHit();
        const combo = this.bumpCombo();
        // Las filas de arriba valen mas: bajar a por ellas es arriesgarse.
        const valor = 40 + (FILAS - objetivo.fila) * 15;
        this.addScore(Math.round(valor * (1 + Math.min(12, combo) * 0.06)), this.invasorX(objetivo), this.invasorY(objetivo));
        this.services.audio.play('hit');
        this.services.fx.burst(this.invasorX(objetivo), this.invasorY(objetivo), {
          count: 12,
          color: ENEMIGO,
          speed: 230,
          size: 4,
        });
        continue;
      }

      if (this.invulnerable > 0) continue;
      if (Math.abs(bala.x - this.x) < this.paso * 0.42 && Math.abs(bala.y - this.naveY) < this.paso * 0.42) {
        this.balas.splice(i, 1);
        this.golpe('TE HAN DADO');
      }
    }
  }

  private golpe(motivo: string): void {
    this.registerMistake(0);
    this.announce(motivo, 'bad');
    this.services.audio.play('defeat');
    this.services.haptics.fire('heavy');
    this.services.fx.flash('#ef4444', 0.3);
    this.services.fx.shake(9);
    this.invulnerable = 1.1;
  }

  protected draw(): void {
    const ctx = this.ctx;
    const r = this.paso * 0.3;

    for (const inv of this.invasores) {
      if (!inv.vivo) continue;
      const x = this.invasorX(inv);
      const y = this.invasorY(inv);
      ctx.save();
      ctx.fillStyle = ENEMIGO;
      // Cuerpo con dos patas: se reconoce como bicho sin necesitar sprites.
      roundRect(ctx, x - r, y - r * 0.7, r * 2, r * 1.4, r * 0.4);
      ctx.fill();
      const bob = Math.sin(this.time * 6 + inv.col) > 0 ? 1 : -1;
      ctx.fillRect(x - r * 0.8, y + r * 0.7, r * 0.5, r * 0.5 * bob + r * 0.5);
      ctx.fillRect(x + r * 0.3, y + r * 0.7, r * 0.5, -r * 0.5 * bob + r * 0.5);
      ctx.fillStyle = '#0b0b12';
      ctx.beginPath();
      ctx.arc(x - r * 0.38, y, r * 0.17, 0, Math.PI * 2);
      ctx.arc(x + r * 0.38, y, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const bala of this.balas) {
      ctx.fillStyle = bala.mia ? ACCENT : '#fb7185';
      roundRect(ctx, bala.x - 2, bala.y - 9, 4, 18, 2);
      ctx.fill();
    }

    ctx.save();
    if (this.invulnerable > 0) ctx.globalAlpha = 0.4 + Math.sin(this.time * 30) * 0.3;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(this.x, this.naveY - this.paso * 0.45);
    ctx.lineTo(this.x + this.paso * 0.42, this.naveY + this.paso * 0.25);
    ctx.lineTo(this.x - this.paso * 0.42, this.naveY + this.paso * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    label(ctx, `OLEADA ${this.oleadas}`, this.width / 2, this.areaTop + 12, {
      size: 12,
      color: hexToRgba('#ffffff', 0.4),
    });
  }

  protected override metrics(): Record<string, number> {
    return { derribos: this.derribos, oleadas: this.oleadas };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'invasores', vivos: this.invasores.filter((i) => i.vivo).length, balas: this.balas.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new InvasoresGame(services, config),
};
