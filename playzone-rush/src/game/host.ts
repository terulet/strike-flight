/**
 * GameHost: el unico sitio del proyecto que sabe montar un minijuego.
 *
 * Se encarga de canvas + DPR + resize, del bucle, de la entrada, de pausar al
 * irse a segundo plano, del "jugo" generico (particulas al puntuar, temblor al
 * fallar, oscuridad del mutador APAGON) y de devolver el GameResult.
 *
 * Los minijuegos no tocan el DOM. Nunca.
 */
import { AudioBus } from '../core/audio';
import { FxSystem } from '../core/fx';
import { Haptics } from '../core/haptics';
import { InputManager } from '../core/input';
import { Ticker } from '../core/loop';
import { MusicEngine, hasTheme } from '../core/music';
import type {
  GameConfig,
  GameDefinition,
  GameResult,
  HudInfo,
  MiniGame,
  ScreenInsets,
} from './contract';

export interface HostCallbacks {
  onHud?: (hud: HudInfo) => void;
  onFinish?: (result: GameResult, game: MiniGame) => void;
  onMilestone?: (text: string, tone: 'good' | 'bad') => void;
  onGhostPassed?: (label: string) => void;
  onAutoPause?: () => void;
}

export interface HostOptions extends HostCallbacks {
  container: HTMLElement;
  audio: AudioBus;
  haptics: Haptics;
  reducedMotion?: boolean;
}

const MAX_DPR = 2;

export class GameHost {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input = new InputManager();
  readonly fx = new FxSystem();
  readonly audio: AudioBus;
  readonly music: MusicEngine;
  readonly haptics: Haptics;

  private container: HTMLElement;
  private ticker: Ticker;
  private observer: ResizeObserver | null = null;
  private callbacks: HostCallbacks;
  private current: MiniGame | null = null;
  private currentDef: GameDefinition | null = null;
  private offs: (() => void)[] = [];
  private cssWidth = 0;
  private cssHeight = 0;
  private hudFrame = 0;
  private visibilityHandler: (() => void) | null = null;
  /** Referencia viva: los juegos la leen cada frame. */
  private insets: ScreenInsets = { top: 0, bottom: 0 };

  constructor(options: HostOptions) {
    this.container = options.container;
    this.audio = options.audio;
    this.music = new MusicEngine(options.audio);
    this.haptics = options.haptics;
    this.callbacks = options;
    this.fx.reducedMotion = options.reducedMotion ?? false;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pz-canvas';
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Este navegador no soporta canvas 2D');
    this.ctx = ctx;
    this.container.appendChild(this.canvas);

    this.input.attach(this.canvas);
    this.ticker = new Ticker((dt) => this.frame(dt));

    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(this.container);
    }
    globalThis.addEventListener('orientationchange', this.resize);

