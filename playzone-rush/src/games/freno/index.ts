/**
 * FRENO - control inhibitorio.
 *
 * Aparecen fichas de dos colores y dos formas, y una regla arriba dice cuales
 * tocar. Hasta ahi es facil. La gracia es que LA REGLA CAMBIA a mitad de
 * partida, y entonces hay que frenar un reflejo que acabas de entrenar.
 *
 * Habilidad que mide: inhibicion. Es lo contrario de PULSE: alli gana quien
 * reacciona antes, aqui gana quien sabe NO reaccionar. Los primeros segundos
 * tras un cambio de regla son donde se decide la partida, y donde todo el
 * mundo falla al menos una vez.
 *
 * Hay reglas en negativo ("NO TOQUES LOS ROSAS") a proposito: obligan a leer y
 * traducir en vez de reconocer una forma de memoria, que es justo el musculo
 * que este juego quiere apretar.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropGrid, glowCircle, hexToRgba, label, roundRect } from '../../game/draw';

const ACCENT = '#ffd23f';
const AZUL = '#22d3ee';
const ROSA = '#ff2f6d';

/** Cada cuanto cambia la regla, en segundos. */
const CAMBIO_MIN = 5.5;
const CAMBIO_MAX = 8;
/** Aviso previo al cambio: sin el seria injusto, no dificil. */
const AVISO_S = 1.1;

type Color = 'azul' | 'rosa';
type Forma = 'circulo' | 'cuadro';

interface Ficha {
  x: number;
  y: number;
  radio: number;
  color: Color;
  forma: Forma;
  vida: number;
  maxVida: number;
  /** Animacion al resolverse. */
  pop: number;
  resuelta: boolean;
}

interface Regla {
  texto: string;
  /** Devuelve true si esa ficha SE DEBE tocar. */
  vale: (f: Ficha) => boolean;
}

export const META: GameMeta = {
  id: 'freno',
  name: 'FRENO',
  tagline: 'Toca solo lo que diga la regla. La regla cambia.',
  skill: 'inhibicion',
  defaultDurationMs: 33_000,
  instructions: [
    'Arriba pone que fichas tocar. Toca solo esas.',
    'Ojo: la regla CAMBIA cada pocos segundos, y avisa antes.',
    'Tocar lo que no toca quita mas de lo que suma acertar.',
  ],
  icon: '✋',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  // Nada que tape la pantalla ni invierta controles: la regla hay que poder
  // leerla, y el juego entero va de eso.
  supportedMutators: ['double', 'sprint', 'onelife', 'chaos', 'tiny'],
};

/** Las reglas posibles. Mitad en positivo, mitad en negativo. */
function reglas(): Regla[] {
  return [
    { texto: 'TOCA LOS AZULES', vale: (f) => f.color === 'azul' },
    { texto: 'TOCA LOS ROSAS', vale: (f) => f.color === 'rosa' },
    { texto: 'TOCA LOS CIRCULOS', vale: (f) => f.forma === 'circulo' },
    { texto: 'TOCA LOS CUADRADOS', vale: (f) => f.forma === 'cuadro' },
    { texto: 'NO TOQUES LOS AZULES', vale: (f) => f.color !== 'azul' },
    { texto: 'NO TOQUES LOS ROSAS', vale: (f) => f.color !== 'rosa' },
    { texto: 'NO TOQUES LOS CIRCULOS', vale: (f) => f.forma !== 'circulo' },
    { texto: 'NO TOQUES LOS CUADRADOS', vale: (f) => f.forma !== 'cuadro' },
  ];
}

class FrenoGame extends BaseMiniGame {
  readonly meta = META;

