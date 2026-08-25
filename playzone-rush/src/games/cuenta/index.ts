/**
 * CUENTA - estimacion de cantidad.
 *
 * Dos nubes de puntos. Toca la que tiene mas. No da tiempo a contar, y ese es
 * justo el punto: se responde con el sentido de la cantidad, no contando.
 *
 * Es el juego mas rapido del catalogo (rondas de menos de un segundo), asi que
 * en una partida caben treinta y pico decisiones. Eso hace dos cosas buenas:
 * la puntuacion sale muy graduada -no es cuestion de tener un golpe de suerte-
 * y la partida se siente frenetica sin necesidad de que nada vaya rapido por
 * la pantalla.
 *
 * EL DETALLE QUE HACE QUE SEA UN JUEGO Y NO UN TRUCO: la mitad de las rondas
 * reparten la MISMA cantidad de tinta a los dos lados, asi que el lado con mas
 * puntos los tiene mas pequenos. Sin eso, no estarias estimando cantidades:
 * estarias mirando que mancha es mas grande, que es muchisimo mas facil y se
 * aprende en tres rondas. Con eso, la unica forma de ganar es la buena.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { hexToRgba, label, roundRect, backdropRadial } from '../../game/draw';

const ACCENT = '#60a5fa';
const FALLO = '#ff2d55';
const BIEN = '#4ade80';

const RONDA_MAX = 1.65;
const RONDA_MIN = 0.75;

interface Punto {
  x: number;
  y: number;
  r: number;
}

interface Lado {
  puntos: Punto[];
  /** 0 = izquierda, 1 = derecha. */
  cual: 0 | 1;
  brillo: number;
  color: string;
}

export const META: GameMeta = {
  id: 'cuenta',
  name: 'CUENTA',
  tagline: 'Toca el lado que tiene mas. Sin contar.',
  skill: 'calculo',
  defaultDurationMs: 30_000,
  instructions: [
    'Salen dos nubes de puntos.',
    'Toca la que tiene MAS. Rapido: no da tiempo a contar.',
    'Cuanto mas parecidas son, mas puntos vale acertar.',
  ],
  icon: '⁙',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['double', 'sprint', 'onelife', 'chaos', 'mirror'],
};

class CuentaGame extends BaseMiniGame {
  readonly meta = META;