    this.visibilityHandler = () => {
      if (document.hidden && this.current?.state === 'playing') {
        this.pause();
        this.callbacks.onAutoPause?.();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.resize();
  }

  get fps(): number {
    return this.ticker.fps;
  }

  get game(): MiniGame | null {
    return this.current;
  }

  get definition(): GameDefinition | null {
    return this.currentDef;
  }

  setReducedMotion(value: boolean): void {
    this.fx.reducedMotion = value;
  }

  /** El shell dice cuanto ocupa su HUD; los juegos dejan esa franja libre. */
  setInsets(top: number, bottom: number): void {
    this.insets.top = Math.max(0, Math.round(top));
    this.insets.bottom = Math.max(0, Math.round(bottom));
    this.current?.resize(this.cssWidth, this.cssHeight);
  }

  /** Carga un juego con unas condiciones. No lo arranca. */
  load(definition: GameDefinition, config: GameConfig): MiniGame {
    this.unload();
    this.resize();
    const game = definition.create(
      {
        canvas: this.canvas,
        ctx: this.ctx,
        width: this.cssWidth,
        height: this.cssHeight,
        insets: this.insets,
        input: this.input,
        audio: this.audio,
        music: this.music,
        haptics: this.haptics,
        fx: this.fx,
      },
      config,
    );
    this.current = game;
    this.currentDef = definition;
    this.wire(game);
    this.canvas.classList.toggle('is-chaos', config.mutators.chaos);
    return game;
  }

  start(): void {
    if (!this.current) return;
    this.input.reset();
    this.current.start();
    this.startMusic();
    this.ticker.start();
  }

  /**
   * Pone el tema del juego que toca. Cada juego tiene el suyo por id, y si no
   * lo tiene se queda sin musica en vez de sonar el de otro: mejor silencio
   * que un tema que no pega. El evento CHAOS manda sobre el tema del juego.
   */
  private startMusic(): void {
    const id = this.currentDef?.meta.id;
    if (!id) return;
    const chaos = this.current?.config.mutatorIds.includes('chaos') ?? false;
    const theme = chaos ? 'chaos' : id;
    if (!hasTheme(theme)) {
      this.music.stop();
      return;
    }
    this.music.start(theme, { intensity: 0.5 });
  }

  pause(): void {
    this.current?.pause();
    this.music.stop();
  }

  resume(): void {
    if (!this.current) return;
    this.input.reset();
    this.current.resume();
    this.startMusic();
    if (!this.ticker.isRunning) this.ticker.start();
  }

  /** Revancha: mismo juego, misma config, cero menus. */
  restart(): void {
    if (!this.current) return;
    this.input.reset();
    this.fx.clear();
    this.current.restart();
    this.startMusic();
    if (!this.ticker.isRunning) this.ticker.start();
  }

  /** Termina la partida en curso (salir a menu, debug). */
  abort(): void {
    const game = this.current as { forceFinish?: (reason: 'aborted') => void } | null;
    game?.forceFinish?.('aborted');
  }

  unload(): void {
    this.ticker.stop();
    this.music.stop();
    for (const off of this.offs) off();
    this.offs = [];
    this.current?.destroy();
    this.current = null;
    this.currentDef = null;
    this.fx.clear();
    this.input.reset();
    this.canvas.classList.remove('is-chaos');
  }

  destroy(): void {
    this.unload();
    this.input.detach();
    this.observer?.disconnect();
    globalThis.removeEventListener('orientationchange', this.resize);
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.canvas.remove();
  }

  /* --------------------------------------------------------------- */

  private wire(game: MiniGame): void {
    // Feedback generico: cualquier juego nuevo lo hereda gratis.
    this.offs.push(
      game.events.on('score', ({ delta, x, y, combo }) => {
        if (delta === 0) return;
        const positive = delta > 0;
        const color = positive ? (combo >= 3 ? '#ffd23f' : '#7cf3c0') : '#ff5470';
        this.fx.float(x, y, `${positive ? '+' : ''}${delta}`, {
          color,
          size: Math.min(34, 19 + Math.abs(delta) / 18 + Math.min(7, combo)),
        });
        this.fx.burst(x, y, { count: positive ? 8 : 5, color, speed: 190, size: 3.5, life: 0.45 });
        this.audio.play(positive ? 'score' : 'error');
      }),
      game.events.on('combo', ({ combo }) => {
        if (combo >= 2) {
          this.audio.play('combo', combo);
          this.haptics.fire('tick');
        }
      }),
      game.events.on('mistake', () => {
        this.fx.shake(0.55);
        this.fx.flash('#ff2d55', 0.22);
        this.audio.play('miss');
        this.haptics.fire('error');
      }),
      game.events.on('ghost', ({ passed, label }) => {
        if (!passed) return;
        this.fx.flash('#8b5cf6', 0.3);
        this.fx.shake(0.4);
        this.audio.play('passed');
        this.haptics.fire('success');
        this.callbacks.onGhostPassed?.(label);
      }),
      game.events.on('milestone', ({ text, tone }) => {
        this.callbacks.onMilestone?.(text, tone);
      }),
      game.events.on('finish', ({ result }) => {
        this.ticker.stop();
        this.callbacks.onFinish?.(result, game);
      }),
    );
  }

  private frame(dt: number): void {
    const game = this.current;
    if (!game) return;

    if (game.state === 'playing') game.update(dt);
    this.fx.update(dt);

    const { ctx } = this;
    const w = this.cssWidth;
    const h = this.cssHeight;
    ctx.save();
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, w, h);

    const shake = this.fx.shakeOffset;
    ctx.translate(shake.x, shake.y);
    game.render();
    this.fx.render(ctx);
    ctx.restore();

    this.drawDarkness(w, h);
    this.fx.renderFloaters(ctx);
    this.fx.renderFlash(ctx, w, h);

    this.input.endFrame();

    // El HUD es DOM: refrescarlo a 60 Hz es tirar el presupuesto. 20 Hz basta.
    this.hudFrame++;
    if (this.hudFrame % 3 === 0) this.callbacks.onHud?.(game.hud());
  }

  /** Mutador APAGON: vineta centrada donde el jugador tiene el dedo. */
  private drawDarkness(w: number, h: number): void {
    const darkness = this.current?.config.mutators.darkness ?? 0;
    if (darkness <= 0.001) return;
    const cx = this.input.down || this.input.x > 0 ? this.input.x : w / 2;
    const cy = this.input.down || this.input.y > 0 ? this.input.y : h / 2;
    const radius = Math.max(w, h) * (0.62 - darkness * 0.42);
    const grad = this.ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${darkness.toFixed(3)})`);
    this.ctx.save();
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.restore();
  }

  private resize = (): void => {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === this.cssWidth && height === this.cssHeight) return;
    const dpr = Math.min(MAX_DPR, globalThis.devicePixelRatio || 1);
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.current?.resize(width, height);
  };
}
