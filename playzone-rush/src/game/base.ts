/**
 * Clase base con toda la fontaneria del contrato: maquina de estados, reloj,
 * puntuacion (con multiplicador de mutadores), combo, vidas, punteria y
 * construccion del GameResult.
 *
 * Un minijuego nuevo solo implementa setup() / tick() / draw(). El resto
 * -pausa, revancha instantanea, resultado, eventos- ya funciona.
 */
import { Emitter } from '../core/emitter';
import { Rng } from '../core/rng';
import type {
  EndReason,
  GameConfig,
  GameEvents,
  GameMeta,
  GameResult,
  GameServices,
  GameState,
  HudInfo,
  MiniGame,
} from './contract';

export abstract class BaseMiniGame implements MiniGame {
  abstract readonly meta: GameMeta;
  readonly events = new Emitter<GameEvents>();
  readonly config: GameConfig;

  protected services: GameServices;
  protected rng: Rng;
  protected width: number;
  protected height: number;

  /** Puntuacion visible (ya multiplicada). */
  protected _score = 0;
  protected _state: GameState = 'idle';
  protected elapsedMs = 0;
  protected combo = 0;
  protected bestCombo = 0;
  protected mistakes = 0;
  protected hits = 0;
  protected misses = 0;
  protected lives: number | null = null;
  protected maxLives: number | null = null;
  /** Los juegos sin concepto de punteria lo dejan en false. */
  protected tracksAccuracy = false;
  protected ghostPassed = false;

  private result: GameResult | null = null;

  constructor(services: GameServices, config: GameConfig) {
    this.services = services;
    this.config = config;
    this.width = services.width;
    this.height = services.height;
    this.rng = new Rng(config.seed);
  }

  /* --------------------------------------------------------------- */
  /* API del contrato                                                 */
  /* --------------------------------------------------------------- */

  get state(): GameState {
    return this._state;
  }

  get score(): number {
    return this._score;
  }

  get ctx(): CanvasRenderingContext2D {
    return this.services.ctx;
  }

  start(): void {
    if (this._state === 'destroyed') return;
    this.reset();
    this.setState('playing');
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this.setState('paused');
  }

  resume(): void {
    if (this._state !== 'paused') return;
    this.setState('playing');
  }

  /** Revancha instantanea: misma configuracion, estado limpio, sin menus. */
  restart(): void {
    if (this._state === 'destroyed') return;
    this.start();
  }

  destroy(): void {
    if (this._state === 'destroyed') return;
    this.teardown();
    this.events.clear();
    this.setState('destroyed');
  }

  update(dt: number): void {
    if (this._state !== 'playing') return;
    this.elapsedMs += dt * 1000;
    this.tick(dt);
    if (this._state === 'playing' && this.elapsedMs >= this.config.durationMs) {
      this.elapsedMs = this.config.durationMs;
      this.finish('time');
    }
  }

  render(): void {
    this.draw();
  }

  resize(width: number, height: number): void {
    const prevW = this.width;
    const prevH = this.height;
    this.width = width;
    this.height = height;
    this.onResize(prevW, prevH);
  }

  hud(): HudInfo {
    return {
      score: Math.round(this._score),
      timeLeftMs: this.timeLeftMs,
      totalMs: this.config.durationMs,
      combo: this.combo,
      lives: this.lives,
      maxLives: this.maxLives,
      ghostProgress: this.ghostProgress(),
      ghostLabel: this.config.ghost
        ? `${this.config.ghost.rivalName} ${this.formatGhostValue(this.config.ghost)}`
        : null,
    };
  }

  getResult(): GameResult | null {
    return this.result;
  }

  /* --------------------------------------------------------------- */
  /* Utilidades para los juegos                                       */
  /* --------------------------------------------------------------- */

  get timeLeftMs(): number {
    return Math.max(0, this.config.durationMs - this.elapsedMs);
  }

  get elapsedSeconds(): number {
    return this.elapsedMs / 1000;
  }

  /** Progreso 0..1 de la partida. */
  get progress(): number {
    return Math.min(1, this.elapsedMs / Math.max(1, this.config.durationMs));
  }

  protected get mut() {
    return this.config.mutators;
  }

  /** Primera linea util por arriba (debajo del HUD). */
  protected get areaTop(): number {
    return this.services.insets.top;
  }

  /** Ultima linea util por abajo (encima de la barra del rival). */
  protected get areaBottom(): number {
    return this.height - this.services.insets.bottom;
  }

  protected get areaHeight(): number {
    return Math.max(80, this.areaBottom - this.areaTop);
  }

  /** Suma puntos aplicando el multiplicador de mutadores. */
  protected addScore(points: number, x?: number, y?: number, options: { silent?: boolean } = {}): number {
    const delta = Math.round(points * this.mut.scoreMultiplier);
    this._score = Math.max(0, this._score + delta);
    if (!options.silent) {
      this.events.emit('score', {
        score: Math.round(this._score),
        delta,
        x: x ?? this.width / 2,
        y: y ?? this.height / 2,
        combo: this.combo,
      });
    }
    return delta;
  }

