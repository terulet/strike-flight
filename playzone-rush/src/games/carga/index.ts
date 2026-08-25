/**
 * CARGA - mantener y soltar.
 *
 * Un anillo se llena mientras tienes el dedo puesto. Hay una franja marcada.
 * Suelta dentro de la franja. Ni antes ni despues.
 *
 * Lo que aporta al catalogo es el VERBO. Todo lo demas se juega tocando o
 * arrastrando; este es el unico que se juega SOLTANDO, y soltar a tiempo es
 * una cosa que el cuerpo hace peor bajo presion. Es el juego que mas se falla
 * por nervios y menos por falta de habilidad, que era exactamente lo que se
 * pedia: que se pueda fallar por nervios pero ganar por habilidad.
 *
 * La franja se mueve de sitio cada ronda a proposito. Cuando sale muy pronto
 * hay que reaccionar; cuando sale al final hay que aguantar viendo el anillo
 * acercarse al borde. Son dos tensiones distintas y alternarlas evita que la
 * partida se convierta en un metronomo.
 *
 * PASARSE ES PEOR QUE QUEDARSE CORTO: si el anillo se llena entero, revienta.
 * Sin eso, la estrategia optima seria aguantar siempre hasta el final y no
 * habria ninguna decision que tomar.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropWaves, hexToRgba, label } from '../../game/draw';

const ACCENT = '#a3e635';
const FALLO = '#ff2d55';
const ORO = '#ffd23f';

/** Parte del anillo que ocupa la franja, de la primera ronda a la ultima. */
const FRANJA_MAX = 0.2;
const FRANJA_MIN = 0.055;
/** Parte de la franja que cuenta como clavada, medida desde su centro. */
const CLAVADA = 0.22;

type Fase = 'esperando' | 'cargando' | 'juzgando';

export const META: GameMeta = {
  id: 'carga',
  name: 'CARGA',
  tagline: 'Manten pulsado. Suelta dentro de la franja.',
  skill: 'precision',
  defaultDurationMs: 35_000,
  instructions: [
    'Manten el dedo apretado: el anillo se llena.',
    'Suelta cuando la carga este DENTRO de la franja.',
    'Si se llena del todo, revienta. Pasarse es peor que quedarse corto.',
  ],
  icon: '◕',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  supportedMutators: ['double', 'sprint', 'onelife', 'chaos', 'blackout'],
};

class CargaGame extends BaseMiniGame {
  readonly meta = META;

