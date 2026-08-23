/**
 * RITMO - compas.
 *
 * Las notas bajan por dos carriles y hay que tocar la mitad correcta de la
 * pantalla justo cuando cruzan la linea. Timing MAS una decision de lado: sin
 * el carril seria PULSE con otra piel, y con el ya mide otra cosa.
 *
 * Habilidad que mide: anticipacion y precision temporal. Es la unica familia
 * del juego donde llegar "casi" no vale: o entras en el compas o no.
 *
 * LO QUE HACE QUE ESTO FUNCIONE: las notas no se generan por tiempo de reloj
 * sino enganchadas al planificador de la musica, y el acierto se juzga contra
 * el RELOJ DE AUDIO. El bucle de render y el audio van cada uno por su lado y
 * se desvian; juzgando contra performance.now() el jugador fallaria haciendolo
 * bien, que es la peor sensacion posible en un juego de ritmo.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropGrid, glowCircle, hexToRgba, label } from '../../game/draw';

const ACCENT = '#d7ff3e';
const LANE_A = '#22d3ee';
const LANE_B = '#ff2f6d';

/** Ventanas de acierto, en segundos de desvio respecto al compas. */
const PERFECTO = 0.055;
const BIEN = 0.12;
/** Pasado esto la nota se da por perdida. */
const FALLADA = 0.17;

/** Cuanto tarda una nota en bajar desde arriba hasta la linea. */
const CAIDA_S = 1.15;

interface Nota {
  /** Instante exacto (reloj de audio) en que debe tocarse. */
  tiempo: number;
  carril: 0 | 1;
  resuelta: boolean;
  /** Para la animacion de acierto. */
  brillo: number;
  juicio: 'perfecto' | 'bien' | 'fallo' | null;
}

export const META: GameMeta = {
  id: 'ritmo',
  name: 'RITMO',
  tagline: 'Toca al compas. El lado importa.',
  skill: 'ritmo',
  defaultDurationMs: 32_000,
  instructions: [
    'Las notas bajan por dos carriles.',
    'Toca la MITAD de la pantalla del carril justo cuando cruza la linea.',
    'Clavarlo en el compas puntua el doble. Encadenar multiplica.',
  ],
  icon: '♪',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  // Nada que invierta los controles ni que altere el tiempo: en un juego de
  // compas eso no es dificultad, es romperlo.
  supportedMutators: ['double', 'tiny', 'onelife', 'chaos'],
};

class RitmoGame extends BaseMiniGame {
  readonly meta = META;

  private notas: Nota[] = [];
  private desengancharCompas: (() => void) | null = null;
  /** Ultimo paso del compas para el que ya se genero nota. */
  private ultimoPaso = -1;
  private perfectos = 0;
  private buenos = 0;
  /** Texto del ultimo juicio, para pintarlo un momento. */
  private aviso: { texto: string; vida: number; tono: string } | null = null;
  private pulso = 0;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.notas = [];
    this.ultimoPaso = -1;
    this.perfectos = 0;
    this.buenos = 0;
    this.aviso = null;
    this.pulso = 0;
    this.tracksAccuracy = true;
    this.setLives(null);

