/**
 * Orquestador. Conoce el save, el dia, el plan y las pantallas; nadie mas
 * necesita conocerse entre si. Cambiar una pantalla no toca la logica de meta,
 * y cambiar la logica de meta no toca las pantallas.
 */
import { AudioBus } from '../core/audio';
import { GameClock } from '../core/clock';
import { Haptics } from '../core/haptics';
import { seedFrom } from '../core/rng';
import { SaveManager } from '../core/save';
import type { GameConfig, GameResult } from '../game/contract';
import { resolveMutators } from '../game/mutators';
import { requireGame } from '../game/registry';
import { attemptsLeft, beginAttempt, canPlay, refundAttempt } from '../meta/attempts';
import { buildDailyPlan, findChallenge, type ChallengeSpec, type DailyPlan } from '../meta/daily';
import { buildLeaderboard } from '../meta/ranking';
import { commitResult, type ScoreOutcome } from '../meta/scoring';
import { evaluateSecretUnlock, isChaosEnabled } from '../meta/secret';
import { computeStreak, resolvePendingDays, type StreakInfo } from '../meta/streaks';
import { buildGameConfig } from '../meta/session';
import { renderHome } from './home';
import { PlayScreen } from './play';
import { Toaster } from './toast';
import { clear, el } from './dom';

export class App {
  readonly save: SaveManager;
  readonly audio: AudioBus;
  readonly haptics: Haptics;
  readonly clock: GameClock;
  readonly toaster = new Toaster();
  readonly root: HTMLElement;

  plan!: DailyPlan;
  debugMode = false;
  /** Debug: si esta puesto, sustituye a los mutadores del reto. */
  mutatorOverride: string[] | null = null;
  private shell: HTMLElement;
  private play: PlayScreen | null = null;
  private onChangeListeners: (() => void)[] = [];

  constructor(root: HTMLElement, save = new SaveManager()) {
    this.root = root;
    this.save = save;
    const prefs = save.get().prefs;
    this.audio = new AudioBus(prefs.muted);
    this.haptics = new Haptics(prefs.haptics);
    this.clock = new GameClock({
      getOffset: () => this.save.get().debug.dayOffset,
      setOffset: (offset) => {
        this.save.update((data) => {
          data.debug.dayOffset = offset;
        });
      },
    });

    this.shell = el('div', { class: 'shell' });
    clear(root);
    root.appendChild(this.shell);
  }

  /* ---------------- estado ---------------- */

  get dayKey(): string {
    return this.clock.todayKey();
  }

  get secretUnlocked(): boolean {
    return Boolean(this.save.get().days[this.dayKey]?.secretUnlocked);
  }

  get chaosEnabled(): boolean {
    return isChaosEnabled(this.save, this.dayKey);
  }

  get streak(): StreakInfo {
    return computeStreak(this.save, this.dayKey);
  }

  leaderboard() {
    return buildLeaderboard(this.plan, this.save, this.secretUnlocked);
  }

  onChange(fn: () => void): void {
    this.onChangeListeners.push(fn);
  }

  /* ---------------- ciclo ---------------- */

  boot(): void {
    this.reloadDay();
    if (this.save.report.status === 'recovered') {
      this.toaster.show('PARTIDA CORRUPTA: EMPEZAMOS LIMPIO', 'bad', 3200);
    } else if (this.save.report.status === 'migrated') {
      this.toaster.show('PARTIDA MIGRADA AL NUEVO FORMATO', 'neutral', 2600);
    }
    if (this.save.store.kind === 'memory') {
      this.toaster.show('SIN ALMACENAMIENTO: NO SE GUARDARA', 'bad', 3600);
    }
    this.renderHome();
  }

  /** Recalcula el plan del dia (tras cambiar el dia virtual o al arrancar). */
  reloadDay(): void {
    this.plan = buildDailyPlan(this.dayKey);
    resolvePendingDays(this.save, this.dayKey);
    evaluateSecretUnlock(this.save, this.plan);
  }

  renderHome(): void {
    document.body.classList.remove('is-playing');
    clear(this.shell);
    this.shell.appendChild(renderHome(this));
    this.notify();
  }

  refresh(): void {
    this.reloadDay();
    if (!this.play) this.renderHome();
    else this.notify();
  }

  private notify(): void {
    for (const fn of this.onChangeListeners) fn();
  }

  /* ---------------- juego ---------------- */

  challengeById(id: string): ChallengeSpec | null {
    return findChallenge(this.plan, id);
  }

  attemptsLeft(spec: ChallengeSpec): number {
    return attemptsLeft(this.save, this.dayKey, spec);
  }

  canPlay(spec: ChallengeSpec): boolean {
    return canPlay(this.save, this.dayKey, spec);
  }

