/**
 * Panel de desarrollo. Se carga SOLO con ?debug (import dinamico), vive en su
 * propio modulo y no comparte estilos con el producto: si algun dia se cuela en
 * una build de tienda, se ve a la legua.
 */
import { addDays } from '../core/clock';
import { MUTATOR_IDS, MUTATORS, resolveMutators } from '../game/mutators';
import { listGames } from '../game/registry';
import { restoreAttempts } from '../meta/attempts';
import { formatDuration, type ChallengeSpec } from '../meta/daily';
import { formatScore } from '../meta/ranking';
import { RIVALS } from '../meta/rivals';
import {
  forceSecretUnlock,
  markAllRivalsPlayed,
  markRivalPlayed,
  secretStatus,
  setChaosEnabled,
} from '../meta/secret';
import { buildLeaderboard } from '../meta/ranking';
import type { App } from './app';
import { button, el } from './dom';

export function mountDebug(app: App): void {
  app.debugMode = true;
  const panel = new DebugPanel(app);
  panel.mount();
}

class DebugPanel {
  private app: App;
  private toggle: HTMLElement;
  private panel: HTMLElement | null = null;
  private fps: HTMLElement;
  private raf = 0;

  constructor(app: App) {
    this.app = app;
    this.toggle = button('</>', 'debug-toggle', () => this.togglePanel());
    this.fps = el('div', { class: 'dbg-fps', text: 'FPS —' });
  }

  mount(): void {
    document.body.appendChild(this.toggle);
    document.body.appendChild(this.fps);
    this.app.onChange(() => this.refresh());
    this.loopFps();
  }