  protected bumpCombo(): number {
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.events.emit('combo', { combo: this.combo, best: this.bestCombo });
    return this.combo;
  }

  protected breakCombo(): void {
    if (this.combo === 0) return;
    this.combo = 0;
    this.events.emit('combo', { combo: 0, best: this.bestCombo });
  }

  /** Registra un fallo, descuenta vida y termina si se agotan. */
  protected registerMistake(cost = 0): void {
    this.mistakes++;
    this.misses++;
    this.breakCombo();
    if (cost > 0) this._score = Math.max(0, this._score - cost);
    if (this.lives !== null) {
      this.lives = Math.max(0, this.lives - 1);
      this.events.emit('mistake', { mistakes: this.mistakes, livesLeft: this.lives });
      if (this.lives <= 0) this.finish('death');
      return;
    }
    this.events.emit('mistake', { mistakes: this.mistakes, livesLeft: -1 });
  }

  protected registerHit(): void {
    this.hits++;
  }

  protected setLives(defaultLives: number | null): void {
    const forced = this.mut.lives;
    this.maxLives = forced ?? defaultLives;
    this.lives = this.maxLives;
  }

  /** Eje horizontal de teclado con los controles invertidos ya aplicados. */
  protected axisX(): number {
    const raw = this.services.input.keyboardAxisX;
    return this.mut.invertControls ? -raw : raw;
  }

  protected axisY(): number {
    const raw = this.services.input.keyboardAxisY;
    return this.mut.invertControls ? -raw : raw;
  }

  /** Posicion X del puntero con los controles invertidos ya aplicados. */
  protected pointerX(): number {
    const x = this.services.input.x;
    return this.mut.invertControls ? this.width - x : x;
  }

  protected pointerY(): number {
    const y = this.services.input.y;
    return this.mut.invertControls ? this.height - y : y;
  }

  protected announce(text: string, tone: 'good' | 'bad' = 'good'): void {
    this.events.emit('milestone', { text, tone });
  }

  /** Marca el fantasma como superado (una sola vez). */
  protected passGhost(label: string): void {
    if (this.ghostPassed) return;
    this.ghostPassed = true;
    this.events.emit('ghost', { passed: true, label });
  }

  protected finish(reason: EndReason): void {
    if (this._state === 'finished' || this._state === 'destroyed') return;
    const total = this.hits + this.misses;
    this.result = {
      gameId: this.meta.id,
      gameVersion: this.meta.version ?? 1,
      seed: this.config.seed,
      score: Math.round(this._score),
      durationMs: Math.round(this.elapsedMs),
      accuracy: this.tracksAccuracy && total > 0 ? this.hits / total : null,
      bestCombo: this.bestCombo,
      mistakes: this.mistakes,
      mutatorIds: this.config.mutatorIds.slice(),
      endedBy: reason,
      metrics: { ...this.metrics(), survivedMs: Math.round(this.elapsedMs) },
    };
    this.setState('finished');
    this.events.emit('finish', { result: this.result });
  }

  /** Termina la partida desde fuera (salir, debug). */
  forceFinish(reason: EndReason = 'aborted'): void {
    this.finish(reason);
  }

  private setState(state: GameState): void {
    this._state = state;
    this.events.emit('state', { state });
  }

  private reset(): void {
    this._score = 0;
    this.elapsedMs = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.mistakes = 0;
    this.hits = 0;
    this.misses = 0;
    this.lives = null;
    this.maxLives = null;
    this.ghostPassed = false;
    this.result = null;
    this.rng = new Rng(this.config.seed);
    this.services.fx.clear();
    this.services.audio.resetCombo();
    this.setup();
  }

  private ghostProgress(): number | null {
    const ghost = this.config.ghost;
    if (!ghost) return null;
    if (ghost.kind === 'time') return Math.min(1.5, this.elapsedMs / Math.max(1, ghost.value));
    return Math.min(1.5, this._score / Math.max(1, ghost.value));
  }

  private formatGhostValue(ghost: { kind: 'time' | 'score'; value: number }): string {
    return ghost.kind === 'time' ? `${(ghost.value / 1000).toFixed(1)} s` : `${Math.round(ghost.value)}`;
  }

  /* --------------------------------------------------------------- */
  /* A implementar por cada juego                                     */
  /* --------------------------------------------------------------- */

  /** Prepara/reinicia el estado interno. Se llama en cada start(). */
  protected abstract setup(): void;
  /** Logica de un frame. dt en segundos. */
  protected abstract tick(dt: number): void;
  /** Pintado de un frame. */
  protected abstract draw(): void;

  /** Metricas propias que iran al resultado. */
  protected metrics(): Record<string, number> {
    return {};
  }

  /** Limpieza al destruir (timers propios, listeners...). */
  protected teardown(): void {
    /* por defecto no hay nada que limpiar */
  }

  /** Reaccion al cambio de tamano. */
  protected onResize(_prevWidth: number, _prevHeight: number): void {
    /* por defecto nada */
  }
}
