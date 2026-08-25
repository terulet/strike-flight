/**
 * CAZA - busqueda visual.
 *
 * Una rejilla llena de flechas mirando todas al mismo sitio. Una no. Tocala.
 *
 * Por que este juego y no otro mas: el catalogo se habia llenado de "reacciona
 * rapido" (PULSE, SNAP, RITMO) y de "acuerdate" (MEMORY). Faltaba BUSCAR, que
 * es una habilidad distinta de verdad: aqui no gana el que tiene el dedo mas
 * rapido sino el que barre la pantalla con la mirada de forma ordenada. Se
 * nota jugando, y se nota en que gana otra gente.
 *
 * La dificultad tiene dos manetas y las dos hacen falta:
 *  - cuantas flechas hay (mas sitio donde mirar),
 *  - cuanto esta torcida la rara (menos evidente cuando la miras).
 * Solo con la primera el juego se hace largo pero no dificil; solo con la
 * segunda se hace injusto en pantalla de movil.
 *
 * El angulo comun cambia en cada ronda a proposito: si fuera siempre "todas
 * hacia arriba", a los diez segundos ya no buscas la rara, buscas la que no
 * apunta arriba, que es un juego mas facil y mas aburrido.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropGrid, hexToRgba, label } from '../../game/draw';

const ACCENT = '#f472b6';
const FALLO = '#ff2d55';

/** Segundos que dura una ronda antes de rendirse sola. */
const RONDA_MAX = 6.5;
const RONDA_MIN = 3.2;

interface Casilla {
  x: number;
  y: number;
  angulo: number;
  rara: boolean;
  /** 0..1, se apaga solo; sirve para el destello al acertar o al rendirse. */
  brillo: number;
}

export const META: GameMeta = {
  id: 'caza',
  name: 'CAZA',
  tagline: 'Todas miran igual menos una. Encuentrala.',
  skill: 'busqueda',
  defaultDurationMs: 30_000,
  instructions: [
    'Todas las flechas apuntan al mismo sitio. Una esta torcida.',
    'Tocala antes de que se acabe la ronda.',
    'Cada acierto la siguiente es mas dificil. Fallar corta la racha.',
  ],
  icon: '⌖',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['double', 'sprint', 'tiny', 'blackout', 'chaos', 'onelife'],
};

class CazaGame extends BaseMiniGame {
  readonly meta = META;