  private fichas: Ficha[] = [];
  private catalogo: Regla[] = [];
  private regla!: Regla;
  private siguienteRegla: Regla | null = null;
  private tiempoCambio = 0;
  private aparicion = 0;
  private cambios = 0;
  /** Fallos cometidos en los 2 s siguientes a un cambio: la metrica del juego. */
  private fallosTrasCambio = 0;
  private ultimoCambioEn = -99;
  private aviso: { texto: string; vida: number; tono: string } | null = null;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.fichas = [];
    this.catalogo = reglas();
    this.regla = this.catalogo[this.rng.int(0, 3)] as Regla; // se empieza en positivo
    this.siguienteRegla = null;
    this.tiempoCambio = this.rng.range(CAMBIO_MIN, CAMBIO_MAX);
    this.aparicion = 0;
    this.cambios = 0;
    this.fallosTrasCambio = 0;
    this.ultimoCambioEn = -99;
    this.aviso = null;
    this.tracksAccuracy = true;
    this.setLives(null);
  }

  private get ritmo(): number {
    // Aparecen mas deprisa segun avanza la partida y sube la dificultad.
    return 0.72 - this.config.difficulty * 0.22 - this.progress * 0.16;
  }

  protected tick(dt: number): void {
    if (this.aviso) {
      this.aviso.vida -= dt;
      if (this.aviso.vida <= 0) this.aviso = null;
    }

    this.tiempoCambio -= dt;

    // Aviso previo: se ensena la regla que viene antes de que entre en vigor.
    // Sin esto el cambio seria una trampa, no un reto: el jugador tiene que
    // poder prepararse y aun asi le va a costar.
    if (this.tiempoCambio <= AVISO_S && !this.siguienteRegla) {
      this.siguienteRegla = this.eligeOtraRegla();
      this.services.audio.play('countdown');
    }
    if (this.tiempoCambio <= 0 && this.siguienteRegla) {
      this.regla = this.siguienteRegla;
      this.siguienteRegla = null;
      this.cambios++;
      this.ultimoCambioEn = this.elapsedSeconds;
      this.tiempoCambio = this.rng.range(CAMBIO_MIN, CAMBIO_MAX);
      this.services.audio.play('unlock');
      this.services.haptics.fire('medium');
      this.services.fx.flash(ACCENT, 0.12);
      this.aviso = { texto: 'REGLA NUEVA', vida: 0.8, tono: ACCENT };
    }

    // Aparicion de fichas.
    this.aparicion -= dt;
    if (this.aparicion <= 0) {
      this.aparicion = this.ritmo;
      this.crearFicha();
    }

    for (let i = this.fichas.length - 1; i >= 0; i--) {
      const f = this.fichas[i] as Ficha;
      if (f.resuelta) {
        f.pop -= dt * 3;
        if (f.pop <= 0) this.fichas.splice(i, 1);
        continue;
      }
      f.vida -= dt;
      if (f.vida <= 0) {
        // Dejar pasar una que habia que tocar es fallo; dejar pasar una que no
        // habia que tocar es lo correcto y no cuesta nada.
        if (this.regla.vale(f)) {
          this.registrarFallo(f, 'SE TE HA IDO');
        }
        this.fichas.splice(i, 1);
      }
    }

    if (this.services.input.pressed) this.resolverToque();
  }

  private eligeOtraRegla(): Regla {
    let candidata = this.regla;
    for (let i = 0; i < 8 && candidata.texto === this.regla.texto; i++) {
      candidata = this.catalogo[this.rng.int(0, this.catalogo.length - 1)] as Regla;
    }
    return candidata;
  }

  private crearFicha(): void {
    const margen = 54;
    const radio = 30 + this.rng.next() * 8;
    const f: Ficha = {
      x: margen + this.rng.next() * (this.width - margen * 2),
      y: this.areaTop + margen + this.rng.next() * (this.areaHeight - margen * 2),
      radio,
      color: this.rng.next() < 0.5 ? 'azul' : 'rosa',
      forma: this.rng.next() < 0.5 ? 'circulo' : 'cuadro',
      vida: 1.5 - this.config.difficulty * 0.35,
      maxVida: 1.5 - this.config.difficulty * 0.35,
      pop: 0,
      resuelta: false,
    };
    this.fichas.push(f);
    if (this.fichas.length > 7) this.fichas.shift();
  }

  private resolverToque(): void {
    const x = this.pointerX();
    const y = this.pointerY();
    const tocada = this.fichas.find(
      (f) => !f.resuelta && Math.hypot(x - f.x, y - f.y) < f.radio * 1.15,
    );
    if (!tocada) return;

    tocada.resuelta = true;
    tocada.pop = 1;

    if (this.regla.vale(tocada)) {
      this.registerHit();
      const combo = this.bumpCombo();
      this.addScore(90 * (1 + Math.min(1.4, combo * 0.07)), tocada.x, tocada.y);
      this.services.audio.play('hit');
      this.services.haptics.fire('light');
      this.services.fx.burst(tocada.x, tocada.y, {
        color: tocada.color === 'azul' ? AZUL : ROSA,
        count: 10,
        speed: 200,
        shape: 'circulo',
      });
    } else {
      this.registrarFallo(tocada, 'ESA NO');
    }
  }

  private registrarFallo(f: Ficha, texto: string): void {
    // Un fallo cuesta mas que lo que suma un acierto: si no, la estrategia
    // ganadora seria tocarlo todo y comerse las penalizaciones.
    this.registerMistake(140);
    this.services.audio.play('error');
    this.services.haptics.fire('error');
    this.services.fx.shake(5);
    this.services.fx.burst(f.x, f.y, { color: '#ff4d6d', count: 12, speed: 240, shape: 'chispa' });
    this.aviso = { texto, vida: 0.6, tono: '#ff4d6d' };
    if (this.elapsedSeconds - this.ultimoCambioEn < 2) this.fallosTrasCambio++;
  }

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, this.width, this.height);
    backdropGrid(ctx, this.width, this.height, hexToRgba(ACCENT, 0.05));

    for (const f of this.fichas) {
      const color = f.color === 'azul' ? AZUL : ROSA;
      const t = f.resuelta ? f.pop : f.vida / f.maxVida;
      const escala = f.resuelta ? 1 + (1 - f.pop) * 0.5 : 1;
      const alpha = f.resuelta ? Math.max(0, f.pop) : 0.35 + t * 0.65;
      const r = f.radio * escala;

      if (f.forma === 'circulo') {
        glowCircle(ctx, f.x, f.y, r, hexToRgba(color, alpha), 20);
      } else {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = hexToRgba(color, alpha);
        roundRect(ctx, f.x - r, f.y - r, r * 2, r * 2, 9);
        ctx.fill();
        ctx.restore();
      }

      // Aro de tiempo: cuanto le queda antes de irse.
      if (!f.resuelta) {
        ctx.strokeStyle = hexToRgba('#ffffff', 0.3);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radio + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
        ctx.stroke();
      }
    }

    // La regla, arriba y grande: es lo mas importante de la pantalla.
    const cambiando = this.siguienteRegla !== null;
    const y = this.areaTop + 26;
    label(ctx, this.regla.texto, this.width / 2, y, {
      size: 19,
      color: cambiando ? hexToRgba('#ffffff', 0.35) : '#ffffff',
      weight: 900,
    });

    if (this.siguienteRegla) {
      // Parpadeo del aviso: llama la atencion sin taparlo todo.
      const late = 0.55 + Math.abs(Math.sin(this.elapsedSeconds * 9)) * 0.45;
      label(ctx, `AHORA: ${this.siguienteRegla.texto}`, this.width / 2, y + 26, {
        size: 15,
        color: hexToRgba(ACCENT, late),
        weight: 900,
      });
    }

    if (this.aviso) {
      const alpha = Math.min(1, this.aviso.vida * 2.6);
      label(ctx, this.aviso.texto, this.width / 2, this.areaBottom - 34, {
        size: 21,
        color: hexToRgba(this.aviso.tono, alpha),
        weight: 900,
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return {
      cambiosDeRegla: this.cambios,
      fallosTrasCambio: this.fallosTrasCambio,
    };
  }

  debugInfo(): Record<string, unknown> {
    // `game` no es decorativo: es por donde el bot de las pruebas decide
    // que estrategia usar. Sin el, playCurrent no sabe a que esta jugando.
    return {
      game: 'freno',
      regla: this.regla.texto,
      cambiando: this.siguienteRegla?.texto ?? null,
      cambios: this.cambios,
      fallosTrasCambio: this.fallosTrasCambio,
      // Con `vale` resuelto para que el bot no tenga que interpretar el texto.
      fichas: this.fichas
        .filter((f) => !f.resuelta)
        .map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), vale: this.regla.vale(f) })),
    };
  }
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new FrenoGame(services, config),
};
