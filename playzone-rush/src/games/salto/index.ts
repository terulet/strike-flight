/**
 * SALTO - subir sin mirar atras.
 *
 * Se rebota solo; lo unico que controlas es el lado. La camara sube contigo y
 * no baja, asi que fallar una plataforma no siempre se paga al momento: se
 * paga dos saltos despues, cuando ya no llegas.
 *
 * Habilidad que mide: control lateral y leer la siguiente plataforma, no la
 * que tienes debajo.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#4ade80';
const FRAGIL = '#fb7185';

interface Plataforma {
  x: number;
  /** Altura en el mundo: crece hacia arriba. */
  altura: number;
  ancho: number;
  fragil: boolean;
  usada: boolean;
}

export const META: GameMeta = {
  id: 'salto',
  name: 'SALTO',
  tagline: 'Arrastra el dedo. Sube y no te caigas.',
  skill: 'supervivencia',
  defaultDurationMs: 30_000,
  instructions: [
    'Mueve el dedo a los lados: el muneco te sigue.',
    'Rebota solo al caer sobre una plataforma.',
    'Las ROJAS se rompen al pisarlas. Caerte cuesta una vida.',
  ],
  icon: '⬆',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'heavy', 'mirror', 'sprint', 'rush', 'tiny', 'chaos'],
};

class SaltoGame extends BaseMiniGame {
  readonly meta = META;

