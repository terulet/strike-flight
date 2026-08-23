/**
 * TRAZO - gesto.
 *
 * Aparece una figura y hay que recorrerla con el dedo sin levantarlo, pasando
 * por sus puntos EN ORDEN. Cuanto mas te ajustas a la linea, mas puntos.
 *
 * Habilidad que mide: control motor continuo. Es lo contrario de todo lo demas
 * del juego: aqui no se toca, se arrastra, y no se gana por ser rapido sino
 * por tener buen pulso. En un movil es el gesto mas natural que hay y no lo
 * estabamos usando en ningun sitio.
 *
 * La figura se genera con la semilla del dia, asi que todo el grupo traza
 * exactamente las mismas y la comparacion es justa.
 */
import { BaseMiniGame } from '../../game/base';
import type { GameDefinition, GameMeta, GameServices, GameConfig } from '../../game/contract';
import { backdropBlueprint, glowCircle, hexToRgba, label } from '../../game/draw';

const ACCENT = '#a78bfa';
const HECHO = '#7cf3c0';

/** Distancia (en fraccion del lado corto) para dar un punto por alcanzado. */
const RADIO_PUNTO = 0.085;
/** A partir de aqui el trazo se considera desviado y baja la precision. */
const RADIO_LIMPIO = 0.055;

interface Punto {
  x: number;
  y: number;
  alcanzado: boolean;
}

interface Figura {
  nombre: string;
  puntos: Punto[];
  cerrada: boolean;
}

export const META: GameMeta = {
  id: 'trazo',
  name: 'TRAZO',
  tagline: 'Recorre la figura sin levantar el dedo.',
  skill: 'trazo',
  defaultDurationMs: 34_000,
  instructions: [
    'Arrastra el dedo por la figura, en orden, sin levantarlo.',
    'Cuanto mas pegado a la linea, mas precision y mas puntos.',
    'Al completarla aparece otra mas dificil.',
  ],
  icon: '✎',
  accent: ACCENT,
  supportsGhost: false,
  scoreLabel: 'PTS',
  // Invertir los controles aqui no es dificil, es imposible de leer.
  supportedMutators: ['double', 'sprint', 'onelife', 'chaos', 'blackout'],
};

class TrazoGame extends BaseMiniGame {
  readonly meta = META;

  private figura: Figura | null = null;
  private siguiente = 0;
  /** Rastro del dedo, para pintarlo. */
  private rastro: { x: number; y: number }[] = [];
  private figurasHechas = 0;
  private desvios = 0;
  /** Muestras de precision del trazo actual: fraccion pegada a la linea. */
  private limpias = 0;
  private muestras = 0;
  private aviso: { texto: string; vida: number; tono: string } | null = null;

  constructor(services: GameServices, config: GameConfig) {
    super(services, config);
  }

  protected setup(): void {
    this.figurasHechas = 0;
    this.desvios = 0;
    this.limpias = 0;
    this.muestras = 0;
    this.rastro = [];
    this.aviso = null;
    this.tracksAccuracy = true;
    this.setLives(null);
    this.nuevaFigura();
  }

  /** Lado corto: todas las distancias se miden en fraccion de esto. */
  private get escala(): number {
    return Math.min(this.width, this.areaHeight);
  }

  private nuevaFigura(): void {
    // La dificultad sube con las figuras hechas, no solo con la del dia: quien
    // va bien se encuentra figuras mas duras dentro de la misma partida.
    const nivel = this.config.difficulty + this.figurasHechas * 0.09;
    this.figura = generarFigura(this.rng, Math.min(1, nivel));
    this.siguiente = 0;
    this.limpias = 0;
    this.muestras = 0;
    this.rastro = [];
  }

