/**
 * Pantalla de partida: cuenta atras, HUD, pausa y resultado.
 *
 * Se mantiene viva entre intentos: pulsar REVANCHA no desmonta nada, solo
 * reinicia el juego. Por eso la revancha es instantanea.
 */
import type { GameConfig, GameResult, HudInfo } from '../game/contract';
import { GameHost, type FramePerf } from '../game/host';
import { requireGame } from '../game/registry';
import { GHOST_SAMPLE_MS, decodeTrace, encodeTrace } from '../net/ghost';
import type { ChallengeSpec } from '../meta/daily';
import { formatScore } from '../meta/ranking';
import type { ScoreOutcome } from '../meta/scoring';
import type { App } from './app';
import { button, el } from './dom';
import { iconButton } from './icons';
import { emergerResultado } from './transicion';
import { celebrate, renderResult } from './result';
import { renderDecision } from './apuesta';

interface Hud {
  score: HTMLElement;
  time: HTMLElement;
  bar: HTMLElement;
  lives: HTMLElement;
  combo: HTMLElement;
  ghost: HTMLElement;
  /** Marca a batir del rival y cuanto falta. */
  target: HTMLElement;
}

/**
 * La cuenta atras aprieta segun baja: "3" es neutro, "1" ya tiñe de coral -el
 * mismo color de tension que el resto de cuentas atras de la app-, y "¡YA!"
 * es el impacto, tratado como un trofeo (degradado dorado, no solo color).
 */
function claseCuentaAtras(texto: string): string {
  if (texto === '¡YA!') return ' countdown__num--ya';
  if (texto === '1') return ' countdown__num--apura';
  return '';
}

/**
 * Secreto y CHAOS tienen su propia puesta en escena durante la partida, no
 * solo en la tarjeta de portada: un tinte distinto en la franja del HUD para
 * que "esto es diferente" se siga sintiendo mientras se juega, no solo antes
 * de entrar.
 */
function claseEscena(kind: ChallengeSpec['kind']): string {
  if (kind === 'chaos') return 'play--chaos';
  if (kind === 'secret') return 'play--secreto';
  return '';
}

export class PlayScreen {
  private app: App;
  private spec: ChallengeSpec;
  private config: GameConfig;

  private root: HTMLElement;
  private stage: HTMLElement;
  private hud: Hud;
  private overlay: HTMLElement | null = null;
  private hudNode: HTMLElement;
  private host: GameHost;
  private insetObserver: ResizeObserver | null = null;