  private plataformas: Plataforma[] = [];
  private x = 0;
  /** Altura del muneco en el mundo. */
  private altura = 0;
  private vy = 0;
  /** Altura del borde inferior de la camara. */
  private camara = 0;
  private maxAltura = 0;
  private caidas = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.x = this.width / 2;
    this.altura = 0;
    this.vy = 0;
    this.camara = 0;
    this.maxAltura = 0;
    this.caidas = 0;
    this.time = 0;
    this.tracksAccuracy = false;
    this.setLives(3);
    this.plataformas = [{ x: this.width / 2 - this.anchoPlataforma / 2, altura: 0, ancho: this.anchoPlataforma, fragil: false, usada: false }];
    for (let i = 1; i < 14; i++) this.crear(i * this.separacion);
  }

  private get anchoPlataforma(): number {
    return Math.max(52, this.width * 0.26 * this.mut.sizeMultiplier);
  }

  private get separacion(): number {
    return this.areaHeight * (0.17 + this.config.difficulty * 0.05);
  }

  private get gravedad(): number {
    return this.areaHeight * 2.6 * Math.max(0.5, this.mut.gravity);
  }

  /** Velocidad de rebote: justo para pasar de una plataforma a la siguiente. */
  private get rebote(): number {
    return Math.sqrt(2 * this.gravedad * this.separacion * 1.75);
  }

  private crear(altura: number): void {
    const ancho = this.anchoPlataforma * this.rng.range(0.8, 1.15);
    this.plataformas.push({
      x: this.rng.range(0, this.width - ancho),
      altura: altura + this.rng.range(-this.separacion * 0.18, this.separacion * 0.18),
      ancho,
      fragil: this.rng.chance(0.12 + this.config.difficulty * 0.14 + this.progress * 0.1),
      usada: false,
    });
  }

  protected tick(dt: number): void {
    this.time += dt;

    // Control lateral: el dedo manda, el teclado como respaldo.
    const input = this.services.input;
    if (input.down) {
      const objetivo = this.pointerX();
      this.x += (objetivo - this.x) * Math.min(1, dt * 14);
    } else {
      this.x += this.axisX() * this.width * 0.7 * dt;
    }
    // Se sale por un lado y entra por el otro, como en el original.
    if (this.x < 0) this.x += this.width;
    if (this.x > this.width) this.x -= this.width;

    this.vy -= this.gravedad * dt;
    this.altura += this.vy * dt;

    if (this.vy < 0) this.comprobarRebote(dt);

    if (this.altura > this.maxAltura) {
      const ganado = this.altura - this.maxAltura;
      this.maxAltura = this.altura;
      this.addScore(Math.round(ganado / (this.areaHeight * 0.06)) * 6, undefined, undefined, { silent: true });
    }

    // La camara persigue hacia arriba, nunca hacia abajo.
    const objetivoCam = this.altura - this.areaHeight * 0.45;
    if (objetivoCam > this.camara) this.camara = objetivoCam;

    const masAlta = this.plataformas.reduce((max, p) => Math.max(max, p.altura), 0);
    if (masAlta < this.camara + this.areaHeight * 1.6) this.crear(masAlta + this.separacion);
    this.plataformas = this.plataformas.filter((p) => p.altura > this.camara - this.areaHeight * 0.4);

    if (this.altura < this.camara - this.areaHeight * 0.12) this.caer();
  }

  private comprobarRebote(dt: number): void {
    const anterior = this.altura - this.vy * dt;
    const medio = this.anchoJugador / 2;
    for (const plat of this.plataformas) {
      if (plat.usada) continue;
      // Cruza la plataforma de arriba abajo en este frame.
      if (!(anterior >= plat.altura && this.altura <= plat.altura)) continue;
      if (this.x + medio < plat.x || this.x - medio > plat.x + plat.ancho) continue;

      this.vy = this.rebote;
      this.altura = plat.altura;
      this.services.audio.play('tap');
      this.services.haptics.fire('tick');
      this.services.fx.burst(this.x, this.pantallaY(plat.altura), { count: 6, color: plat.fragil ? FRAGIL : ACCENT, speed: 140, size: 3 });
      if (plat.fragil) {
        plat.usada = true;
        this.breakCombo();
      } else {
        this.bumpCombo();
      }
      return;
    }
  }

  private caer(): void {
    this.caidas++;
    this.registerMistake(0);
    this.announce('TE HAS CAIDO', 'bad');
    this.services.audio.play('defeat');
    this.services.haptics.fire('heavy');
    this.services.fx.flash('#ef4444', 0.3);
    if (this.lives !== null && this.lives <= 0) return;
    // Se vuelve a poner en juego sobre una plataforma cercana a la camara.
    const rescate = this.plataformas
      .filter((p) => !p.usada && p.altura > this.camara + this.areaHeight * 0.1)
      .sort((a, b) => a.altura - b.altura)[0];
    if (rescate) {
      this.x = rescate.x + rescate.ancho / 2;
      this.altura = rescate.altura;
    } else {
      this.altura = this.camara + this.areaHeight * 0.3;
    }
    this.vy = this.rebote;
  }

  private get anchoJugador(): number {
    return Math.min(this.width * 0.09, this.areaHeight * 0.06) * this.mut.sizeMultiplier;
  }

  /** Pasa una altura del mundo a una Y de pantalla. */
  private pantallaY(altura: number): number {
    return this.areaBottom - (altura - this.camara);
  }

  protected draw(): void {
    const ctx = this.ctx;

    for (const plat of this.plataformas) {
      const y = this.pantallaY(plat.altura);
      if (y < this.areaTop - 20 || y > this.areaBottom + 20) continue;
      ctx.save();
      ctx.globalAlpha = plat.usada ? 0.18 : 1;
      ctx.fillStyle = plat.fragil ? FRAGIL : ACCENT;
      roundRect(ctx, plat.x, y, plat.ancho, 9, 4);
      ctx.fill();
      ctx.restore();
    }

    const r = this.anchoJugador / 2;
    const y = this.pantallaY(this.altura) - r;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, this.x - r, y - r, r * 2, r * 2, r * 0.5);
    ctx.fill();
    ctx.fillStyle = '#0b0b12';
    ctx.beginPath();
    ctx.arc(this.x - r * 0.32, y - r * 0.15, r * 0.15, 0, Math.PI * 2);
    ctx.arc(this.x + r * 0.32, y - r * 0.15, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    label(ctx, `${Math.round(this.maxAltura / (this.areaHeight * 0.06))} m`, this.width / 2, this.areaTop + 16, {
      size: 15,
      color: hexToRgba('#ffffff', 0.45),
    });
  }

  protected override metrics(): Record<string, number> {
    return { altura: Math.round(this.maxAltura), caidas: this.caidas };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'salto', altura: Math.round(this.altura), plataformas: this.plataformas.length };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new SaltoGame(services, config),
};
