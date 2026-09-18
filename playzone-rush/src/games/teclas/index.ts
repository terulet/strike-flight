/**
 * TECLAS - reflejos en cadena.
 *
 * Bajan fichas por cuatro carriles y hay que ir tocando la de mas abajo, sin
 * saltarse ninguna. Empieza pareciendo facil y acaba siendo una carrera: la
 * velocidad sube durante toda la partida y una sola ficha perdida corta la
 * racha entera.
 *
 * Habilidad que mide: velocidad sostenida y precision bajo prisa.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameConfig, GameDefinition, GameMeta, GameServices } from '../../game/contract';
import { hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#f472b6';
const CARRILES = 4;

interface Ficha {
  carril: number;
  /** Borde superior en pixeles. */
  y: number;
  alto: number;
  tocada: boolean;
  /** Animacion de desvanecido tras tocarla. */
  fade: number;
}

const TECLAS_CARRIL: Record<string, number> = {
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3,
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
};

export const META: GameMeta = {
  id: 'teclas',
  name: 'TECLAS',
  tagline: 'Toca las fichas que bajan. No falles ni una.',
  skill: 'reflejos',
  defaultDurationMs: 30_000,
  instructions: [
    'Toca cada ficha antes de que llegue abajo.',
    'Van siempre en orden: la de mas abajo primero.',
    'Una ficha perdida o un toque en falso cuesta una vida.',
  ],
  icon: '🎹',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['blackout', 'double', 'onelife', 'mirror', 'sprint', 'rush', 'swarm', 'chaos'],
};

class TeclasGame extends BaseMiniGame {
  readonly meta = META;

