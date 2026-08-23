/**
 * CONTRATO DE MINIJUEGO DE PLAYZONE
 * =================================
 *
 * El shell no sabe nada de ningun juego concreto. Solo sabe decir:
 *
 *     "carga el juego X con esta semilla, esta duracion y estos mutadores"
 *
 * y recoger al final un GameResult. Cualquier minijuego (incluidos los
 * PLAYZONE 001..00N que viven en sus propios repositorios) puede entrar en
 * RUSH implementando este contrato, sin tocar el shell.
 *
 * Un juego nuevo solo necesita exportar un GameDefinition:
 *
 *     export const definition: GameDefinition = {
 *       meta: { ... },
 *       create: (services, config) => new MiJuego(services, config),
 *     };
 *
 * y registrarse en games/index.ts. Nada mas.
 */
import type { Emitter } from '../core/emitter';
import type { AudioBus } from '../core/audio';
import type { MusicEngine } from '../core/music';
import type { FxSystem } from '../core/fx';
import type { Haptics } from '../core/haptics';
import type { InputManager } from '../core/input';
import type { MutatorState } from './mutators';

export type GameState = 'idle' | 'ready' | 'playing' | 'paused' | 'finished' | 'destroyed';

export type SkillKind = 'reflejos' | 'supervivencia' | 'precision' | 'memoria' | 'ritmo';

export type EndReason = 'time' | 'death' | 'aborted';

/** Ficha del juego: lo que la UI necesita para presentarlo. */
export interface GameMeta {
  id: string;
  name: string;
  /** Descripcion corta, una linea. */
  tagline: string;
  skill: SkillKind;
  /** Duracion por defecto en ms (el reto diario puede cambiarla). */
  defaultDurationMs: number;
  /** Instrucciones, una idea por linea. */
  instructions: string[];
  /** Icono provisional (glifo). Sustituible por SVG/sprite sin tocar el shell. */
  icon: string;
  /** Color de acento del juego. */
  accent: string;
  /** Si soporta marca fantasma de un rival. */
  supportsGhost: boolean;
  /** Etiqueta para su unidad de puntuacion. */
  scoreLabel: string;
  /**
   * Mutadores que este juego entiende. El shell no ofrecera los demas: no
   * tiene sentido poner GRAVEDAD X2 en un juego sin inercia. Si se omite, se
   * asume que valen todos (comportamiento de los juegos originales).
   */
  supportedMutators?: string[];
}

/**
 * Marca del intento de un rival.
 *
 * `value` siempre esta (hasta donde llego), y cuando el rival tiene traza
 * grabada llegan ademas las muestras para poder dibujar su nave corriendo a
 * tu lado. Si no hay traza, el juego cae al modo antiguo de marca a distancia.
 */
export interface GhostData {
  rivalId: string;
  rivalName: string;
  /** 'time' = sobrevivio X ms; 'score' = llego a X puntos. */
  kind: 'time' | 'score';
  value: number;
  score: number;
  /** Posiciones normalizadas 0..1, una cada `sampleMs`. */
  samples?: number[];
  sampleMs?: number;
}

/** Condiciones exactas de una partida. Mismo config = misma partida. */
export interface GameConfig {
  seed: string;
  durationMs: number;
  /** 0..1, la sube la rotacion diaria. */
  difficulty: number;
  mutators: MutatorState;
  /** Ids de los mutadores activos (para mostrarlos y guardarlos). */
  mutatorIds: string[];
  ghost: GhostData | null;
  /** Marca a batir, si la hay (se pinta en el HUD). */
  targetScore: number | null;
  targetName: string | null;
}

/** Franjas de pantalla ocupadas por el HUD del shell. Los juegos no deben
 *  poner nada importante ahi. El host las mide y las mantiene al dia. */
export interface ScreenInsets {
  top: number;
  bottom: number;
}

/** Lo que el host presta a cada minijuego. */
export interface GameServices {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Tamano logico en pixeles CSS (el host ya ha aplicado el DPR). */
  width: number;
  height: number;
  /** Zona util: lo que queda entre el HUD de arriba y el de abajo. */
  insets: ScreenInsets;
  input: InputManager;
  audio: AudioBus;
  /**
   * Musica de la partida. La mayoria de juegos no la tocan (el host ya pone
   * el tema que toca), pero un juego de ritmo la necesita para juzgar los
   * toques contra el compas de verdad.
   */
  music: MusicEngine;
  haptics: Haptics;
  fx: FxSystem;
}

export interface GameEvents extends Record<string, unknown> {
  score: { score: number; delta: number; x: number; y: number; combo: number };
  combo: { combo: number; best: number };
  mistake: { mistakes: number; livesLeft: number };
  ghost: { passed: boolean; label: string };
  milestone: { text: string; tone: 'good' | 'bad' };
  state: { state: GameState };
  finish: { result: GameResult };
}

/** Lo que el shell recibe al terminar. */
export interface GameResult {
  gameId: string;
  seed: string;
  score: number;
  /** Tiempo realmente jugado. */
  durationMs: number;
  /** 0..1, o null si el juego no tiene concepto de punteria. */
  accuracy: number | null;
  bestCombo: number;
  mistakes: number;
  mutatorIds: string[];
  endedBy: EndReason;
  /** Metricas propias del juego (ms sobrevividos, aciertos perfectos...). */
  metrics: Record<string, number>;
}

/** Lo que el HUD del shell pinta encima del canvas. */
export interface HudInfo {
  score: number;
  timeLeftMs: number;
  totalMs: number;
  combo: number;
  lives: number | null;
  maxLives: number | null;
  /** 0..1 de progreso hacia la marca del fantasma, si aplica. */
  ghostProgress: number | null;
  ghostLabel: string | null;
}

export interface MiniGame {
  readonly meta: GameMeta;
  readonly config: GameConfig;
  readonly state: GameState;
  readonly score: number;
  readonly events: Emitter<GameEvents>;

  /** Ciclo de vida. */
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;

  /** Lo llama el host cada frame. dt en segundos. */
  update(dt: number): void;
  render(): void;

  /** Reajuste de tamano (rotacion de pantalla, teclado que aparece...). */
  resize(width: number, height: number): void;

  hud(): HudInfo;
  /** null mientras no haya terminado. */
  getResult(): GameResult | null;

  /**
   * Traza de la partida para el fantasma. Opcional: solo la implementan los
   * juegos donde tiene sentido ver al rival avanzando (de momento, DRIFT).
   */
  recording?(): { sampleMs: number; samples: number[] } | null;

  /**
   * Estado interno para herramientas de desarrollo (panel de debug, pruebas
   * automatizadas). Opcional: ningun juego esta obligado a exponerlo, y nada
   * del producto depende de el.
   */
  debugInfo?(): Record<string, unknown>;
}

export type MiniGameFactory = (services: GameServices, config: GameConfig) => MiniGame;

export interface GameDefinition {
  meta: GameMeta;
  create: MiniGameFactory;
}