  /** Coordenadas de pantalla de un punto normalizado. */
  private aPantalla(p: { x: number; y: number }): { x: number; y: number } {
    const lado = this.escala * 0.78;
    const cx = this.width / 2;
    const cy = this.areaTop + this.areaHeight / 2;
    return { x: cx + (p.x - 0.5) * lado, y: cy + (p.y - 0.5) * lado };
  }

  protected tick(dt: number): void {
    if (this.aviso) {
      this.aviso.vida -= dt;
      if (this.aviso.vida <= 0) this.aviso = null;
    }

    const input = this.services.input;
    const figura = this.figura;
    if (!figura) return;

    if (input.pressed) this.rastro = [];
    if (!input.down) return;

    const x = this.pointerX();
    const y = this.pointerY();
    this.rastro.push({ x, y });
    if (this.rastro.length > 90) this.rastro.shift();
    // Estela cada pocos puntos: una por frame saturaria el tope de la capa
    // de efectos y no se veria mejor.
    if (this.rastro.length % 6 === 0 && this.rastro.length > 6) {
      this.services.fx.trail(this.rastro.slice(-14), ACCENT, 6, 0.35);
    }

    const objetivo = figura.puntos[this.siguiente];
    if (!objetivo) return;
    const destino = this.aPantalla(objetivo);
    const dist = Math.hypot(x - destino.x, y - destino.y) / this.escala;

    // Precision: se mide contra el SEGMENTO que toca recorrer, no contra el
    // punto. Medir contra el punto premiaria ir en linea recta saltandose la
    // forma, que es justo lo que no queremos.
    // Doble contabilidad a proposito: `limpias/muestras` se reinicia con cada
    // figura (alimenta el premio por figura), mientras que hits/misses se
    // acumula en toda la partida y es lo que acaba siendo la precision del
    // resultado. Contar figuras completadas como acierto daba siempre 100%,
    // porque en este juego no se puede fallar una figura: o la acabas o se
    // acaba el tiempo.
    this.muestras++;
    const pegado = this.distanciaAlSegmento(x, y) < RADIO_LIMPIO;
    if (pegado) {
      this.limpias++;
      this.hits++;
    } else {
      this.desvios++;
      this.misses++;
    }

    if (dist < RADIO_PUNTO) {
      objetivo.alcanzado = true;
      this.siguiente++;
      this.services.audio.play('tap');
      this.services.haptics.fire('tick');
      this.services.fx.burst(destino.x, destino.y, { color: HECHO, count: 6, speed: 120, shape: 'circulo' });

      if (this.siguiente >= figura.puntos.length) this.completar();
    }
  }