  private fase: Fase = 'esperando';
  private carga = 0;
  private velocidad = 0.55;
  private franjaIni = 0.5;
  private franjaFin = 0.7;
  private ronda = 0;
  private clavadas = 0;
  private juzgarMs = 0;
  private ultimo: 'clavada' | 'buena' | 'corta' | 'pasada' | null = null;
  private destello = 0;
  private time = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.ronda = 0;
    this.clavadas = 0;
    this.carga = 0;
    this.ultimo = null;
    this.destello = 0;
    this.time = 0;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.nuevaRonda();
  }

  private get ramp(): number {
    return Math.min(1, this.progress * 0.45 + Math.min(1, this.ronda / 12) * 0.55 + this.config.difficulty * 0.25);
  }

  private nuevaRonda(): void {
    this.ronda++;
    const r = this.ramp;

    const ancho = (FRANJA_MAX - (FRANJA_MAX - FRANJA_MIN) * r) * (this.mut.sizeMultiplier < 1 ? 1.3 : 1);
    // La franja nunca empieza antes del 18%: hace falta un margen para que el
    // dedo llegue a apretar y a ver donde esta, y sin el las rondas rapidas se
    // perderian por culpa de la pantalla, no del jugador.
    this.franjaIni = this.rng.range(0.18, 0.94 - ancho);
    this.franjaFin = this.franjaIni + ancho;
    this.velocidad = (0.42 + r * 0.5) * this.mut.speed;

    this.carga = 0;
    this.fase = 'esperando';
  }

  protected tick(dt: number): void {
    this.time += dt;
    this.destello = Math.max(0, this.destello - dt * 2.6);

    if (this.fase === 'juzgando') {
      this.juzgarMs -= dt * 1000;
      if (this.juzgarMs <= 0) this.nuevaRonda();
      return;
    }

    const apretado = this.services.input.down || this.services.input.isKeyDown('Space', 'Enter');

    if (this.fase === 'esperando') {
      if (apretado) this.fase = 'cargando';
      return;
    }

    // cargando
    this.carga += this.velocidad * dt;
    if (this.carga >= 1) {
      this.carga = 1;
      this.reventar();
      return;
    }
    if (!apretado) this.soltar();
  }

  private soltar(): void {
    const centro = (this.franjaIni + this.franjaFin) / 2;
    const medio = (this.franjaFin - this.franjaIni) / 2;
    const dentro = this.carga >= this.franjaIni && this.carga <= this.franjaFin;
    const desvio = Math.abs(this.carga - centro) / Math.max(0.0001, medio); // 0 = centrado

    if (!dentro) {
      this.ultimo = this.carga < this.franjaIni ? 'corta' : 'pasada';
      this.registerMistake(35);
      this.services.fx.shake(4);
      this.services.audio.play('error');
      this.services.haptics.fire('light');
      this.terminarRonda(520);
      return;
    }

    const clavada = desvio <= CLAVADA;
    this.ultimo = clavada ? 'clavada' : 'buena';
    const combo = this.bumpCombo();
    const multi = 1 + Math.min(12, combo) * 0.07;
    // La franja estrecha vale mas: si no, la partida optima seria fallar a
    // proposito para que no subiera la dificultad.
    const finura = 1 - (this.franjaFin - this.franjaIni - FRANJA_MIN) / (FRANJA_MAX - FRANJA_MIN);
    const base = (clavada ? 130 : 55) + finura * 70 + (1 - desvio) * 35;
    this.registerHit();
    if (clavada) this.clavadas++;

    const cx = this.width / 2;
    const cy = this.areaTop + this.areaHeight / 2;
    this.addScore(Math.round(base * multi), cx, cy);
    this.destello = 1;
    this.services.fx.ring(cx, cy, this.radio * 1.45, clavada ? ORO : ACCENT, clavada ? 5 : 3);
    this.services.fx.burst(cx, cy, { count: clavada ? 24 : 12, color: clavada ? ORO : ACCENT, speed: 300, size: 4 });
    this.services.haptics.fire(clavada ? 'medium' : 'light');
    this.services.audio.play(clavada ? 'score' : 'hit');
    if (clavada && combo >= 3) this.announce('PULSO DE ACERO', 'good');
    this.terminarRonda(clavada ? 420 : 340);
  }

  private reventar(): void {
    this.ultimo = 'pasada';
    this.registerMistake(60);
    this.services.fx.shake(10);
    this.services.fx.flash(FALLO, 0.22);
    this.services.fx.burst(this.width / 2, this.areaTop + this.areaHeight / 2, {
      count: 30, color: FALLO, speed: 420, size: 5,
    });
    this.services.audio.play('defeat');
    this.services.haptics.fire('heavy');
    this.terminarRonda(620);
  }

  private terminarRonda(ms: number): void {
    this.fase = 'juzgando';
    this.juzgarMs = ms;
  }

  private get radio(): number {
    return Math.min(this.width * 0.38, this.areaHeight * 0.28);
  }

  protected draw(): void {
    const ctx = this.ctx;
    backdropWaves(ctx, this.width, this.height, ACCENT, this.time);

    const cx = this.width / 2;
    const cy = this.areaTop + this.areaHeight / 2;
    const r = this.radio;
    const arco = (t: number) => -Math.PI / 2 + t * Math.PI * 2;

    // Canal
    ctx.save();
    ctx.strokeStyle = hexToRgba('#1e293b', 0.9);
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Franja buena
    ctx.save();
    ctx.strokeStyle = hexToRgba(ACCENT, this.fase === 'juzgando' ? 0.4 : 0.85);
    ctx.lineWidth = r * 0.2;
    ctx.lineCap = 'butt';
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, arco(this.franjaIni), arco(this.franjaFin));
    ctx.stroke();
    // El centro de la franja, mas fino y dorado: es donde esta la clavada, y
    // verlo cambia como se juega (se apunta al centro, no a "dentro").
    const centro = (this.franjaIni + this.franjaFin) / 2;
    const medio = ((this.franjaFin - this.franjaIni) / 2) * CLAVADA;
    ctx.strokeStyle = hexToRgba(ORO, 0.9);
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, arco(centro - medio), arco(centro + medio));
    ctx.stroke();
    ctx.restore();

    // Carga
    if (this.carga > 0) {
      ctx.save();
      const color = this.ultimo === 'pasada' && this.fase === 'juzgando' ? FALLO : '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 0.1;
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 + this.destello * 24;
      ctx.beginPath();
      ctx.arc(cx, cy, r, arco(0), arco(this.carga));
      ctx.stroke();

      // La cabeza de la carga, para ver exactamente donde esta.
      const a = arco(this.carga);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const texto =
      this.fase === 'esperando' ? 'APRIETA'
      : this.fase === 'cargando' ? 'SUELTA EN LA FRANJA'
      : this.ultimo === 'clavada' ? 'CLAVADA'
      : this.ultimo === 'buena' ? 'DENTRO'
      : this.ultimo === 'corta' ? 'CORTO'
      : 'TE HAS PASADO';
    const color =
      this.fase !== 'juzgando' ? hexToRgba('#ffffff', 0.8)
      : this.ultimo === 'clavada' ? ORO
      : this.ultimo === 'buena' ? ACCENT
      : FALLO;
    label(ctx, texto, cx, cy, { size: this.ultimo === 'clavada' && this.fase === 'juzgando' ? 30 : 19, color });

    if (this.combo >= 3) {
      label(ctx, `x${(1 + Math.min(12, this.combo) * 0.07).toFixed(2)}`, cx, cy + r + 52, {
        size: 20,
        color: hexToRgba(ORO, 0.9),
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return { rondas: this.ronda, clavadas: this.clavadas };
  }

  debugInfo(): Record<string, unknown> {
    return {
      game: 'carga',
      fase: this.fase,
      ronda: this.ronda,
      carga: Number(this.carga.toFixed(3)),
      franja: [Number(this.franjaIni.toFixed(3)), Number(this.franjaFin.toFixed(3))],
      velocidad: Number(this.velocidad.toFixed(3)),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new CargaGame(services, config),
};
