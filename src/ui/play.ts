/**
 * Pantalla de partida: cuenta atras, HUD, pausa y resultado.
 *
 * Se mantiene viva entre intentos: pulsar REVANCHA no desmonta nada, solo
 * reinicia el juego. Por eso la revancha es instantanea.
 */
import type { GameConfig, GameResult, HudInfo } from '../game/contract';
import { GameHost } from '../game/host';
import { requireGame } from '../game/registry';
import type { ChallengeSpec } from '../meta/daily';
import { formatScore } from '../meta/ranking';
import type { ScoreOutcome } from '../meta/scoring';
import type { App } from './app';
import { button, el } from './dom';
import { celebrate, renderResult } from './result';

interface Hud {
  score: HTMLElement;
  time: HTMLElement;
  bar: HTMLElement;
  lives: HTMLElement;
  combo: HTMLElement;
  ghost: HTMLElement;
}

export class PlayScreen {
  private app: App;
  private spec: ChallengeSpec;
  private config: GameConfig;

  private root: HTMLElement;
  private stage: HTMLElement;
  private hud: Hud;
  private overlay: HTMLElement | null = null;
  private host: GameHost;

  private ghostPassed = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastScore = 0;
  private finished = false;
  private startedAt = 0;

  constructor(app: App, spec: ChallengeSpec, config: GameConfig) {
    this.app = app;
    this.spec = spec;
    this.config = config;

    this.stage = el('div', { class: 'stage' });
    this.hud = {
      score: el('div', { class: 'hud__score num', text: '0' }),
      time: el('div', { class: 'hud__time num', text: '0.0' }),
      bar: el('div', { class: 'hud__bar-fill' }),
      lives: el('div', { class: 'hud__lives' }),
      combo: el('div', { class: 'hud__combo', text: '' }),
      ghost: el('div', { class: 'hud__ghost' }),
    };

    const hudNode = el('div', { class: 'hud' }, [
      el('div', { class: 'hud__top' }, [
        el('div', {}, [el('div', { class: 'hud__label', text: 'PUNTOS' }), this.hud.score]),
        el('div', { class: 'hud__right' }, [
          el('div', { class: 'hud__label', text: 'TIEMPO' }),
          this.hud.time,
          this.hud.lives,
        ]),
        button('⏸', 'icon-btn hud__exit', () => this.pause()),
      ]),
      el('div', { class: 'hud__bar' }, [this.hud.bar]),
    ]);

    this.root = el('div', { class: 'play' }, [this.stage, hudNode, this.hud.combo, this.hud.ghost]);

    this.host = new GameHost({
      container: this.stage,
      audio: app.audio,
      haptics: app.haptics,
      reducedMotion: app.save.get().prefs.reducedMotion,
      onHud: (info) => this.paintHud(info),
      onFinish: (result) => this.handleFinish(result),
      onMilestone: (text, tone) => app.toaster.show(text, tone === 'good' ? 'good' : 'bad', 1400),
      onGhostPassed: (labelText) => {
        this.ghostPassed = true;
        this.hud.ghost.classList.add('is-passed');
        this.hud.ghost.textContent = `👻 SUPERADO: ${labelText}`;
        app.toaster.show(`👻 HAS PASADO A ${labelText}`, 'good', 1800);
      },
      onAutoPause: () => this.showPause(),
    });
  }

  mount(): void {
    document.body.appendChild(this.root);
  }

  /** Cambiar de reto sin desmontar (usado al encadenar partidas). */
  reconfigure(spec: ChallengeSpec, config: GameConfig): void {
    this.spec = spec;
    this.config = config;
  }

  /** Arranca un intento. quick = revancha (cuenta atras corta). */
  beginRun(options: { quick?: boolean } = {}): void {
    this.clearTimers();
    this.clearOverlay();
    this.finished = false;
    this.ghostPassed = false;
    this.lastScore = 0;

    const definition = requireGame(this.spec.gameId);
    this.host.load(definition, this.config);
    this.hud.score.textContent = '0';
    this.hud.combo.classList.remove('is-on');
    this.hud.ghost.classList.remove('is-passed');
    this.hud.ghost.textContent = this.config.ghost
      ? `👻 ${this.config.ghost.rivalName} · ${(this.config.ghost.value / 1000).toFixed(1)} s`
      : this.config.targetName
        ? `🎯 ${this.config.targetName} · ${formatScore(this.config.targetScore ?? 0)}`
        : '';
    this.hud.ghost.style.display = this.hud.ghost.textContent ? '' : 'none';

    this.runCountdown(options.quick ?? false);
  }