  private lados: [Lado, Lado] = [
    { puntos: [], cual: 0, brillo: 0, color: ACCENT },
    { puntos: [], cual: 1, brillo: 0, color: ACCENT },
  ];
  private ganador: 0 | 1 = 0;
  private ronda = 0;
  private aciertos = 0;
  private tiempoRonda = 0;
  private limiteRonda = RONDA_MAX;
  private pausaMs = 0;
  private mejorRatio = 9;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.ronda = 0;
    this.aciertos = 0;
    this.pausaMs = 0;
    this.mejorRatio = 9;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.nuevaRonda();
  }

  protected override onResize(): void {
    this.nuevaRonda();
  }

  private get ramp(): number {
    return Math.min(1, this.progress * 0.4 + Math.min(1, this.ronda / 22) * 0.6 + this.config.difficulty * 0.2);
  }

  private nuevaRonda(): void {
    this.ronda++;
    const r = this.ramp;

    // La ratio entre los dos lados es LA dificultad. 1.9 se ve sin pensar;
    // 1.13 es el limite de lo que un ojo humano acierta por encima del azar.
    const ratio = 1.9 - r * (1.9 - 1.13);
    const menos = Math.round(this.rng.range(7, 13 + r * 9));
    const mas = Math.max(menos + 1, Math.round(menos * ratio));
    this.ganador = this.rng.chance(0.5) ? 0 : 1;
    this.mejorRatio = mas / menos;

    // Mitad de rondas con la tinta igualada (el lado numeroso lleva puntos mas
    // pequenos) y mitad al natural. Alternar impide las dos trampas: mirar
    // solo el tamano de la mancha, o aprender que "el de puntos pequenos gana".
    const igualarTinta = this.rng.chance(0.5);
    const base = Math.min(this.width, this.areaHeight);
    const areaObjetivo = base * base * 0.045;

    const radio = (n: number): number =>
      igualarTinta
        ? Math.sqrt(areaObjetivo / (Math.PI * n))
        : Math.sqrt(areaObjetivo / (Math.PI * ((menos + mas) / 2)));

    for (const lado of this.lados) {
      const n = lado.cual === this.ganador ? mas : menos;
      lado.puntos = this.sembrar(n, radio(n), lado.cual);
      lado.brillo = 0;
      lado.color = ACCENT;
    }

    this.limiteRonda = RONDA_MAX - (RONDA_MAX - RONDA_MIN) * r;
    this.tiempoRonda = 0;
  }

  /** Caja util de un lado. */
  private caja(cual: 0 | 1): { x: number; y: number; w: number; h: number } {
    const margen = this.width * 0.04;
    const hueco = this.width * 0.03;
    const w = (this.width - margen * 2 - hueco) / 2;
    const alto = this.areaHeight * 0.72;
    return {
      x: margen + (cual === 0 ? 0 : w + hueco),
      y: this.areaTop + (this.areaHeight - alto) / 2,
      w,
      h: alto,
    };
  }

  /**
   * Reparte n puntos sin que se solapen. Se intenta unas cuantas veces y si no
   * cabe, se encoge: mas vale un punto pequeno que dos pisados, porque dos
   * pisados se cuentan como uno y la ronda pasa a ser mentira.
   */
  private sembrar(n: number, radio: number, cual: 0 | 1): Punto[] {
    const c = this.caja(cual);
    const puntos: Punto[] = [];
    let r = Math.max(3, radio * this.mut.sizeMultiplier);
    for (let i = 0; i < n; i++) {
      let colocado = false;
      for (let intento = 0; intento < 40 && !colocado; intento++) {
        const x = c.x + this.rng.range(r + 6, c.w - r - 6);
        const y = c.y + this.rng.range(r + 6, c.h - r - 6);
        if (puntos.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + 3)) {
          puntos.push({ x, y, r });
          colocado = true;
        }
      }
      if (!colocado) { r *= 0.86; i--; }
      if (r < 2.5) break;
    }
    return puntos;
  }

  protected tick(dt: number): void {
    this.time += dt;
    for (const lado of this.lados) lado.brillo = Math.max(0, lado.brillo - dt * 3);

    if (this.pausaMs > 0) {
      this.pausaMs -= dt * 1000;
      if (this.pausaMs <= 0) this.nuevaRonda();
      return;
    }

    this.tiempoRonda += dt;
    if (this.tiempoRonda >= this.limiteRonda) {
      this.misses++;
      this.breakCombo();
      const bueno = this.lados[this.ganador] as Lado;
      bueno.brillo = 1;
      bueno.color = BIEN;
      this.services.audio.play('miss');
      this.pausaMs = 260;
      return;
    }
    this.mirarToques();
  }

  private mirarToques(): void {
    for (const tap of this.services.input.taps) {
      const x = this.mut.invertControls ? this.width - tap.x : tap.x;
      const elegido: 0 | 1 = x < this.width / 2 ? 0 : 1;
      this.responder(elegido);
      return; // una respuesta por ronda
    }
    for (const code of this.services.input.keyTaps) {
      if (code === 'ArrowLeft' || code === 'KeyA') return this.responder(0);
      if (code === 'ArrowRight' || code === 'KeyD') return this.responder(1);
    }
  }

  private responder(elegido: 0 | 1): void {
    const lado = this.lados[elegido] as Lado;
    const centro = { x: this.caja(elegido).x + this.caja(elegido).w / 2, y: this.areaTop + this.areaHeight / 2 };

    if (elegido !== this.ganador) {
      this.registerMistake(50);
      lado.brillo = 1;
      lado.color = FALLO;
      const bueno = this.lados[this.ganador] as Lado;
      bueno.brillo = 1;
      bueno.color = BIEN;
      this.services.fx.shake(4);
      this.services.audio.play('error');
      this.pausaMs = 320;
      return;
    }

    // Acertar dos casi iguales vale mucho mas que acertar una obvia: si no,
    // compensaria ir tocando al azar en las dificiles.
    const rapidez = 1 - this.tiempoRonda / this.limiteRonda;
    const finura = Math.max(0, Math.min(1, (1.9 - this.mejorRatio) / 0.77));
    const combo = this.bumpCombo();
    const multi = 1 + Math.min(12, combo) * 0.05;
    const base = 32 + rapidez * 60 + finura * 95;
    this.registerHit();
    this.aciertos++;
    this.addScore(Math.round(base * multi), centro.x, centro.y);
    lado.brillo = 1;
    lado.color = BIEN;
    this.services.fx.burst(centro.x, centro.y, { count: 12, color: ACCENT, speed: 230, size: 4, shape: 'circulo' });
    this.services.haptics.fire('light');
    this.services.audio.play('hit');
    if (combo === 8) this.announce('BUEN OJO', 'good');
    this.pausaMs = 120;
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropRadial(ctx, this.width, this.height, ACCENT, this.time);

    for (const lado of this.lados) {
      const c = this.caja(lado.cual);
      const activo = lado.brillo > 0;

      ctx.save();
      roundRect(ctx, c.x, c.y, c.w, c.h, 18);
      ctx.fillStyle = hexToRgba(activo ? lado.color : '#0b1220', activo ? 0.16 * lado.brillo + 0.06 : 0.5);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(activo ? lado.color : ACCENT, activo ? 0.9 : 0.28);
      ctx.lineWidth = activo ? 3 : 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = activo ? lado.color : '#e2e8f0';
      if (activo) { ctx.shadowColor = lado.color; ctx.shadowBlur = 14 * lado.brillo; }
      for (const p of lado.puntos) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const queda = Math.max(0, 1 - this.tiempoRonda / this.limiteRonda);
    const ancho = this.width * 0.5;
    ctx.save();
    ctx.fillStyle = hexToRgba(ACCENT, 0.2);
    ctx.fillRect((this.width - ancho) / 2, this.areaBottom - 10, ancho, 3);
    ctx.fillStyle = queda < 0.3 ? FALLO : ACCENT;
    ctx.fillRect((this.width - ancho) / 2, this.areaBottom - 10, ancho * queda, 3);
    ctx.restore();

    if (this.combo >= 4) {
      label(ctx, `x${(1 + Math.min(12, this.combo) * 0.05).toFixed(2)}`, this.width / 2, this.areaBottom - 30, {
        size: 20,
        color: hexToRgba('#ffd23f', 0.9),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { rondas: this.ronda, aciertos: this.aciertos };
  }

  debugInfo(): Record<string, unknown> {
    return {
      game: 'cuenta',
      ronda: this.ronda,
      ganador: this.ganador,
      izquierda: this.lados[0].puntos.length,
      derecha: this.lados[1].puntos.length,
      ratio: Number(this.mejorRatio.toFixed(3)),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new CuentaGame(services, config),
};