  private loopFps(): void {
    let last = 0;
    let frames = 0;
    const tick = (now: number) => {
      frames++;
      if (now - last > 500) {
        const gameFps = this.app.playScreen?.fps ?? 0;
        const uiFps = Math.round((frames * 1000) / (now - last));
        this.fps.textContent = gameFps > 0 ? `FPS ${gameFps} · UI ${uiFps}` : `UI ${uiFps}`;
        frames = 0;
        last = now;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private togglePanel(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      return;
    }
    this.panel = el('div', { class: 'debug-panel' });
    document.body.appendChild(this.panel);
    this.refresh();
  }

  private refresh(): void {
    if (!this.panel) return;
    const app = this.app;
    const panel = this.panel;
    panel.replaceChildren();

    panel.appendChild(
      el('div', { class: 'debug-panel__head' }, [
        el('div', { class: 'debug-panel__title', text: 'PLAYZONE RUSH · DEBUG' }),
        button('✕', 'debug-panel__close', () => this.togglePanel()),
      ]),
    );

    panel.appendChild(this.groupDay());
    panel.appendChild(this.groupAttempts());
    panel.appendChild(this.groupRivals());
    panel.appendChild(this.groupUnlocks());
    panel.appendChild(this.groupMutators());
    panel.appendChild(this.groupLaunch());
    panel.appendChild(this.groupScore());
    panel.appendChild(this.groupState());
    panel.appendChild(this.groupSave());
    void app;
  }

  private group(title: string, children: (HTMLElement | null)[]): HTMLElement {
    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: title }),
      el('div', { class: 'dbg-row' }, children),
    ]);
  }

  private groupDay(): HTMLElement {
    const app = this.app;
    return this.group('DIA VIRTUAL', [
      el('span', { text: `${app.dayKey} (offset ${app.clock.offset})` }),
      button('-1 DIA', 'dbg-btn', () => {
        app.shiftDay(-1);
        this.refresh();
      }),
      button('+1 DIA', 'dbg-btn', () => {
        app.shiftDay(1);
        this.refresh();
      }),
      button('HOY', 'dbg-btn', () => {
        app.clock.reset();
        app.refresh();
        this.refresh();
      }),
      button('MANANA →', 'dbg-btn', () => {
        app.shiftDay(1);
        this.refresh();
      }),
      el('span', { text: `sig: ${addDays(app.dayKey, 1)}` }),
    ]);
  }

  private groupAttempts(): HTMLElement {
    const app = this.app;
    const buttons = [...app.plan.challenges, app.plan.secret, app.plan.chaos].map((spec) =>
      button(`${spec.id.toUpperCase()} (${app.attemptsLeft(spec)})`, 'dbg-btn', () => {
        restoreAttempts(app.save, app.dayKey, spec.id);
        app.refresh();
        this.refresh();
      }),
    );
    return this.group('INTENTOS · restaurar', [
      button('TODOS', 'dbg-btn', () => {
        restoreAttempts(app.save, app.dayKey);
        app.refresh();
        this.refresh();
      }),
      ...buttons,
    ]);
  }

  private groupRivals(): HTMLElement {
    const app = this.app;
    const day = app.save.get().days[app.dayKey];
    const played = new Set(day?.rivalsPlayed ?? []);
    const board = buildLeaderboard(app.plan, app.save, app.secretUnlocked);
    const myTotal = board.me.total;

    const children: HTMLElement[] = [];
    for (const rival of RIVALS) {
      const entry = board.standings.find((s) => s.id === rival.id);
      children.push(
        el('div', { class: 'dbg-row', style: { width: '100%' } }, [
          el('span', { style: { minWidth: '52px', color: rival.color }, text: rival.name }),
          el('span', { style: { minWidth: '56px' }, text: formatScore(entry?.total ?? 0) }),
          button('+400', 'dbg-btn', () => this.boost(rival.id, 400)),
          button('-400', 'dbg-btn', () => this.boost(rival.id, -400)),
          button('QUE ME SUPERE', 'dbg-btn', () => {
            const current = entry?.total ?? 0;
            const needed = Math.round((myTotal + 150 - current) / 3);
            this.boost(rival.id, needed);
          }),
          button(played.has(rival.id) ? 'HA JUGADO ✓' : 'MARCAR JUGADO', `dbg-btn${played.has(rival.id) ? ' is-on' : ''}`, () => {
            markRivalPlayed(app.save, app.dayKey, rival.id, !played.has(rival.id));
            app.refresh();
            this.refresh();
          }),
        ]),
      );
    }

    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: 'RIVALES' }),
      ...children,
      el('div', { class: 'dbg-row' }, [
        button('TODOS HAN JUGADO', 'dbg-btn', () => {
          markAllRivalsPlayed(app.save, app.dayKey, true);
          app.refresh();
          this.refresh();
        }),
        button('NADIE HA JUGADO', 'dbg-btn', () => {
          markAllRivalsPlayed(app.save, app.dayKey, false);
          app.refresh();
          this.refresh();
        }),
        button('RESET AJUSTES', 'dbg-btn dbg-btn--danger', () => {
          app.save.update(() => {
            app.save.day(app.dayKey).rivalBoosts = {};
          });
          app.refresh();
          this.refresh();
        }),
      ]),
    ]);
  }

  private boost(rivalId: string, delta: number): void {
    const app = this.app;
    app.save.update(() => {
      const day = app.save.day(app.dayKey);
      day.rivalBoosts[rivalId] = (day.rivalBoosts[rivalId] ?? 0) + delta;
    });
    app.refresh();
    this.refresh();
  }

  private groupUnlocks(): HTMLElement {
    const app = this.app;
    const status = secretStatus(app.save, app.plan);
    return this.group('DESBLOQUEOS', [
      el('span', { text: `secreto ${status.done}/${status.total}${status.unlocked ? ' · ABIERTO' : ''}` }),
      button(status.unlocked ? 'BLOQUEAR SECRETO' : 'DESBLOQUEAR SECRETO', `dbg-btn${status.unlocked ? ' is-on' : ''}`, () => {
        forceSecretUnlock(app.save, app.dayKey, !status.unlocked);
        app.refresh();
        this.refresh();
      }),
      button(app.chaosEnabled ? 'CHAOS ON ✓' : 'ACTIVAR CHAOS', `dbg-btn${app.chaosEnabled ? ' is-on' : ''}`, () => {
        setChaosEnabled(app.save, app.dayKey, !app.chaosEnabled);
        app.refresh();
        this.refresh();
      }),
    ]);
  }

  private groupMutators(): HTMLElement {
    const app = this.app;
    const active = app.mutatorOverride;
    const chips = MUTATOR_IDS.map((id) => {
      const on = active?.includes(id) ?? false;
      return button(MUTATORS[id]?.name ?? id, `dbg-btn${on ? ' is-on' : ''}`, () => {
        const next = new Set(active ?? []);
        if (on) next.delete(id);
        else next.add(id);
        app.mutatorOverride = next.size > 0 ? Array.from(next) : null;
        this.refresh();
      });
    });
    return this.group(
      `MUTADORES (override: ${active ? active.join(', ') : 'ninguno · se usan los del dia'})`,
      [
        button('QUITAR OVERRIDE', 'dbg-btn dbg-btn--danger', () => {
          app.mutatorOverride = null;
          this.refresh();
        }),
        ...chips,
      ],
    );
  }

  private groupLaunch(): HTMLElement {
    const app = this.app;
    const games = listGames().map((def) =>
      button(def.meta.name, 'dbg-btn', () => {
        app.startDebugRun(def.meta.id);
        this.togglePanel();
      }),
    );
    const challenges = [...app.plan.challenges, app.plan.secret, app.plan.chaos].map((spec: ChallengeSpec) =>
      button(`${spec.id} · ${spec.gameName}`, 'dbg-btn', () => {
        app.startChallenge(spec, { quick: true, ignoreAttempts: true });
        this.togglePanel();
      }),
    );
    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: 'LANZAR' }),
      el('div', { class: 'dbg-row' }, games),
      el('div', { class: 'dbg-row', style: { marginTop: '5px' } }, challenges),
      el('div', { class: 'dbg-row', style: { marginTop: '5px' } }, [
        button('TERMINAR PARTIDA', 'dbg-btn dbg-btn--danger', () => {
          app.playScreen?.forceFinish();
        }),
      ]),
    ]);
  }

  private groupScore(): HTMLElement {
    const app = this.app;
    const specs = [...app.plan.challenges, app.plan.secret];
    const rows = specs.map((spec) =>
      el('div', { class: 'dbg-row', style: { width: '100%' } }, [
        el('span', { style: { minWidth: '60px' }, text: `${spec.id} ${spec.gameName}` }),
        el('span', {
          style: { minWidth: '52px' },
          text: formatScore(app.save.get().days[app.dayKey]?.challenges[spec.id]?.bestScore ?? 0),
        }),
        button('+500', 'dbg-btn', () => this.setMyScore(spec, 500)),
        button('-500', 'dbg-btn', () => this.setMyScore(spec, -500)),
        button('0', 'dbg-btn', () => this.setMyScore(spec, 0, true)),
      ]),
    );
    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: 'MI PUNTUACION' }),
      ...rows,
    ]);
  }

  private setMyScore(spec: ChallengeSpec, delta: number, absolute = false): void {
    const app = this.app;
    app.save.update(() => {
      const progress = app.save.challenge(app.dayKey, spec.id);
      progress.bestScore = absolute ? delta : Math.max(0, progress.bestScore + delta);
      if (progress.plays === 0 && progress.bestScore > 0) progress.plays = 1;
    });
    app.refresh();
    this.refresh();
  }

  private groupState(): HTMLElement {
    const app = this.app;
    const rows: HTMLElement[] = [];
    for (const spec of [...app.plan.challenges, app.plan.secret, app.plan.chaos]) {
      const mut = resolveMutators(spec.mutatorIds);
      rows.push(
        el('div', {}, [
          el('b', { text: `${spec.id} ` }),
          el('span', {
            text: `${spec.gameName} · ${formatDuration(spec.durationMs)} · dif ${spec.difficulty} · x${mut.scoreMultiplier} · [${
              spec.mutatorIds.join(',') || 'sin mutadores'
            }] · seed ${spec.seed}`,
          }),
        ]),
      );
    }
    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: 'CONFIGURACION ACTIVA' }),
      el('div', { class: 'dbg-kv' }, [
        el('b', { text: 'dia' }),
        el('span', { text: `${app.dayKey} · seed ${app.plan.seed}` }),
        el('b', { text: 'save' }),
        el('span', {
          text: `v${app.save.get().version} · ${app.save.store.kind} · ${app.save.report.status}`,
        }),
        el('b', { text: 'racha' }),
        el('span', {
          text: `${app.streak.holderName ?? '—'} · ${app.streak.days} dias`,
        }),
      ]),
      ...rows,
    ]);
  }

  private groupSave(): HTMLElement {
    const app = this.app;
    return this.group('SAVE', [
      button('RESET SAVE', 'dbg-btn dbg-btn--danger', () => {
        app.save.reset();
        app.mutatorOverride = null;
        app.refresh();
        this.refresh();
      }),
      button('EXPORTAR (consola)', 'dbg-btn', () => {
        console.log(app.save.exportJson());
        app.toaster.show('SAVE VOLCADO EN CONSOLA', 'neutral');
      }),
      button('ROMPER SAVE (test)', 'dbg-btn dbg-btn--danger', () => {
        app.save.store.set('playzone.rush.save', '{ esto no es json');
        app.toaster.show('SAVE CORRUPTO: RECARGA PARA VER EL RESCATE', 'bad', 3000);
      }),
    ]);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.panel?.remove();
    this.toggle.remove();
    this.fps.remove();
  }
}