  private runCountdown(quick: boolean): void {
    const definition = requireGame(this.spec.gameId);
    const meta = definition.meta;
    const numberNode = el('div', { class: 'countdown__num', text: quick ? '¡YA!' : '3' });

    const overlay = el('div', { class: 'countdown' }, [
      quick
        ? null
        : el('div', { class: 'countdown__rule' }, [
            el('div', { class: 'countdown__game', text: meta.name }),
            ...meta.instructions.map((line) => el('div', { class: 'countdown__line', text: line })),
          ]),
      numberNode,
      this.config.targetName && !quick
        ? el('div', {
            class: 'countdown__target',
            text: `A BATIR: ${this.config.targetName} · ${formatScore(this.config.targetScore ?? 0)}`,
          })
        : null,
    ]);
    this.stage.appendChild(overlay);
    this.overlay = overlay;

    const steps = quick ? ['¡YA!'] : ['3', '2', '1', '¡YA!'];
    const stepMs = quick ? 380 : 620;
    let index = 0;
    this.app.audio.play(quick ? 'go' : 'countdown');

    const advance = () => {
      index++;
      if (index >= steps.length) {
        overlay.remove();
        this.overlay = null;
        this.startedAt = performance.now();
        this.host.start();
        return;
      }
      numberNode.textContent = steps[index] as string;
      numberNode.style.animation = 'none';
      void numberNode.offsetWidth;
      numberNode.style.animation = '';
      this.app.audio.play(index === steps.length - 1 ? 'go' : 'countdown');
      this.timers.push(setTimeout(advance, stepMs));
    };
    this.timers.push(setTimeout(advance, stepMs));
  }

  private paintHud(info: HudInfo): void {
    const score = Math.round(info.score);
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.hud.score.textContent = formatScore(score);
      this.hud.score.classList.add('is-bump');
      setTimeout(() => this.hud.score.classList.remove('is-bump'), 90);
    }

    const seconds = info.timeLeftMs / 1000;
    this.hud.time.textContent = seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1);
    this.hud.time.classList.toggle('is-low', seconds <= 5);
    this.hud.bar.style.transform = `scaleX(${Math.max(0, info.timeLeftMs / Math.max(1, info.totalMs))})`;

    if (info.maxLives !== null && info.maxLives > 0) {
      if (this.hud.lives.childElementCount !== info.maxLives) {
        this.hud.lives.replaceChildren(
          ...Array.from({ length: info.maxLives }, () => el('div', { class: 'life' })),
        );
      }
      const alive = info.lives ?? 0;
      Array.from(this.hud.lives.children).forEach((node, i) => {
        node.classList.toggle('is-gone', i >= alive);
      });
    } else if (this.hud.lives.childElementCount > 0) {
      this.hud.lives.replaceChildren();
    }

    if (info.combo >= 2) {
      this.hud.combo.textContent = `COMBO x${info.combo}`;
      this.hud.combo.classList.add('is-on');
    } else {
      this.hud.combo.classList.remove('is-on');
    }

    if (info.ghostProgress !== null && this.config.ghost && !this.ghostPassed) {
      const pct = Math.round(Math.min(1, info.ghostProgress) * 100);
      this.hud.ghost.textContent = `👻 ${this.config.ghost.rivalName} · ${(
        this.config.ghost.value / 1000
      ).toFixed(1)} s · ${pct}%`;
    }
  }

  private handleFinish(result: GameResult): void {
    if (this.finished) return;
    this.finished = true;
    const outcome = this.app.finishRun(this.spec, result, this.ghostPassed);
    celebrate(this.app, outcome);
    this.showResult(outcome, result);
  }

  private showResult(outcome: ScoreOutcome, result: GameResult): void {
    this.clearOverlay();
    const node = renderResult(this.spec, outcome, result, {
      onRematch: () => {
        this.app.audio.play('select');
        this.app.rematch(this.spec);
      },
      onContinue: () => {
        this.app.audio.play('back');
        this.app.exitToHome();
      },
    });
    this.overlay = node;
    this.root.appendChild(node);
  }

  pause(): void {
    if (this.finished) return;
    this.host.pause();
    this.showPause();
  }

  private showPause(): void {
    if (this.overlay || this.finished) return;
    const overlay = el('div', { class: 'pause' }, [
      el('div', { class: 'pause__title', text: 'EN PAUSA' }),
      button('SEGUIR', 'btn btn--play btn--lg', () => {
        overlay.remove();
        this.overlay = null;
        this.host.resume();
      }),
      button('ABANDONAR INTENTO', 'btn btn--ghost', () => {
        const elapsed = this.startedAt > 0 ? performance.now() - this.startedAt : 0;
        this.app.abortRun(this.spec, elapsed);
      }),
    ]);
    this.overlay = overlay;
    this.root.appendChild(overlay);
  }

  /** Debug: terminar la partida en curso ya. */
  forceFinish(): void {
    this.host.abort();
  }

  get fps(): number {
    return this.host.fps;
  }

  private clearOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  destroy(): void {
    this.clearTimers();
    this.clearOverlay();
    this.host.destroy();
    this.root.remove();
    document.body.classList.remove('is-playing');
  }
}
