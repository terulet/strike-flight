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
import { formatPercent } from '../meta/telemetry';
import type { App } from './app';
import { button, el } from './dom';

export function mountDebug(app: App): void {
  app.debugMode = true;
  const panel = new DebugPanel(app);
  panel.mount();
}

type TabId = 'dia' | 'intentos' | 'rivales' | 'juegos' | 'grupo' | 'metricas' | 'estado';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dia', label: 'DIA' },
  { id: 'intentos', label: 'INTENTOS' },
  { id: 'rivales', label: 'RIVALES' },
  { id: 'juegos', label: 'JUEGOS' },
  { id: 'grupo', label: 'GRUPO' },
  { id: 'metricas', label: 'METRICAS' },
  { id: 'estado', label: 'ESTADO' },
];

class DebugPanel {
  private app: App;
  private toggle: HTMLElement;
  private panel: HTMLElement | null = null;
  private fps: HTMLElement;
  private raf = 0;
  private tab: TabId = 'dia';

  constructor(app: App) {
    this.app = app;
    this.toggle = button('</>', 'debug-toggle', () => this.togglePanel());
    this.fps = el('div', { class: 'dbg-fps', text: 'FPS —' });
  }

  mount(): void {
    document.body.appendChild(this.toggle);
    document.body.appendChild(this.fps);
    // Ojo: el panel NO se repinta solo mientras hay una partida montada. Si lo
    // hiciera, los botones se moverian bajo el dedo justo cuando el juego
    // termina. Las acciones de debug ya llaman a refresh() ellas mismas.
    this.app.onChange(() => {
      if (this.app.playScreen) return;
      this.refresh();
    });
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
      // El panel esta anclado abajo y tapaba su propio boton: solo se ve
      // cuando esta cerrado.
      this.toggle.style.display = '';
      return;
    }
    this.panel = el('div', { class: 'debug-panel' });
    this.toggle.style.display = 'none';
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
        el('div', { class: 'debug-panel__day', text: app.dayKey }),
        button('✕', 'debug-panel__close', () => this.togglePanel()),
      ]),
    );

    panel.appendChild(
      el(
        'div',
        { class: 'debug-tabs' },
        TABS.map((tab) =>
          button(tab.label, `debug-tab${this.tab === tab.id ? ' is-on' : ''}`, () => {
            this.tab = tab.id;
            this.refresh();
          }),
        ),
      ),
    );

    const body = el('div', { class: 'debug-panel__body' });
    switch (this.tab) {
      case 'dia':
        body.append(this.groupDay(), this.groupUnlocks());
        break;
      case 'intentos':
        body.append(this.groupAttempts(), this.groupScore());
        break;
      case 'rivales':
        body.append(this.groupRivals());
        break;
      case 'juegos':
        body.append(this.groupLaunch(), this.groupMutators());
        break;
      case 'grupo':
        body.append(this.groupNetwork());
        break;
      case 'metricas':
        body.append(this.groupMetrics());
        break;
      case 'estado':
        body.append(this.groupState(), this.groupSave());
        break;
    }
    panel.appendChild(body);
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

  /** Conexion, grupo y el interruptor para volver a los bots simulados. */
  private groupNetwork(): HTMLElement {
    const app = this.app;
    const snapshot = app.snapshot;
    const account = app.save.get().account;

    const rows: HTMLElement[] = [
      el('div', { class: 'dbg-kv' }, [
        el('b', { text: 'modo' }),
        el('span', { text: `${account.mode}${app.forceBots ? ' (bots forzados)' : ''}` }),
        el('b', { text: 'red' }),
        el('span', { text: `${app.netStatus} · ${app.sync.pendingCount} en cola` }),
        el('b', { text: 'grupo' }),
        el('span', { text: account.groupCode ?? '—' }),
        el('b', { text: 'jugador' }),
        el('span', { text: account.playerId?.slice(0, 8) ?? '—' }),
        el('b', { text: 'dia servidor' }),
        el('span', { text: snapshot?.day ?? '—' }),
        el('b', { text: 'miembros' }),
        el('span', {
          text: snapshot
            ? snapshot.members
                .map((m) => `${m.name}${m.online ? '*' : ''}${m.completedDaily ? '✓' : ''}`)
                .join(' ')
            : '—',
        }),
        el('b', { text: 'secreto' }),
        el('span', {
          text: snapshot
            ? `${snapshot.secret.readyCount}/${snapshot.secret.activeCount} activos${
                snapshot.secret.unlocked ? ' · ABIERTO' : ''
              }`
            : '—',
        }),
      ]),
    ];

    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: 'GRUPO Y CONEXION' }),
      ...rows,
      el('div', { class: 'dbg-row', style: { marginTop: '6px' } }, [
        button(app.forceBots ? 'RIVALES SIMULADOS ✓' : 'USAR RIVALES SIMULADOS', `dbg-btn${app.forceBots ? ' is-on' : ''}`, () => {
          app.forceBots = !app.forceBots;
          app.refresh();
          this.refresh();
        }),
        button('FORZAR SYNC', 'dbg-btn', () => {
          void app.sync.refresh();
          void app.sync.flush();
          this.refresh();
        }),
        button('SALIR DEL GRUPO', 'dbg-btn dbg-btn--danger', () => {
          app.leaveGroup();
          this.togglePanel();
        }),
      ]),
    ]);
  }

  /** La pestana que dice si esto engancha o no. */
  private groupMetrics(): HTMLElement {
    const app = this.app;
    const metrics = app.telemetry.metrics();
    const pct = (value: number | null) => formatPercent(value);

    const kv = el('div', { class: 'dbg-kv' }, [
      el('b', { text: 'REVENGE RATE' }),
      el('span', {
        text: `${pct(metrics.revengeRate)}  (${metrics.revengeClicked}/${metrics.revengeAvailable})`,
      }),
      el('b', { text: 'sesiones' }),
      el('span', { text: String(metrics.sessions) }),
      el('b', { text: 'partidas' }),
      el('span', {
        text: `${metrics.gamesStarted} iniciadas · ${metrics.gamesFinished} terminadas · ${metrics.gamesAbandoned} abandonadas`,
      }),
      el('b', { text: 'intentos' }),
      el('span', {
        text: `${metrics.attemptsUsed}/${metrics.attemptsAvailable} (${pct(metrics.attemptUtilization)})`,
      }),
      el('b', { text: 'dias completos' }),
      el('span', {
        text: `${metrics.daysCompleted}/${metrics.daysPlayed} (${pct(metrics.dailyCompletion)})`,
      }),
      el('b', { text: 'mejoras' }),
      el('span', { text: String(metrics.scoreImproved) }),
      el('b', { text: 'adelantamientos' }),
      el('span', {
        text: `${metrics.rivalsOvertaken} a favor · ${metrics.timesOvertaken} en contra`,
      }),
      el('b', { text: 'vuelta al dia sig.' }),
      el('span', { text: `${metrics.nextDayReturns} (${pct(metrics.nextDayReturnRate)})` }),
      el('b', { text: 'reaccion social' }),
      el('span', {
        text:
          metrics.socialReactionMs === null
            ? '—'
            : `${(metrics.socialReactionMs / 1000).toFixed(1)} s hasta volver a jugar`,
      }),
      el('b', { text: 'secreto' }),
      el('span', { text: String(metrics.secretUnlocks) }),
    ]);

    const buckets = el('div', { class: 'dbg-kv', style: { marginTop: '6px' } }, [
      el('b', { text: 'por diferencia' }),
      el('span', { text: 'revancha ofrecida -> pulsada' }),
      ...metrics.lossBuckets.flatMap((bucket) => [
        el('b', { text: bucket.id }),
        el('span', { text: `${bucket.clicked}/${bucket.available} (${pct(bucket.rate)})` }),
      ]),
    ]);

    const recent = el(
      'div',
      { class: 'dbg-kv', style: { marginTop: '6px' } },
      metrics.recent.slice(0, 12).flatMap((event) => [
        el('b', { text: new Date(event.ts).toLocaleTimeString('es-ES') }),
        el('span', {
          text: `${event.type}${event.gameId ? ` · ${event.gameId}` : ''}${
            event.value !== null && event.value !== undefined ? ` · ${event.value}` : ''
          }`,
        }),
      ]),
    );

    return el('div', { class: 'dbg-group' }, [
      el('div', { class: 'dbg-group__title', text: 'METRICAS DE PRODUCTO' }),
      kv,
      buckets,
      el('div', { class: 'dbg-group__title', style: { marginTop: '8px' }, text: 'ULTIMOS EVENTOS' }),
      recent,
      el('div', { class: 'dbg-row', style: { marginTop: '8px' } }, [
        button('EXPORTAR JSON', 'dbg-btn', async () => {
          const json = app.telemetry.exportJson();
          console.log(json);
          try {
            await navigator.clipboard.writeText(json);
            app.toaster.show('METRICAS COPIADAS AL PORTAPAPELES', 'good', 2200);
          } catch {
            app.toaster.show('METRICAS VOLCADAS EN CONSOLA', 'neutral', 2200);
          }
        }),
        button('ENVIAR AL SERVIDOR', 'dbg-btn', () => {
          void app.telemetry.flush();
          app.toaster.show('TELEMETRIA ENVIADA', 'neutral', 1800);
        }),
        button('BORRAR METRICAS', 'dbg-btn dbg-btn--danger', () => {
          app.telemetry.clear();
          this.refresh();
        }),
      ]),
    ]);
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