  /** Punto de entrada unico para jugar un reto. */
  startChallenge(spec: ChallengeSpec, options: { quick?: boolean; ignoreAttempts?: boolean } = {}): void {
    this.audio.unlock();
    if (spec.kind === 'secret' && !this.secretUnlocked && !options.ignoreAttempts) {
      this.toaster.show('RETO SECRETO BLOQUEADO', 'bad');
      return;
    }
    if (!options.ignoreAttempts && !beginAttempt(this.save, this.dayKey, spec)) {
      this.toaster.show('SIN INTENTOS EN ESTE RETO', 'bad');
      this.audio.play('error');
      return;
    }

    const config = this.applyOverride(buildGameConfig(this.plan, spec, this.save), spec);
    if (!this.play) {
      this.play = new PlayScreen(this, spec, config);
      this.play.mount();
      document.body.classList.add('is-playing');
    } else {
      this.play.reconfigure(spec, config);
    }
    this.play.beginRun({ quick: options.quick ?? false });
    this.notify();
  }

  /** Aplica el override de mutadores del panel de debug, si lo hay. */
  private applyOverride(config: GameConfig, spec: ChallengeSpec): GameConfig {
    if (!this.mutatorOverride) return config;
    const mutators = resolveMutators(this.mutatorOverride);
    return {
      ...config,
      mutators,
      mutatorIds: this.mutatorOverride.slice(),
      durationMs: Math.round(spec.baseDurationMs * mutators.durationMultiplier),
    };
  }

  /** Debug: lanzar un juego suelto, fuera de la rotacion del dia. */
  startDebugRun(gameId: string): void {
    const definition = requireGame(gameId);
    const mutatorIds = this.mutatorOverride ?? [];
    const mutators = resolveMutators(mutatorIds);
    const spec: ChallengeSpec = {
      id: `debug-${gameId}`,
      index: 99,
      title: 'DEBUG',
      kind: 'daily',
      gameId,
      gameName: definition.meta.name,
      skill: definition.meta.skill,
      seed: seedFrom('debug', this.dayKey, gameId, String(this.save.get().days[this.dayKey]?.challenges[`debug-${gameId}`]?.plays ?? 0)),
      baseDurationMs: definition.meta.defaultDurationMs,
      durationMs: Math.round(definition.meta.defaultDurationMs * mutators.durationMultiplier),
      difficulty: 0.4,
      mutatorIds,
      attempts: 99,
      countsForRanking: false,
      scoreMultiplier: mutators.scoreMultiplier,
    };
    this.startChallenge(spec, { quick: true, ignoreAttempts: true });
  }

  /** Revancha: mismo reto, cero menus. */
  rematch(spec: ChallengeSpec): void {
    if (!this.canPlay(spec)) {
      this.toaster.show('SIN INTENTOS', 'bad');
      this.audio.play('error');
      return;
    }
    this.startChallenge(spec, { quick: true });
  }

  /** El jugador abandona a mitad: se le devuelve el intento si acaba de empezar. */
  abortRun(spec: ChallengeSpec, elapsedMs: number): void {
    if (elapsedMs < 3000) refundAttempt(this.save, this.dayKey, spec);
    this.exitToHome();
  }

  finishRun(spec: ChallengeSpec, result: GameResult, ghostPassed: boolean): ScoreOutcome {
    const outcome = commitResult({
      plan: this.plan,
      spec,
      save: this.save,
      result,
      secretUnlocked: this.secretUnlocked,
      ghostPassed,
    });

    // Terminar los tres retos puede abrir el secreto.
    if (evaluateSecretUnlock(this.save, this.plan)) {
      this.toaster.show('RETO SECRETO DESBLOQUEADO', 'gold', 3000);
      this.audio.play('unlock');
    }

    this.save.flush();
    this.notify();
    return outcome;
  }

  exitToHome(): void {
    this.play?.destroy();
    this.play = null;
    this.save.flush();
    this.reloadDay();
    this.renderHome();
  }

  get playScreen(): PlayScreen | null {
    return this.play;
  }

  /* ---------------- preferencias ---------------- */

  toggleMute(): boolean {
    const muted = this.audio.toggleMute();
    this.save.update((data) => {
      data.prefs.muted = muted;
    });
    this.save.flush();
    this.notify();
    return muted;
  }

  setName(name: string): void {
    this.save.update((data) => {
      data.profile.name = name.toUpperCase().slice(0, 12);
    });
    this.save.flush();
    this.refresh();
  }

  shiftDay(delta: number): void {
    this.clock.shift(delta);
    this.save.flush();
    this.exitToHomeIfPlaying();
    this.refresh();
  }

  private exitToHomeIfPlaying(): void {
    if (this.play) {
      this.play.destroy();
      this.play = null;
      document.body.classList.remove('is-playing');
    }
  }
}