    this.desengancharCompas?.();
    // Las notas nacen del propio compas de la musica: asi es imposible que se
    // desincronicen de lo que se oye, por definicion.
    this.desengancharCompas = this.services.music.onBeat((beat) => {
      if (this._state !== 'playing') return;
      this.quizaCrearNota(beat.step, beat.time, beat.strong);
    });
  }

  protected override teardown(): void {
    this.desengancharCompas?.();
    this.desengancharCompas = null;
  }

  /**
   * Decide si en ese paso del compas cae nota. La densidad sube con la
   * dificultad del dia, pero las negras siempre pesan mas: el patron tiene
   * que sonar a musica, no a ruido aleatorio.
   */
  private quizaCrearNota(paso: number, tiempo: number, fuerte: boolean): void {
    if (paso === this.ultimoPaso) return;
    this.ultimoPaso = paso;

    const dificultad = this.config.difficulty;
    // Las notas se ven venir: se crean para sonar CAIDA_S mas tarde.
    const cuando = tiempo + CAIDA_S;
    if (cuando > this.audioFin) return;

    let probabilidad: number;
    if (fuerte) probabilidad = 0.85;
    else if (paso % 2 === 0) probabilidad = 0.25 + dificultad * 0.4;
    else probabilidad = dificultad * 0.28;

    if (this.rng.next() > probabilidad) return;

    // El carril cambia lo justo para obligar a mirar, sin volverse errático.
    const anterior = this.notas.length > 0 ? (this.notas[this.notas.length - 1] as Nota).carril : 0;
    const cambia = this.rng.next() < 0.35 + dificultad * 0.2;
    this.notas.push({
      tiempo: cuando,
      carril: (cambia ? 1 - anterior : anterior) as 0 | 1,
      resuelta: false,
      brillo: 0,
      juicio: null,
    });
  }

  /** Instante de audio en que se acaba la partida (para no crear notas de mas). */
  private get audioFin(): number {
    return this.services.music.now + this.timeLeftMs / 1000;
  }

  protected tick(dt: number): void {
    const ahora = this.services.music.now;
    this.pulso = Math.max(0, this.pulso - dt * 3.2);

    if (this.aviso) {
      this.aviso.vida -= dt;
      if (this.aviso.vida <= 0) this.aviso = null;
    }

    // La musica se pone mas intensa cuando la cosa va bien: acompana en vez de
    // sonar plana toda la partida.
    this.services.music.setIntensity(0.45 + Math.min(0.5, this.combo * 0.045));

    if (ahora >= 0) {
      // Notas que se han pasado de largo sin tocar.
      for (const nota of this.notas) {
        if (nota.resuelta) continue;
        if (ahora - nota.tiempo > FALLADA) {
          nota.resuelta = true;
          nota.juicio = 'fallo';
          this.registerMistake();
          this.mostrarAviso('FUERA', '#ff4d6d');
        }
      }
    }

    const toque = this.services.input.pressed;
    if (toque) this.resolverToque(ahora);

    this.notas = this.notas.filter((nota) => !nota.resuelta || nota.brillo > 0);
    for (const nota of this.notas) {
      if (nota.resuelta) nota.brillo = Math.max(0, nota.brillo - dt * 2.6);
    }
  }

  /** Juzga un toque contra la nota mas cercana de ese carril. */
  private resolverToque(ahora: number): void {
    if (ahora < 0) return;
    const carril: 0 | 1 = this.pointerX() < this.width / 2 ? 0 : 1;

    let mejor: Nota | null = null;
    let mejorDesvio = Infinity;
    for (const nota of this.notas) {
      if (nota.resuelta || nota.carril !== carril) continue;
      const desvio = Math.abs(ahora - nota.tiempo);
      if (desvio < mejorDesvio) {
        mejorDesvio = desvio;
        mejor = nota;
      }
    }

    const x = this.width * (carril === 0 ? 0.28 : 0.72);
    const y = this.lineaY;

    if (!mejor || mejorDesvio > BIEN) {
      // Tocar cuando no toca tambien cuesta: si no, la estrategia optima seria
      // aporrear la pantalla.
      this.breakCombo();
      this.misses++;
      this.mistakes++;
      this.services.audio.play('miss');
      this.services.fx.shake(3);
      this.mostrarAviso('NADA', '#63637d');
      return;
    }

    mejor.resuelta = true;
    mejor.brillo = 1;
    this.registerHit();
    const combo = this.bumpCombo();
    const multiplicador = 1 + Math.min(1.5, combo * 0.06);

    if (mejorDesvio <= PERFECTO) {
      mejor.juicio = 'perfecto';
      this.perfectos++;
      this.addScore(120 * multiplicador, x, y);
      this.services.audio.play('combo', combo);
      this.services.haptics.fire('medium');
      this.services.fx.burst(x, y, { color: ACCENT, count: 16, speed: 220, shape: 'chispa' });
      this.services.fx.shockwave(x, y, 96, ACCENT);
      this.pulso = 1;
      this.mostrarAviso('PERFECTO', ACCENT);
    } else {
      mejor.juicio = 'bien';
      this.buenos++;
      this.addScore(55 * multiplicador, x, y);
      this.services.audio.play('hit');
      this.services.haptics.fire('light');
      this.services.fx.burst(x, y, { color: carril === 0 ? LANE_A : LANE_B, count: 8, speed: 150, shape: 'chispa' });
      this.pulso = 0.55;
      this.mostrarAviso('BIEN', carril === 0 ? LANE_A : LANE_B);
    }
  }

  private mostrarAviso(texto: string, tono: string): void {
    this.aviso = { texto, vida: 0.5, tono };
  }

  private get lineaY(): number {
    return this.areaBottom - Math.min(150, this.areaHeight * 0.22);
  }

  protected draw(): void {
    const ctx = this.ctx;
    const ahora = this.services.music.now;

    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, this.width, this.height);
    backdropGrid(ctx, this.width, this.height, hexToRgba(ACCENT, 0.05));

    const linea = this.lineaY;
    const centro = this.width / 2;

    // Separador de carriles.
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centro, this.areaTop);
    ctx.lineTo(centro, this.areaBottom);
    ctx.stroke();

    // La linea de acierto late con la ultima nota clavada.
    const brilloLinea = 0.35 + this.pulso * 0.55;
    ctx.strokeStyle = hexToRgba(ACCENT, brilloLinea);
    ctx.lineWidth = 3 + this.pulso * 4;
    ctx.beginPath();
    ctx.moveTo(0, linea);
    ctx.lineTo(this.width, linea);
    ctx.stroke();

    // Las pastillas de cada carril. Sin esto no hay forma de saber que se toca
    // por lados: en las pruebas con la pantalla delante, la mitad sin notas
    // parecia decoracion y no una zona donde tocar.
    for (const carril of [0, 1] as const) {
      const x = this.width * (carril === 0 ? 0.28 : 0.72);
      const color = carril === 0 ? LANE_A : LANE_B;
      // Se enciende cuando su nota esta a punto de llegar.
      const inminente = this.notas.reduce((mejor, nota) => {
        if (nota.resuelta || nota.carril !== carril || ahora < 0) return mejor;
        const falta = nota.tiempo - ahora;
        if (falta < -FALLADA || falta > 0.45) return mejor;
        return Math.max(mejor, 1 - Math.abs(falta) / 0.45);
      }, 0);

      ctx.strokeStyle = hexToRgba(color, 0.22 + inminente * 0.65);
      ctx.lineWidth = 2 + inminente * 2;
      ctx.beginPath();
      ctx.arc(x, linea, 30, 0, Math.PI * 2);
      ctx.stroke();

      if (inminente > 0) {
        ctx.fillStyle = hexToRgba(color, inminente * 0.16);
        ctx.beginPath();
        ctx.arc(x, linea, 30, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (ahora >= 0) {
      for (const nota of this.notas) {
        const x = this.width * (nota.carril === 0 ? 0.28 : 0.72);
        const color = nota.carril === 0 ? LANE_A : LANE_B;

        if (nota.resuelta) {
          if (nota.brillo > 0 && nota.juicio !== 'fallo') {
            glowCircle(ctx, x, linea, 26 + (1 - nota.brillo) * 34, hexToRgba(color, nota.brillo * 0.55), 26);
          }
          continue;
        }

        // Posicion por TIEMPO, no por velocidad acumulada: asi una caida de
        // frames no descoloca las notas respecto a lo que se oye.
        const restante = nota.tiempo - ahora;
        const t = 1 - restante / CAIDA_S;
        if (t < -0.1) continue;
        const y = this.areaTop + (linea - this.areaTop) * t;
        const cerca = Math.max(0, 1 - Math.abs(restante) / 0.4);

        glowCircle(ctx, x, y, 20 + cerca * 6, color, 14 + cerca * 16);
        if (cerca > 0.2) {
          ctx.strokeStyle = hexToRgba('#ffffff', cerca * 0.5);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 26 + cerca * 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    if (this.aviso) {
      const alpha = Math.min(1, this.aviso.vida * 3);
      label(ctx, this.aviso.texto, centro, linea + 54, {
        size: 20,
        color: hexToRgba(this.aviso.tono, alpha),
        align: 'center',
        weight: 900,
      });
    }

    if (ahora < 0) {
      label(ctx, 'ESPERANDO AL COMPAS...', centro, this.areaTop + this.areaHeight / 2, {
        size: 14,
        color: 'rgba(255,255,255,0.4)',
        align: 'center',
        weight: 800,
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return {
      perfectos: this.perfectos,
      buenos: this.buenos,
      notasFalladas: this.mistakes,
    };
  }

  debugInfo(): Record<string, unknown> {
    // `game` no es decorativo: es por donde el bot de las pruebas decide
    // que estrategia usar. Sin el, playCurrent no sabe a que esta jugando.
    const pendientes = this.notas.filter((n) => !n.resuelta);
    return {
      game: 'ritmo',
      notasVivas: pendientes.length,
      perfectos: this.perfectos,
      buenos: this.buenos,
      relojAudio: Number(this.services.music.now.toFixed(3)),
      compasSonando: this.services.music.playing,
      ventanaPerfecto: PERFECTO,
      // Con esto un bot puede tocar en el instante exacto, que es la unica
      // forma de comprobar automaticamente que el juicio del compas funciona.
      notas: pendientes
        .slice(0, 8)
        .map((n) => ({
          tiempo: Number(n.tiempo.toFixed(3)),
          carril: n.carril,
          x: Math.round(this.width * (n.carril === 0 ? 0.28 : 0.72)),
        })),
      lineaY: Math.round(this.lineaY),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new RitmoGame(services, config),
};