  private casillas: Casilla[] = [];
  private columnas = 3;
  private filas = 5;
  private rara = 0;
  private tiempoRonda = 0;
  private limiteRonda = RONDA_MAX;
  private ronda = 0;
  private aciertos = 0;
  private rendidas = 0;
  /** Se congela un momento al acertar para que se vea cual era. */
  private pausaMs = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.columnas = 3;
    this.ronda = 0;
    this.aciertos = 0;
    this.rendidas = 0;
    this.pausaMs = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.nuevaRonda();
  }

  protected override onResize(): void {
    this.colocar();
  }

  /** 0..1: cuanto ha apretado el juego. Sube con el tiempo y con los aciertos. */
  private get ramp(): number {
    const porRondas = Math.min(1, this.ronda / 14);
    return Math.min(1, this.progress * 0.45 + porRondas * 0.55 + this.config.difficulty * 0.25);
  }

  private nuevaRonda(): void {
    this.ronda++;
    const r = this.ramp;

    // La rejilla es RECTANGULAR, no cuadrada. Una cuadrada centrada en una
    // pantalla de movil deja media pantalla vacia arriba y abajo, y ademas
    // obliga a hacer las flechas mas pequenas de lo necesario para que quepan
    // a lo ancho. Se eligen columnas por dificultad (3 a 6) y las filas salen
    // de la forma del hueco, asi que la rejilla llena el area util entera.
    this.columnas = 3 + Math.floor(r * 3.99);
    this.filas = Math.max(3, Math.round((this.columnas * this.areaHeight) / Math.max(1, this.width)));
    const total = this.columnas * this.filas;

    // Cuanto se tuerce la rara: de media vuelta (imposible no verla) a 22
    // grados. Por debajo de 20 en un movil ya no se distingue: probado.
    const desvio = (Math.PI * 0.55 - r * (Math.PI * 0.55 - 0.38)) * (this.mut.sizeMultiplier < 1 ? 1.25 : 1);
    const base = this.rng.range(0, Math.PI * 2);
    this.rara = this.rng.int(0, total - 1);
    const signo = this.rng.chance(0.5) ? 1 : -1;

    this.casillas = Array.from({ length: total }, (_, i) => ({
      x: 0,
      y: 0,
      // Un pelin de ruido en las normales: sin el, la rejilla parece impresa y
      // la rara canta por ser la unica que no esta perfectamente alineada.
      angulo: base + (i === this.rara ? signo * desvio : this.rng.range(-0.045, 0.045)),
      rara: i === this.rara,
      brillo: 0,
    }));

    this.limiteRonda = RONDA_MAX - (RONDA_MAX - RONDA_MIN) * r;
    this.tiempoRonda = 0;
    this.colocar();
  }

  private colocar(): void {
    const m = this.margen;
    const pasoX = (this.width - m * 2) / this.columnas;
    const pasoY = (this.areaHeight - m * 2) / this.filas;
    for (let i = 0; i < this.casillas.length; i++) {
      const c = this.casillas[i] as Casilla;
      c.x = m + pasoX * ((i % this.columnas) + 0.5);
      c.y = this.areaTop + m + pasoY * (Math.floor(i / this.columnas) + 0.5);
    }
  }

  private get margen(): number {
    return Math.min(this.width, this.areaHeight) * 0.045;
  }

  private get radio(): number {
    const m = this.margen;
    const pasoX = (this.width - m * 2) / this.columnas;
    const pasoY = (this.areaHeight - m * 2) / this.filas;
    // El menor de los dos pasos: si no, en una rejilla alargada las flechas se
    // solaparian por el lado corto.
    return Math.min(pasoX, pasoY) * 0.36 * this.mut.sizeMultiplier;
  }

  protected tick(dt: number): void {
    this.time += dt;
    for (const c of this.casillas) c.brillo = Math.max(0, c.brillo - dt * 2.6);

    if (this.pausaMs > 0) {
      this.pausaMs -= dt * 1000;
      if (this.pausaMs <= 0) this.nuevaRonda();
      return;
    }

    this.tiempoRonda += dt;
    if (this.tiempoRonda >= this.limiteRonda) {
      this.rendirse();
      return;
    }
    this.mirarToques();
  }

  /** Se acaba la ronda sin encontrarla: se ensena cual era y se sigue. */
  private rendirse(): void {
    this.rendidas++;
    this.misses++;
    this.breakCombo();
    const c = this.casillas[this.rara] as Casilla | undefined;
    if (c) {
      c.brillo = 1;
      this.services.fx.ring(c.x, c.y, this.radio * 2.4, hexToRgba('#94a3b8', 0.9), 3);
    }
    this.services.audio.play('miss');
    this.pausaMs = 420;
  }

  private mirarToques(): void {
    const puntos: { x: number; y: number }[] = [];
    for (const tap of this.services.input.taps) {
      puntos.push(this.mut.invertControls ? { x: this.width - tap.x, y: this.height - tap.y } : { x: tap.x, y: tap.y });
    }

    for (const punto of puntos) {
      const alcance = this.radio * 1.5;
      let mejor = -1;
      let dist = Infinity;
      for (let i = 0; i < this.casillas.length; i++) {
        const c = this.casillas[i] as Casilla;
        const d = Math.hypot(c.x - punto.x, c.y - punto.y);
        if (d < dist && d <= alcance) { dist = d; mejor = i; }
      }
      if (mejor < 0) continue; // fuera de la rejilla: ni premio ni castigo

      const c = this.casillas[mejor] as Casilla;
      if (!c.rara) {
        // Tocar una normal cuesta puntos y racha, pero no se acaba la ronda:
        // acabarla seria castigar dos veces el mismo error.
        this.registerMistake(45);
        c.brillo = 1;
        this.services.fx.burst(c.x, c.y, { count: 10, color: FALLO, speed: 190, size: 4, shape: 'circulo' });
        this.services.fx.shake(3);
        this.services.audio.play('error');
        continue;
      }

      // Acierto. Lo que mas puntua es encontrarla pronto: el que barre bien
      // saca el doble que el que va tocando a ver si suena la flauta.
      const rapidez = 1 - this.tiempoRonda / this.limiteRonda;
      const combo = this.bumpCombo();
      const multi = 1 + Math.min(10, combo) * 0.06;
      const dificultad = 0.6 + (this.columnas - 3) * 0.22;
      const base = 40 + rapidez * 130 * dificultad;
      this.registerHit();
      this.aciertos++;
      this.addScore(Math.round(base * multi), c.x, c.y);
      c.brillo = 1;
      this.services.fx.burst(c.x, c.y, { count: 16, color: ACCENT, speed: 260, size: 4, shape: 'circulo' });
      this.services.fx.ring(c.x, c.y, this.radio * 2.2, ACCENT, 3);
      this.services.haptics.fire('light');
      this.services.audio.play('hit');
      if (combo === 5) this.announce('OJO DE HALCON', 'good');
      this.pausaMs = 150;
      break; // una ronda, un acierto
    }
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropGrid(ctx, this.width, this.height, ACCENT, this.time);

    const r = this.radio;
    for (const c of this.casillas) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angulo);

      if (c.brillo > 0) {
        ctx.shadowColor = c.rara ? ACCENT : FALLO;
        ctx.shadowBlur = 26 * c.brillo;
      }
      // Una punta de flecha. Se lee la direccion de un vistazo, que es de lo
      // que va el juego; un circulo o un cuadrado no tendrian direccion.
      ctx.strokeStyle = c.brillo > 0 ? (c.rara ? ACCENT : FALLO) : hexToRgba('#e2e8f0', 0.86);
      ctx.lineWidth = Math.max(2, r * 0.3);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.72, r * 0.5);
      ctx.lineTo(0, -r * 0.72);
      ctx.lineTo(r * 0.72, r * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Cuanto queda de ronda, en el borde de abajo. Sin numeros: una barra que
    // se vacia se entiende sin leer y no roba atencion a la rejilla.
    const queda = Math.max(0, 1 - this.tiempoRonda / this.limiteRonda);
    const ancho = this.width * 0.5;
    ctx.save();
    ctx.fillStyle = hexToRgba(ACCENT, 0.22);
    ctx.fillRect((this.width - ancho) / 2, this.areaBottom - 10, ancho, 3);
    ctx.fillStyle = queda < 0.25 ? FALLO : ACCENT;
    ctx.fillRect((this.width - ancho) / 2, this.areaBottom - 10, ancho * queda, 3);
    ctx.restore();

    if (this.combo >= 3) {
      label(ctx, `x${(1 + Math.min(10, this.combo) * 0.06).toFixed(2)}`, this.width / 2, this.areaBottom - 30, {
        size: 20,
        color: hexToRgba('#ffd23f', 0.9),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { rondas: this.ronda, aciertos: this.aciertos, rendidas: this.rendidas, casillas: this.casillas.length };
  }

  debugInfo(): Record<string, unknown> {
    const c = this.casillas[this.rara] as Casilla | undefined;
    return {
      game: 'caza',
      columnas: this.columnas,
      casillas: this.casillas.length,
      ronda: this.ronda,
      rara: c ? { x: c.x, y: c.y } : null,
      quedaRonda: Math.max(0, this.limiteRonda - this.tiempoRonda),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new CazaGame(services, config),
};