  private ghostPassed = false;
  private targetPassed = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastScore = 0;
  /** Puntuacion previa a la apuesta, si se gasto la ficha en este reto. */
  private apuestaAntes: number | null = null;
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
      target: el('div', { class: 'hud__target' }),
    };

    const hudNode = el('div', { class: 'hud' }, [
      el('div', { class: 'hud__top' }, [
        el('div', {}, [el('div', { class: 'hud__label', text: 'PUNTOS' }), this.hud.score]),
        el('div', { class: 'hud__right' }, [
          el('div', { class: 'hud__label', text: 'TIEMPO' }),
          this.hud.time,
          this.hud.lives,
        ]),
        iconButton('pausa', 'Pausa', 'icon-btn hud__exit', () => this.pause()),
      ]),
      el('div', { class: 'hud__bar' }, [this.hud.bar]),
    ]);

    this.hudNode = hudNode;
    // El HUD toma el color del juego que se esta jugando: la puntuacion y la
    // barra de tiempo salen del acento del reto, asi que PULSE y DRIFT no se
    // ven igual ni siquiera en la franja de arriba. Es identidad por juego sin
    // tocar nada del juego.
    const acento = requireGame(spec.gameId).meta.accent;
    this.root = el('div', { class: `play ${claseEscena(spec.kind)}`.trim(), style: { '--accent': acento } }, [
      this.stage,
      hudNode,
      this.hud.combo,
      this.hud.target,
      this.hud.ghost,
    ]);

    this.host = new GameHost({
      container: this.stage,
      audio: app.audio,
      haptics: app.haptics,
      reducedMotion: app.quieto,
      onHud: (info) => this.paintHud(info),
      onFinish: (result, _game, perf) => this.handleFinish(result, perf),
      onMilestone: (text, tone) => app.toaster.show(text, tone === 'good' ? 'good' : 'bad', 1400),
      onGhostPassed: (labelText) => {
        this.ghostPassed = true;
        this.hud.ghost.classList.add('is-passed');
        this.hud.ghost.textContent = `👻 SUPERADO: ${labelText}`;
        // Sin la marca de tiempo: la chapa de abajo ya la ensena, y las dos
        // frases completas a la vez decian lo mismo dos veces.
        app.toaster.show('👻 HAS PASADO AL RIVAL', 'good', 1800);
      },
      onAutoPause: () => this.showPause(),
    });
  }

  mount(): void {
    document.body.appendChild(this.root);
    this.measureInsets();
    if (typeof ResizeObserver !== 'undefined') {
      this.insetObserver = new ResizeObserver(() => this.measureInsets());
      this.insetObserver.observe(this.hudNode);
    }
  }

  /**
   * El HUD es DOM y flota encima del canvas: los juegos tienen que saber que
   * franja NO pueden usar. Se mide de verdad, no se estima.
   */
  private measureInsets(): void {
    const top = Math.round(this.hudNode.getBoundingClientRect().height);
    // La altura del HUD se publica como variable para que nada se coloque
    // encima a ojo. El combo iba a "safe-top + 74px" y el toaster a
    // "safe-top + 12px": los dos numeros eran estimaciones y los dos caian
    // dentro del HUD, asi que el combo se pintaba sobre la barra de tiempo y
    // los avisos sobre la puntuacion. Aqui la altura esta MEDIDA.
    document.documentElement.style.setProperty('--hud-alto', `${top}px`);
    const ghostVisible = this.hud.ghost.style.display !== 'none' && this.hud.ghost.textContent !== '';
    const bottom = ghostVisible ? Math.round(this.hud.ghost.getBoundingClientRect().height) + 26 : 16;
    this.host.setInsets(top + 4, bottom);
  }

  /** Cambiar de reto sin desmontar (usado al encadenar partidas). */
  reconfigure(spec: ChallengeSpec, config: GameConfig): void {
    this.spec = spec;
    this.config = config;
    // Sin esto, encadenar de un reto a otro se quedaba con el color -y la
    // puesta en escena de secreto/CHAOS- del reto anterior: el HUD nunca se
    // reconstruye entero, asi que nadie mas se acuerda de refrescarlo.
    this.root.style.setProperty('--accent', requireGame(spec.gameId).meta.accent);
    this.root.classList.remove('play--chaos', 'play--secreto');
    const clase = claseEscena(spec.kind);
    if (clase) this.root.classList.add(clase);
  }

  /** Arranca un intento. quick = revancha (cuenta atras corta). */
  beginRun(options: { quick?: boolean } = {}): void {
    this.clearTimers();
    this.clearOverlay();
    this.root.classList.remove('play--resultado');
    this.finished = false;
    this.ghostPassed = false;
    this.targetPassed = false;
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

    if (this.config.targetName && this.config.targetScore) {
      this.hud.target.textContent = `🎯 ${this.config.targetName} · ${formatScore(this.config.targetScore)}`;
      this.hud.target.style.display = '';
      this.hud.target.classList.remove('is-passed');
    } else {
      this.hud.target.style.display = 'none';
    }

    this.measureInsets();
    // La traza del rival se descarga mientras corre la cuenta atras: cuando
    // empieza la partida ya esta, y si no llega se juega con la marca de
    // siempre. Nunca se espera por la red.
    void this.loadRemoteGhost();

    this.runCountdown(options.quick ?? false);
  }

  private runCountdown(quick: boolean): void {
    const definition = requireGame(this.spec.gameId);
    const meta = definition.meta;
    const numberNode = el('div', {
      class: `countdown__num${claseCuentaAtras(quick ? '¡YA!' : '3')}`,
      text: quick ? '¡YA!' : '3',
    });

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
    // CHAOS tiene su propio sonido -ya existia en el sintetizador, pero nadie
    // lo llamaba todavia- y un golpe fisico al entrar: es el unico reto del
    // dia que dice "solo hay una oportunidad", y eso se anuncia, no se cuenta.
    if (this.spec.kind === 'chaos') {
      this.app.audio.play('chaos');
      this.app.haptics.fire('heavy');
    }

    const advance = () => {
      index++;
      if (index >= steps.length) {
        overlay.remove();
        this.overlay = null;
        this.startedAt = performance.now();
        this.host.start();
        return;
      }
      const texto = steps[index] as string;
      numberNode.textContent = texto;
      numberNode.className = `countdown__num${claseCuentaAtras(texto)}`;
      numberNode.style.animation = 'none';
      void numberNode.offsetWidth;
      numberNode.style.animation = '';
      this.app.audio.play(index === steps.length - 1 ? 'go' : 'countdown');
      this.timers.push(setTimeout(advance, stepMs));
    };
    this.timers.push(setTimeout(advance, stepMs));
  }

  /** Baja la traza real del rival, si existe, y la mete en la config. */
  private async loadRemoteGhost(): Promise<void> {
    const ghost = this.config.ghost;
    if (!ghost || !this.app.isGroup) return;
    const remote = await this.app.sync.fetchGhost(ghost.rivalId, this.spec.gameId, this.app.dayKey);
    if (!remote || !remote.trace) return;
    const samples = decodeTrace(remote.trace);
    if (samples.length < 3) return;
    this.config.ghost = {
      ...ghost,
      rivalName: remote.playerName || ghost.rivalName,
      value: remote.durationMs,
      score: remote.score,
      samples,
      sampleMs: GHOST_SAMPLE_MS,
    };
    this.hud.ghost.textContent = `👻 ${this.config.ghost.rivalName} · ${(
      remote.durationMs / 1000
    ).toFixed(1)} s`;
    this.hud.ghost.style.display = '';
  }

  /** Traza de la partida recien jugada, lista para subir. */
  takeGhostTrace(): { trace: string; durationMs: number } | null {
    const game = this.host.game;
    const recording = game?.recording?.();
    if (!recording || recording.samples.length < 3) return null;
    return {
      trace: encodeTrace(recording.samples),
      durationMs: Math.round(recording.samples.length * recording.sampleMs),
    };
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
    // Los ultimos tres segundos aprietan mas fuerte que los cinco de aviso:
    // el mismo cambio de ritmo que DOBLE O NADA en su propia cuenta atras.
    this.hud.time.classList.toggle('is-critical', seconds <= 3);
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
      const texto = `COMBO x${info.combo}`;
      if (this.hud.combo.textContent !== texto) {
        // Cada eslabon nuevo golpea, no solo aparece: sin esto pasar de x3 a
        // x4 era un cambio de texto silencioso dentro de la misma chapa.
        this.hud.combo.textContent = texto;
        this.hud.combo.classList.remove('is-punch');
        void this.hud.combo.offsetWidth;
        this.hud.combo.classList.add('is-punch');
        // Tambien existia sin usarse: el "clac" propio de encadenar, aparte
        // del sonido de cada acierto suelto que ya pone el juego.
        this.app.audio.play('combo');
      }
      this.hud.combo.classList.add('is-on');
    } else {
      this.hud.combo.classList.remove('is-on');
    }

    const target = this.config.targetScore;
    if (target && target > 0) {
      if (score >= target && !this.targetPassed) {
        this.targetPassed = true;
        this.hud.target.classList.add('is-passed');
        this.hud.target.textContent = `🔥 ${this.config.targetName} SUPERADO`;
        this.host.fx.flash('#7cf3c0', 0.28);
        this.host.fx.shake(0.4);
        this.app.audio.play('overtake');
        this.app.haptics.fire('success');
      } else if (!this.targetPassed) {
        this.hud.target.textContent = `🎯 ${this.config.targetName} · TE FALTAN ${formatScore(
          target - score,
        )}`;
      }
    }

    if (info.ghostProgress !== null && this.config.ghost && !this.ghostPassed) {
      const pct = Math.round(Math.min(1, info.ghostProgress) * 100);
      this.hud.ghost.textContent = `👻 ${this.config.ghost.rivalName} · ${(
        this.config.ghost.value / 1000
      ).toFixed(1)} s · ${pct}%`;
    }
  }

  private handleFinish(result: GameResult, perf: FramePerf): void {
    if (this.finished) return;
    this.finished = true;
    const outcome = this.app.finishRun(this.spec, result, this.ghostPassed, perf);
    celebrate(this.app, outcome);
    this.showResult(outcome, result);
  }

  private showResult(outcome: ScoreOutcome, result: GameResult): void {
    this.clearOverlay();
    const gap = outcome.challengeTarget && !outcome.challengeTarget.entry.isMe
      ? outcome.challengeTarget.gap
      : 0;
    const rival = outcome.challengeTarget?.entry.name ?? null;
    const rivalTotal = outcome.challengeTarget?.entry.total ?? 0;
    const marginPct = rivalTotal > 0 ? Math.round((gap / rivalTotal) * 1000) / 10 : null;
    if (outcome.attemptsLeft > 0 && gap > 0) {
      this.app.offerRevenge(`result:${this.spec.id}:${outcome.score}`, gap, rival, this.spec.gameId, marginPct);
    }

    // DOBLE O NADA: solo si le queda la ficha del dia y el reto cuenta.
    let apuesta: HTMLElement | null = null;
    if (this.app.puedeApostar(this.spec, outcome)) {
      this.app.telemetry.track('bet_offered', {
        gameId: this.spec.gameId,
        value: outcome.score,
        meta: { challengeId: this.spec.id },
      });
      apuesta = renderDecision(
        { puntuacion: outcome.score, audio: this.app.audio, haptics: this.app.haptics },
        {
          onGuardar: () => {
            // Guardar tambien es una decision: se quita el panel para que
            // quede claro que ya esta tomada, pero la ficha NO se gasta.
            apuesta?.remove();
          },
          onResuelta: (resultado) => {
            this.app.telemetry.track('bet_taken', {
              gameId: this.spec.gameId,
              meta: { challengeId: this.spec.id },
            });
            // El puesto ANTES de aplicar la apuesta: es la referencia para
            // saber a quien has adelantado o quien te ha pasado.
            const antes = this.app.leaderboard().standings.findIndex((e) => e.isMe) + 1;
            // La marca ANTES de la apuesta, para que el poster pueda contar la
            // historia entera ("814 -> 1.628") y no solo el desenlace.
            this.apuestaAntes = outcome.score;
            this.app.resolverApuesta(this.spec, resultado.gana, resultado.puntuacionFinal);
            this.mostrarDesenlaceApuesta(
              resultado.gana,
              resultado.puntuacionFinal,
              resultado.diferencia,
              antes,
            );
          },
        },
      );
    }

    const racha = this.app.streak;
    const siguiente = this.app.siguienteReto(this.spec);
    const node = renderResult(
      this.spec,
      outcome,
      result,
      {
        onRematch: () => {
          this.app.audio.play('select');
          this.app.rematch(this.spec, { gap, rival: rival ?? undefined, marginPct });
        },
        onContinue: () => {
          this.app.audio.play('back');
          this.app.exitToHome();
        },
        // Encadenar sin pasar por la portada: al acabar un reto lo natural es
        // meterse en el siguiente, y obligar a volver a la lista rompe ese
        // impulso. La pantalla de partida se reconfigura, no se remonta.
        onSiguiente: siguiente
          ? () => {
              this.app.audio.play('select');
              this.app.encadenar(siguiente);
            }
          : null,
        siguienteNombre: siguiente?.gameName ?? null,
      },
      {
        group: this.app.isGroup,
        myName: this.app.save.get().profile.name,
        apuesta,
        apuestaResultado:
          this.app.save.get().days[this.app.dayKey]?.challenges[this.spec.id]?.apuesta ?? null,
        apuestaAntes: this.apuestaAntes,
        // Solo si la racha es SUYA: presumir de la racha de otro no tiene
        // ninguna gracia.
        racha: racha.holderId === 'me' ? racha.days : 0,
        ghostRival: this.config.ghost?.rivalName ?? null,
        codigoGrupo: this.app.save.get().account.groupCode,
        onAviso: (texto) => this.app.toaster.show(texto, 'good', 2200),
        onCompartir: (resultado) => {
          this.app.telemetry.track('share_attempted', { gameId: this.spec.gameId, meta: { resultado } });
          // Cancelar el menu del sistema es una decision, no un intento fallido
          // (ver compartir.ts): entra en 'attempted' pero no aqui.
          if (resultado === 'cancelado' || resultado === 'fallo') return;
          this.app.telemetry.track('share_completed', { gameId: this.spec.gameId, meta: { resultado } });
        },
      },
    );
    this.overlay = node;
    this.root.appendChild(node);
    // El resultado sube desde el propio HUD en vez de aparecer de golpe: la
    // arena se queda debajo perdiendo intensidad y la cifra no parpadea entre
    // una pantalla y otra.
    emergerResultado(node, this.app.quieto);
    this.root.classList.add('play--resultado');
  }

  /**
   * Lo que se ve al volver del microdesafio. Tiene que doler o celebrar de
   * verdad: si ganar y perder se sienten igual, la apuesta no significa nada.
   */
  private mostrarDesenlaceApuesta(
    gana: boolean,
    puntuacion: number,
    diferencia: number,
    puestoAnterior: number | null,
  ): void {
    const panel = this.overlay?.querySelector('.apuesta');
    if (!panel) return;
    // El marco se tiñe de coral cuando cae: coral es el color de riesgo/tension
    // en todo el sistema, y el oro se queda reservado para cuando de verdad
    // toca celebrar.
    panel.classList.toggle('apuesta--pierde', !gana);
    const signo = diferencia >= 0 ? '+' : '';
    panel.replaceChildren(
      el('div', { class: `apuesta__desenlace apuesta__desenlace--${gana ? 'gana' : 'pierde'}` }, [
        el('div', { class: 'apuesta__desenlace-icono', text: gana ? '🔥' : '💀' }),
        el('div', {
          class: 'apuesta__desenlace-titulo',
          text: gana ? 'DOBLADO' : 'TE LA JUGASTE Y CAYO',
        }),
        el('div', { class: 'apuesta__desenlace-marca num', text: formatScore(puntuacion) }),
        el('div', { class: 'apuesta__desenlace-delta', text: `${signo}${formatScore(diferencia)}` }),
      ]),
    );
    // Los mensajes miran el ranking DESPUES de aplicar la apuesta: lo que
    // importa no es haber doblado, es a quien has adelantado (o quien te ha
    // pasado). Sin esto seria un numero mas; con esto hay historia que contar.
    const board = this.app.leaderboard();
    const yo = board.standings.findIndex((e) => e.isMe);
    const puesto = yo + 1;

    if (gana) {
      this.app.audio.play('victory');
      this.app.audio.play('record');
      this.app.haptics.fire('success');
      const adelantados = puestoAnterior !== null ? puestoAnterior - puesto : 0;
      if (adelantados > 0 && puesto === 1) {
        const segundo = board.standings[1];
        this.app.toaster.show(
          `🔥 TE LA JUGASTE Y LE ROBASTE EL #1 A ${segundo?.name ?? 'TODOS'}`,
          'gold',
          3600,
        );
      } else if (adelantados > 0) {
        this.app.toaster.show(`🔥 DOBLASTE Y ADELANTASTE A ${adelantados}`, 'gold', 3200);
      } else {
        this.app.toaster.show('🔥 HAS DOBLADO', 'gold', 2600);
      }
    } else {
      this.app.haptics.fire('error');
      // Perder el liderato por haber apostado tiene que doler mas que perder
      // sin mas: era tuyo y lo arriesgaste tu.
      if (puestoAnterior === 1 && puesto > 1) {
        const lider = board.standings[0];
        this.app.toaster.show(
          `💀 ARRIESGASTE EL LIDERATO. ${lider?.name ?? 'ALGUIEN'} ACABA DE PASARTE.`,
          'bad',
          4000,
        );
      } else {
        this.app.toaster.show('💀 SE TE HA IDO LA MITAD', 'bad', 2600);
      }
    }
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

  /** Juego en curso (lo usan el panel de debug y las pruebas automatizadas). */
  get game() {
    return this.host.game;
  }

  get isRunning(): boolean {
    return this.host.game?.state === 'playing';
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
    this.root.classList.remove('play--resultado');
    this.insetObserver?.disconnect();
    this.host.destroy();
    this.root.remove();
    document.body.classList.remove('is-playing');
  }
}