  /** Distancia normalizada del dedo al tramo que esta recorriendo. */
  private distanciaAlSegmento(x: number, y: number): number {
    const figura = this.figura;
    if (!figura) return 1;
    const desde = figura.puntos[Math.max(0, this.siguiente - 1)];
    const hasta = figura.puntos[this.siguiente];
    if (!desde || !hasta) return 1;
    const a = this.aPantalla(desde);
    const b = this.aPantalla(hasta);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const largo2 = dx * dx + dy * dy;
    if (largo2 === 0) return Math.hypot(x - a.x, y - a.y) / this.escala;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / largo2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) / this.escala;
  }

  private completar(): void {
    const precision = this.muestras > 0 ? this.limpias / this.muestras : 0;
    this.figurasHechas++;
    const combo = this.bumpCombo();

    // Base por completar, mas premio fuerte por hacerlo limpio: aqui la gracia
    // es el pulso, no acabar de cualquier manera.
    const base = 260;
    const extra = Math.round(precision * 340);
    const multiplicador = 1 + Math.min(1.2, combo * 0.08);
    const centro = { x: this.width / 2, y: this.areaTop + this.areaHeight / 2 };
    this.addScore((base + extra) * multiplicador, centro.x, centro.y);

    if (precision > 0.85) {
      this.aviso = { texto: 'PULSO PERFECTO', vida: 0.9, tono: HECHO };
      this.services.audio.play('record');
      this.services.haptics.fire('success');
      this.services.fx.flash(HECHO, 0.16);
      this.services.fx.shockwave(centro.x, centro.y, this.escala * 0.62, HECHO);
    } else {
      this.aviso = { texto: `${Math.round(precision * 100)}% LIMPIO`, vida: 0.8, tono: ACCENT };
      this.services.audio.play('score');
      this.services.haptics.fire('light');
    }
    this.services.fx.burst(centro.x, centro.y, { color: ACCENT, count: 18, speed: 240, shape: 'circulo' });

    this.nuevaFigura();
  }

  protected draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, this.width, this.height);
    backdropBlueprint(ctx, this.width, this.height, ACCENT);

    const figura = this.figura;
    if (!figura) return;

    // La linea a seguir.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = hexToRgba(ACCENT, 0.22);
    ctx.lineWidth = Math.max(10, this.escala * 0.035);
    ctx.beginPath();
    figura.puntos.forEach((p, i) => {
      const s = this.aPantalla(p);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();

    // El tramo ya recorrido, encendido.
    if (this.siguiente > 0) {
      ctx.strokeStyle = hexToRgba(HECHO, 0.75);
      ctx.lineWidth = Math.max(6, this.escala * 0.02);
      ctx.beginPath();
      for (let i = 0; i < this.siguiente && i < figura.puntos.length; i++) {
        const s = this.aPantalla(figura.puntos[i] as Punto);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
    }

    // Rastro del dedo. Se pinta aqui el tramo reciente (nitido) y la capa de
    // efectos lleva la estela que se apaga: junta, la mano se ve "dejando"
    // linea en vez de solo estar encima de ella.
    if (this.rastro.length > 1) {
      ctx.strokeStyle = hexToRgba('#ffffff', 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      this.rastro.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }

    // Los puntos: hecho, siguiente (latiendo) y pendientes.
    figura.puntos.forEach((p, i) => {
      const s = this.aPantalla(p);
      if (i < this.siguiente) {
        glowCircle(ctx, s.x, s.y, 7, HECHO, 12);
      } else if (i === this.siguiente) {
        const late = 1 + Math.sin(this.elapsedSeconds * 7) * 0.18;
        glowCircle(ctx, s.x, s.y, 11 * late, ACCENT, 24);
        ctx.strokeStyle = hexToRgba('#ffffff', 0.55);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.escala * RADIO_PUNTO, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = hexToRgba('#ffffff', 0.28);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // El primer punto lleva marca de salida: si no, no se sabe por donde empezar.
    if (this.siguiente === 0) {
      const s = this.aPantalla(figura.puntos[0] as Punto);
      label(ctx, 'EMPIEZA AQUI', s.x, s.y - this.escala * 0.11, {
        size: 12,
        color: hexToRgba('#ffffff', 0.65),
        weight: 900,
      });
    }

    label(ctx, figura.nombre, this.width / 2, this.areaTop + 22, {
      size: 13,
      color: hexToRgba(ACCENT, 0.75),
      weight: 900,
    });

    if (this.aviso) {
      const alpha = Math.min(1, this.aviso.vida * 2.5);
      label(ctx, this.aviso.texto, this.width / 2, this.areaBottom - 40, {
        size: 20,
        color: hexToRgba(this.aviso.tono, alpha),
        weight: 900,
      });
    }
  }

  protected override metrics(): Record<string, number> {
    return {
      figuras: this.figurasHechas,
      desvios: this.desvios,
    };
  }

  debugInfo(): Record<string, unknown> {
    // `game` no es decorativo: es por donde el bot de las pruebas decide
    // que estrategia usar. Sin el, playCurrent no sabe a que esta jugando.
    const figura = this.figura;
    return {
      game: 'trazo',
      figura: figura?.nombre ?? null,
      siguiente: this.siguiente,
      total: figura?.puntos.length ?? 0,
      figurasHechas: this.figurasHechas,
      // En pantalla, para que un bot pueda trazarla.
      puntos: figura?.puntos.map((p) => this.aPantalla(p)) ?? [],
    };
  }
}

/* ------------------------------------------------------------------ */
/* Figuras                                                             */
/* ------------------------------------------------------------------ */

interface RngLike {
  next(): number;
  int(min: number, max: number): number;
}

/**
 * Genera una figura en coordenadas 0..1. Las formas son reconocibles a
 * proposito: una figura aleatoria seria igual de dificil pero no se recordaria
 * ni se comentaria, y aqui la gracia es decir "me ha salido la estrella".
 */
export function generarFigura(rng: RngLike, dificultad: number): Figura {
  const tipos = ['triangulo', 'cuadrado', 'estrella', 'zigzag', 'espiral', 'rombo'] as const;
  // Las formas duras solo aparecen cuando la dificultad da para ello.
  const disponibles = dificultad < 0.35 ? tipos.slice(0, 3) : tipos;
  const tipo = disponibles[rng.int(0, disponibles.length - 1)] as (typeof tipos)[number];

  const puntos: { x: number; y: number }[] = [];
  const centro = { x: 0.5, y: 0.5 };
  const radio = 0.42;

  switch (tipo) {
    case 'triangulo':
    case 'cuadrado':
    case 'rombo': {
      const lados = tipo === 'triangulo' ? 3 : 4;
      // Con cuatro lados el giro decide la figura, y estaba al reves: partir de
      // -90 grados pone un vertice arriba (rombo) y partir de 45 deja los lados
      // horizontales y verticales (cuadrado). Salia un cuadrado con el rotulo
      // ROMBO, que solo se ve mirando la pantalla.
      const giro = tipo === 'cuadrado' ? Math.PI / 4 : -Math.PI / 2;
      for (let i = 0; i <= lados; i++) {
        const a = giro + (i / lados) * Math.PI * 2;
        puntos.push({ x: centro.x + Math.cos(a) * radio, y: centro.y + Math.sin(a) * radio });
      }
      break;
    }
    case 'estrella': {
      const picos = 5;
      for (let i = 0; i <= picos * 2; i++) {
        const a = -Math.PI / 2 + (i / (picos * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? radio : radio * 0.45;
        puntos.push({ x: centro.x + Math.cos(a) * r, y: centro.y + Math.sin(a) * r });
      }
      break;
    }
    case 'zigzag': {
      const tramos = 4 + Math.round(dificultad * 3);
      for (let i = 0; i <= tramos; i++) {
        puntos.push({
          x: 0.12 + (i / tramos) * 0.76,
          y: i % 2 === 0 ? 0.24 : 0.76,
        });
      }
      break;
    }
    case 'espiral': {
      const vueltas = 1.6 + dificultad * 0.8;
      const pasos = 9 + Math.round(dificultad * 4);
      for (let i = 0; i <= pasos; i++) {
        const t = i / pasos;
        const a = t * Math.PI * 2 * vueltas;
        const r = radio * (0.18 + t * 0.82);
        puntos.push({ x: centro.x + Math.cos(a) * r, y: centro.y + Math.sin(a) * r });
      }
      break;
    }
  }

  const nombres: Record<string, string> = {
    triangulo: 'TRIANGULO',
    cuadrado: 'CUADRADO',
    rombo: 'ROMBO',
    estrella: 'ESTRELLA',
    zigzag: 'ZIGZAG',
    espiral: 'ESPIRAL',
  };

  return {
    nombre: nombres[tipo] ?? tipo.toUpperCase(),
    cerrada: tipo !== 'zigzag' && tipo !== 'espiral',
    puntos: puntos.map((p) => ({ x: p.x, y: p.y, alcanzado: false })),
  };
}

export const definition: GameDefinition = {
  meta: META,
  create: (services, config) => new TrazoGame(services, config),
};