  private fichas: Ficha[] = [];
  private ultimoCarril = -1;
  private tocadas = 0;
  private perdidas = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.fichas = [];
    this.ultimoCarril = -1;
    this.tocadas = 0;
    this.perdidas = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(3);
    // Una columna inicial de fichas para que se vea el patron desde el frame 1.
    const alto = this.altoFicha;
    for (let i = 0; i < 4; i++) this.nuevaFicha(this.areaTop - alto * (i + 1) * 1.05);
  }

  private get anchoCarril(): number {
    return this.width / CARRILES;
  }

  private get altoFicha(): number {
    return Math.max(70, this.areaHeight * 0.22);
  }

  /** Pixeles por segundo: sube con la dificultad y con el reloj. */
  private get velocidad(): number {
    const base = this.areaHeight * (0.62 + this.config.difficulty * 0.3 + this.progress * 0.55);
    return base * Math.max(0.5, this.mut.speed);
  }

  private nuevaFicha(y: number): void {
    let carril = this.rng.int(0, CARRILES - 1);
    if (carril === this.ultimoCarril) carril = (carril + this.rng.int(1, CARRILES - 1)) % CARRILES;
    this.ultimoCarril = carril;
    this.fichas.push({ carril, y, alto: this.altoFicha, tocada: false, fade: 0 });
  }

  /** La ficha viva mas baja: es la unica que se puede tocar. */
  private siguiente(): Ficha | null {
    let mejor: Ficha | null = null;
    for (const ficha of this.fichas) {
      if (ficha.tocada) continue;
      if (!mejor || ficha.y > mejor.y) mejor = ficha;
    }
    return mejor;
  }

  protected tick(dt: number): void {
    this.time += dt;
    const avance = this.velocidad * dt;

    for (const ficha of this.fichas) {
      ficha.y += avance;
      if (ficha.tocada) ficha.fade = Math.min(1, ficha.fade + dt * 5);
    }

    // Ficha perdida: ha salido entera por abajo sin que nadie la tocara.
    for (let i = this.fichas.length - 1; i >= 0; i--) {
      const ficha = this.fichas[i] as Ficha;
      if (ficha.y <= this.areaBottom) continue;
      this.fichas.splice(i, 1);
      if (ficha.tocada) continue;
      this.perdidas++;
      // Igual que en los demas: escaparsele una rompe la racha, pero la vida
      // se paga por aporrear donde no toca, que es lo que hay que castigar.
      this.misses++;
      this.breakCombo();
      this.announce('SE TE HA ESCAPADO', 'bad');
      this.services.audio.play('miss');
      this.services.fx.flash('#ef4444', 0.18);
    }

    // Alimentar por arriba manteniendo el hueco entre fichas.
    const masAlta = this.fichas.reduce((min, f) => Math.min(min, f.y), this.areaTop + this.areaHeight);
    const hueco = this.altoFicha * (1.02 + (this.mut.extraHazards > 0 ? -0.18 : 0));
    if (masAlta > this.areaTop - this.altoFicha) this.nuevaFicha(masAlta - hueco);

    this.resolverToques();
  }

  private resolverToques(): void {
    const puntos = this.tapPoints();
    for (const code of this.services.input.keyTaps) {
      const carril = TECLAS_CARRIL[code];
      if (carril === undefined) continue;
      puntos.push({ x: (carril + 0.5) * this.anchoCarril, y: this.areaBottom - 10 });
    }

    for (const punto of puntos) {
      const carril = Math.floor(punto.x / this.anchoCarril);
      const objetivo = this.siguiente();
      if (!objetivo || objetivo.carril !== carril) {
        // Tocar donde no toca es tan malo como perder una ficha: si no, la
        // estrategia ganadora seria aporrear la pantalla entera.
        this.registerMistake(20);
        this.announce('AHI NO', 'bad');
        this.services.audio.play('error');
        this.services.fx.ring(punto.x, punto.y, 30, 'rgba(255,255,255,0.3)', 2);
        continue;
      }
      objetivo.tocada = true;
      this.tocadas++;
      this.registerHit();
      const combo = this.bumpCombo();
      // Cuanto mas abajo la coges, mas apurada iba: mas puntos.
      const apuro = Math.min(1, Math.max(0, (objetivo.y - this.areaTop) / this.areaHeight));
      const multiplicador = 1 + Math.min(15, combo) * 0.05;
      const cx = (carril + 0.5) * this.anchoCarril;
      this.addScore(Math.round((30 + apuro * 45) * multiplicador), cx, objetivo.y);
      this.services.audio.play(combo > 0 && combo % 10 === 0 ? 'combo' : 'hit');
      this.services.haptics.fire('tick');
      this.services.fx.burst(cx, objetivo.y + objetivo.alto / 2, {
        count: 8,
        color: ACCENT,
        speed: 190,
        size: 3,
      });
    }
  }

  protected draw(): void {
    const ctx = this.ctx;
    const ancho = this.anchoCarril;

    // Carriles: lineas tenues que explican la rejilla sin robar atencion.
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let i = 1; i < CARRILES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * ancho, this.areaTop);
      ctx.lineTo(i * ancho, this.areaBottom);
      ctx.stroke();
    }
    ctx.restore();

    const objetivo = this.siguiente();

    for (const ficha of this.fichas) {
      const x = ficha.carril * ancho;
      const y = Math.max(this.areaTop, ficha.y);
      const alto = Math.min(ficha.alto, this.areaBottom - y);
      if (alto <= 0) continue;

      ctx.save();
      if (ficha.tocada) {
        ctx.globalAlpha = 0.5 * (1 - ficha.fade);
        ctx.fillStyle = ACCENT;
      } else {
        ctx.fillStyle = ficha === objetivo ? '#11111b' : '#0b0b12';
      }
      roundRect(ctx, x + 4, y + 3, ancho - 8, alto - 6, 12);
      ctx.fill();
      ctx.restore();

      if (!ficha.tocada) {
        ctx.save();
        ctx.strokeStyle = ficha === objetivo ? ACCENT : hexToRgba('#ffffff', 0.16);
        ctx.lineWidth = ficha === objetivo ? 2.5 : 1;
        roundRect(ctx, x + 4, y + 3, ancho - 8, alto - 6, 12);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.combo >= 5) {
      label(ctx, `${this.combo} SEGUIDAS`, this.width / 2, this.areaTop + 18, {
        size: 16,
        color: hexToRgba('#ffd23f', 0.9),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { tocadas: this.tocadas, perdidas: this.perdidas };
  }

  debugInfo(): Record<string, unknown> {
    return { game: 'teclas', fichas: this.fichas.length, velocidad: Math.round(this.velocidad) };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new TeclasGame(services, config),
};
