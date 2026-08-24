/**
 * Orquestador. Conoce el save, el dia, el plan, la conexion y las pantallas;
 * nadie mas necesita conocerse entre si.
 *
 * Hay dos modos y el resto del codigo casi no se entera:
 *   - SOLO  : rivales simulados, dia virtual local, cero red.
 *   - GRUPO : personas reales, dia que decide el servidor, sincronizacion.
 */
import { AudioBus } from '../core/audio';
import { GameClock } from '../core/clock';
import { Haptics } from '../core/haptics';
import { seedFrom } from '../core/rng';
import { SaveManager, type PendingScore } from '../core/save';
import type { GameConfig, GameResult } from '../game/contract';
import type { FramePerf } from '../game/host';
import { resolveMutators } from '../game/mutators';
import { getGame, requireGame } from '../game/registry';
import { attemptsLeft, beginAttempt, canPlay, refundAttempt } from '../meta/attempts';
import { buildDailyPlan, findChallenge, type ChallengeSpec, type DailyPlan } from '../meta/daily';
import { myBestFor, remoteStandings } from '../meta/contenders';
import { buildLeaderboard, type RankingContext, type Standing } from '../meta/ranking';
import { commitResult, type ScoreOutcome } from '../meta/scoring';
import { evaluateSecretUnlock, isChaosEnabled, secretStatus, type SecretStatus } from '../meta/secret';
import {
  detectOvertakes,
  markOvertakesSeen,
  rememberTotals,
  type OvertakeEvent,
} from '../meta/social';
import { computeStreak, resolveDay, resolvePendingDays, type StreakInfo } from '../meta/streaks';
import { buildGameConfig } from '../meta/session';
import { Telemetry } from '../meta/telemetry';
import { SyncEngine, type NetStatus } from '../net/sync';
import type { GroupSnapshot } from '../net/types';
import { watchForUpdate } from '../core/updateWatcher';
import { renderHome } from './home';
import { duracionBoot } from './boot';
import { mostrarSorteo } from './reveal';
import { expandirTarjeta } from './transicion';
import { renderOnboarding } from './onboarding';
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
  readonly sync: SyncEngine;
  readonly telemetry: Telemetry;

  plan!: DailyPlan;
  debugMode = false;
  /** Debug: si esta puesto, sustituye a los mutadores del reto. */
  mutatorOverride: string[] | null = null;
  /** Debug: forzar rivales simulados aunque estemos en un grupo real. */
  forceBots = false;
  /** Adelantamiento pendiente de contestar (alimenta el boton de REVANCHA). */
  pendingOvertake: OvertakeEvent | null = null;
  /** Hay una build nueva en el servidor. Se ensena en portada, nunca a mitad de partida. */
  updateAvailable = false;

  private shell: HTMLElement;
  private play: PlayScreen | null = null;
  private onChangeListeners: (() => void)[] = [];
  private screen: 'onboarding' | 'home' | 'external' = 'home';

  constructor(root: HTMLElement, save = new SaveManager(), sync?: SyncEngine) {
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
    this.sync = sync ?? new SyncEngine(save);
    this.telemetry = new Telemetry(save, {
      day: () => this.dayKey,
      gameVersion: (gameId) => getGame(gameId)?.meta.version ?? 1,
      isTest: () => this.debugMode,
      send: (events) =>
        this.sync.sendTelemetry(
          events.map((event) => ({
            type: event.type,
            ts: event.ts,
            day: event.day,
            gameId: event.gameId ?? null,
            gameVersion: event.gameVersion ?? null,
            value: event.value ?? null,
            meta: event.meta ?? null,
            isTest: event.isTest ?? false,
          })),
        ),
    });

    this.shell = el('div', { class: 'shell' });
    clear(root);
    root.appendChild(this.shell);
  }

  /* ---------------- modo y dia ---------------- */

  get mode(): 'none' | 'solo' | 'group' {
    return this.save.get().account.mode;
  }

  get isGroup(): boolean {
    return this.mode === 'group' && !this.forceBots;
  }

  get snapshot(): GroupSnapshot | null {
    return this.forceBots ? null : this.sync.snapshot;
  }

  get netStatus(): NetStatus {
    return this.sync.status;
  }

  /**
   * En grupo manda el dia del servidor (si no, bastaria con cambiar la hora
   * del movil para tener intentos nuevos). Sin conexion se usa el ultimo dia
   * conocido; en solitario, el dia virtual local.
   */
  get dayKey(): string {
    if (this.mode === 'group') {
      return this.sync.snapshot?.day ?? this.save.get().snapshot?.day ?? this.clock.realDayKey();
    }
    return this.clock.todayKey();
  }

  get secretUnlocked(): boolean {
    if (this.isGroup && this.snapshot) return this.snapshot.secret.unlocked;
    return Boolean(this.save.get().days[this.dayKey]?.secretUnlocked);
  }

  get chaosEnabled(): boolean {
    return isChaosEnabled(this.save, this.dayKey);
  }

  get streak(): StreakInfo {
    // En grupo no inventamos ganadores de dias que no vimos.
    return computeStreak(this.save, this.dayKey, 30, { simulate: !this.isGroup });
  }

  /**
   * Si hay que moverse poco.
   *
   * Es la preferencia guardada O la del sistema, no solo la guardada. El campo
   * del save vale false por defecto, y como se pasaba tal cual acababa
   * ANULANDO el "reducir movimiento" de iOS: quien lo tuviera puesto veia
   * todas las animaciones igual. Y al empezar de cero, sin esto, le pasaria a
   * todo el mundo a la vez.
   *
   * Suma en vez de elegir: si el sistema pide calma, se respeta aunque el save
   * diga lo contrario. Reducir de mas nunca hace dano; reducir de menos si.
   */
  get quieto(): boolean {
    if (this.save.get().prefs.reducedMotion) return true;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Estado del reto secreto, real o simulado segun el modo. */
  secretInfo(): SecretStatus {
    if (this.isGroup && this.snapshot) {
      const secret = this.snapshot.secret;
      return {
        unlocked: secret.unlocked,
        done: secret.readyCount,
        // Los que HACEN FALTA, no los que hay conectados: con veinticinco
        // personas "3 de 25" desanima y ademas no es verdad, porque el
        // secreto se abre con el umbral.
        total: Math.max(1, secret.neededCount ?? secret.activeCount),
        missing: secret.missing,
        meDone: !secret.missing.includes(this.save.get().profile.name),
      };
    }
    return secretStatus(this.save, this.plan);
  }

  /* ---------------- ranking ---------------- */

  get rankingContext(): RankingContext {
    if (!this.isGroup || !this.snapshot) return {};
    const snapshot = this.snapshot;
    const myId = this.sync.playerId;
    return {
      others: remoteStandings(snapshot, myId, this.plan, this.secretUnlocked),
      myBest: (challengeId) => myBestFor(this.save, this.dayKey, challengeId, snapshot, myId),
    };
  }

  leaderboard() {
    return buildLeaderboard(this.plan, this.save, this.secretUnlocked, this.rankingContext);
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

    this.sync.on('snapshot', (snapshot) => this.handleSnapshot(snapshot));
    this.sync.on('status', () => this.notify());
    this.sync.on('dropped', ({ pending, reason }) => {
      this.telemetry.track('sync_dropped', { gameId: pending.gameId, meta: { reason } });
      this.toaster.show(`NO SE PUDO SUBIR UNA MARCA (${reason})`, 'bad', 3200);
    });
    // Funciona en solo y en grupo: una build nueva no depende de tener sesion.
    watchForUpdate(() => {
      this.updateAvailable = true;
      if (this.screen === 'home' && !this.play) this.renderHome();
    });

    if (this.mode === 'none') {
      this.renderOnboarding();
      return;
    }
    if (this.mode === 'group') this.sync.start();
    this.telemetry.track('app_open');
    this.renderHome();
    this.quizaSortear();
  }

  /**
   * Le dice a la app que ha dejado de pintar la pantalla: algo de fuera se ha
   * hecho cargo de `root` (hoy, solo el dashboard de solo lectura).
   *
   * Sin esto, el temporizador del sorteo -que solo comprueba si sigue en
   * 'home'- lo pinta ENCIMA del dashboard al cabo de un segundo, aunque quien
   * pidio ?dashboard nunca vaya a jugar desde ahi: 'home' seguia siendo cierto
   * porque nada dentro de la app sabe que main.ts ha limpiado root por su
   * cuenta. Se vio con una captura de pantalla real, no con un test: los
   * checks que leen el DOM justo despues de montar van mas rapido que el
   * propio temporizador y no lo pillan.
   */
  markExternal(): void {
    this.screen = 'external';
  }

  /**
   * El sorteo de los retos del dia, la primera vez que se abre cada dia.
   *
   * Publico (y no privado como el resto de "quiza-algo" de este fichero)
   * porque `boot()` no es el unico sitio donde alguien puede aterrizar en
   * home por primera vez en el dia: crear grupo, unirse o "probar solo" desde
   * el onboarding tambien lo son, y sin esto su primer dia -el que mas
   * importa enganchar- no tenia sorteo en absoluto.
   *
   * Se pinta ENCIMA de la portada, no en vez de ella: si alguien lo salta al
   * instante se encuentra la pantalla ya montada debajo, sin un fotograma en
   * blanco. La marca se guarda antes de ensenarlo y no despues, para que
   * cerrar la app a medias no lo repita en la siguiente apertura.
   */
  quizaSortear(): void {
    if (this.save.get().days[this.dayKey]?.revealVisto) return;
    const retos = this.plan.challenges;
    if (retos.length === 0) return;

    // save.day() crea el registro si no existe. Leyendo data.days[clave] a
    // pelo, el primer dia -que es justo cuando el sorteo importa- no habria
    // registro todavia, la marca se perderia y el sorteo saldria en cada
    // apertura.
    this.save.update(() => {
      this.save.day(this.dayKey).revealVisto = true;
    });
    this.save.flush();

    const quieto = this.quieto;
    // Se espera a que se quite la marca de apertura. Los dos son overlays que
    // no bloquean, asi que arrancando juntos el sorteo giraba por debajo.
    setTimeout(() => {
      // Si en ese segundo el jugador ya ha entrado a un reto, el sorteo no
      // aparece: nada se cuela encima de una partida empezada.
      if (this.screen !== 'home' || this.play) return;
      mostrarSorteo(retos, () => this.renderHome(), {
        audio: this.audio,
        haptics: this.haptics,
        reducedMotion: quieto,
      });
    }, duracionBoot(quieto) + 120);
  }

  /** Recalcula el plan del dia (tras cambiar el dia virtual o al arrancar). */
  reloadDay(): void {
    this.plan = buildDailyPlan(this.dayKey);
    if (!this.isGroup) {
      resolvePendingDays(this.save, this.dayKey);
      evaluateSecretUnlock(this.save, this.plan);
    }
  }

  renderOnboarding(): void {
    this.screen = 'onboarding';
    document.body.classList.remove('is-playing');
    clear(this.shell);
    this.shell.appendChild(renderOnboarding(this));
  }

  renderHome(): void {
    this.screen = 'home';
    document.body.classList.remove('is-playing');
    clear(this.shell);
    this.shell.appendChild(renderHome(this));
    this.notify();
  }

  refresh(): void {
    this.reloadDay();
    if (this.screen === 'onboarding') return;
    if (!this.play) this.renderHome();
    else this.notify();
  }

  private notify(): void {
    for (const fn of this.onChangeListeners) fn();
  }

  /** El service worker ya sirve la build nueva: recargar es todo lo que hace falta. */
  applyUpdate(): void {
    this.telemetry.track('app_update_applied');
    location.reload();
  }

  /* ---------------- grupo ---------------- */

  async createGroup(name: string): Promise<void> {
    await this.sync.createGroup(name);
    this.telemetry.track('group_created');
    this.telemetry.track('app_open');
    // Aqui NO se va a la portada: el onboarding ensena antes el codigo.
    this.reloadDay();
  }

  async joinGroup(code: string, name: string): Promise<void> {
    await this.sync.joinGroup(code, name);
    this.telemetry.track('group_joined');
    this.telemetry.track('app_open');
    // Al unirse se entra directo: no hay codigo que ensenar ni paso extra.
    this.reloadDay();
    this.renderHome();
    this.quizaSortear();
  }

  playSolo(): void {
    this.sync.playSolo();
    this.telemetry.track('app_open');
    this.reloadDay();
    this.renderHome();
    this.quizaSortear();
  }

  leaveGroup(): void {
    this.sync.reset();
    this.renderOnboarding();
  }

  /**
   * Llega una foto nueva del grupo: se concilia con lo local (el mejor
   * resultado manda, los intentos tambien), se cierra el dia anterior si ha
   * cambiado y se mira si alguien me ha pasado.
   */
  private handleSnapshot(snapshot: GroupSnapshot): void {
    const secretWasLocked = !this.secretUnlocked;
    const previousDay = this.plan?.dayKey;
    if (previousDay && previousDay !== snapshot.day) {
      // Ha cambiado el dia competitivo: cerramos el anterior con lo que sabiamos.
      resolveDay(this.save, previousDay);
      this.plan = buildDailyPlan(snapshot.day);
    }
    this.reconcile(snapshot);

    // El secreto lo abre el grupo entero, asi que la noticia llega por aqui.
    if (secretWasLocked && snapshot.secret.unlocked) {
      this.toaster.show('EL GRUPO HA ABIERTO EL RETO SECRETO', 'gold', 3600);
      this.audio.play('unlock');
      this.haptics.fire('success');
      this.telemetry.track('secret_unlocked');
    }

    this.detectSocialEvents();
    if (this.screen === 'home' && !this.play) this.renderHome();
    else this.notify();
  }

  /** El servidor es la verdad de lo compartido; el movil no pierde lo suyo. */
  private reconcile(snapshot: GroupSnapshot): void {
    const myId = this.sync.playerId;
    if (!myId) return;
    this.save.update(() => {
      for (const row of snapshot.scores) {
        if (row.playerId !== myId) continue;
        const progress = this.save.challenge(snapshot.day, row.challengeId);
        progress.bestScore = Math.max(progress.bestScore, row.bestScore);
        progress.attemptsUsed = Math.max(progress.attemptsUsed, row.attemptsUsed);
        progress.plays = Math.max(progress.plays, row.plays);
      }
      if (snapshot.secret.unlocked) this.save.day(snapshot.day).secretUnlocked = true;
    });
  }

  private detectSocialEvents(): void {
    if (!this.isGroup) return;
    const board = this.leaderboard();
    const data = this.save.get();
    const events = detectOvertakes({
      dayKey: this.dayKey,
      standings: board.standings,
      previous: data.social.lastTotals[this.dayKey],
      seen: data.social.seenOvertakes,
    });
    rememberTotals(this.save, this.dayKey, board.standings);

    if (events.length === 0) return;
    markOvertakesSeen(
      this.save,
      events.map((event) => event.key),
    );
    const worst = events[0] as OvertakeEvent;
    this.pendingOvertake = worst;
    this.telemetry.track('player_was_overtaken', { value: worst.gap, meta: { rival: worst.rivalName } });
    this.audio.play('defeat');
    this.haptics.fire('error');
    this.toaster.show(`🔥 ${worst.rivalName} TE HA SUPERADO POR ${worst.gap}`, 'bad', 3600);
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
  startChallenge(
    spec: ChallengeSpec,
    options: {
      quick?: boolean;
      ignoreAttempts?: boolean;
      revenge?: boolean;
      /** La tarjeta pulsada, para que crezca hasta convertirse en el juego. */
      desde?: HTMLElement | null;
    } = {},
  ): void {
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

    const config = this.applyOverride(
      buildGameConfig(this.plan, spec, this.save, this.rankingContext),
      spec,
    );
    this.telemetry.track('game_start', {
      gameId: spec.gameId,
      meta: { challengeId: spec.id, revenge: options.revenge === true },
    });

    const arrancar = () => {
      if (!this.play) {
        this.play = new PlayScreen(this, spec, config);
        this.play.mount();
        document.body.classList.add('is-playing');
      } else {
        this.play.reconfigure(spec, config);
      }
      this.play.beginRun({ quick: options.quick ?? false });
      this.notify();
    };

    // La tarjeta crece hasta llenar la pantalla, pero la partida arranca DENTRO
    // de expandirTarjeta y no despues: la animacion acompana, no retiene.
    expandirTarjeta(
      options.desde ?? null,
      {
        acento: requireGame(spec.gameId).meta.accent,
        titulo: spec.gameName,
        reducedMotion: this.quieto,
      },
      arrancar,
    );
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
    const plays = this.save.get().days[this.dayKey]?.challenges[`debug-${gameId}`]?.plays ?? 0;
    const spec: ChallengeSpec = {
      id: `debug-${gameId}`,
      index: 99,
      title: 'DEBUG',
      kind: 'daily',
      gameId,
      gameName: definition.meta.name,
      skill: definition.meta.skill,
      seed: seedFrom('debug', this.dayKey, gameId, String(plays)),
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

  /* ---------------- doble o nada ---------------- */

  /**
   * Si le queda la ficha del dia. Una por jugador y dia, se gaste como se
   * gaste: gane o pierda, se consume.
   */
  get tieneFicha(): boolean {
    return !this.save.get().days[this.dayKey]?.apuestaGastada;
  }

  /**
   * Se puede apostar en un reto si queda ficha y ese reto cuenta para el
   * ranking. En el CHAOS no: puntua aparte, doblar alli no cambia nada de lo
   * que importa y solo confundiria.
   */
  puedeApostar(spec: ChallengeSpec, outcome: ScoreOutcome): boolean {
    if (!this.tieneFicha) return false;
    if (spec.countsForRanking === false) return false;
    // Sin puntos no hay nada que doblar ni que perder.
    return outcome.score > 0;
  }

  /**
   * Resuelve la apuesta sobre la marca de ESE reto. No toca los otros dos.
   *
   * La ficha se marca gastada pase lo que pase: es lo que hace que la decision
   * pese. Si solo se consumiera al perder, apostar seria gratis.
   */
  resolverApuesta(spec: ChallengeSpec, gana: boolean, puntuacionFinal: number): void {
    this.save.update((data) => {
      const dia = this.save.day(this.dayKey);
      dia.apuestaGastada = true;
      const progreso = this.save.challenge(this.dayKey, spec.id);
      progreso.apuesta = gana ? 'doblo' : 'cayo';
      // La marca del reto pasa a ser la apostada, para bien o para mal. Se
      // asigna en vez de usar Math.max a proposito: perder tiene que doler de
      // verdad, y si el mejor de antes sobreviviera no habria riesgo ninguno.
      progreso.bestScore = puntuacionFinal;
      progreso.lastScore = puntuacionFinal;
      // Y se cierra el reto. Esto NO es un detalle: commitResult guarda el
      // mejor de los intentos, asi que si quedaran intentos bastaria con
      // volver a jugar para borrar una apuesta perdida. Apostar seria gratis y
      // no habria riesgo ninguno. Cerrando el reto, la decision pesa: doblas
      // esta marca o sigues intentando mejorarla, pero no las dos cosas.
      progreso.attemptsUsed = spec.attempts;
      void data;
    });
    this.telemetry.track(gana ? 'bet_won' : 'bet_lost', {
      gameId: spec.gameId,
      value: puntuacionFinal,
      meta: { challengeId: spec.id },
    });
    this.save.flush();
    if (this.isGroup) this.reenviarMarca(spec, puntuacionFinal);
    this.notify();
  }

  /** Sube la marca ya apostada al grupo, para que el ranking la refleje. */
  private reenviarMarca(spec: ChallengeSpec, puntuacion: number): void {
    const progreso = this.save.get().days[this.dayKey]?.challenges[spec.id];
    this.sync.queueScore({
      attemptId: `${this.sync.playerId ?? 'anon'}-${spec.id}-apuesta-${Date.now().toString(36)}`,
      day: this.dayKey,
      challengeId: spec.id,
      gameId: spec.gameId,
      gameVersion: getGame(spec.gameId)?.meta.version ?? 1,
      isTest: this.debugMode,
      score: puntuacion,
      durationMs: 5000,
      attemptsUsed: progreso?.attemptsUsed ?? 1,
      countsForRanking: spec.countsForRanking,
      ghost: null,
      queuedAt: Date.now(),
      tries: 0,
    });
  }

  /** Revancha: mismo reto, cero menus. */
  rematch(spec: ChallengeSpec, context: { gap?: number; rival?: string; marginPct?: number | null } = {}): void {
    if (!this.canPlay(spec)) {
      this.toaster.show('SIN INTENTOS', 'bad');
      this.audio.play('error');
      return;
    }
    this.telemetry.track('revenge_clicked', {
      gameId: spec.gameId,
      value: context.gap ?? null,
      // marginPct va tambien en el clic, no solo en la oferta: sin el, no se
      // puede saber CUALES de las revanchas ofrecidas por poco margen son las
      // que de verdad se pulsan -"close-loss replay"-, solo cuantas se
      // ofrecieron por poco.
      meta: { rival: context.rival ?? null, challengeId: spec.id, marginPct: context.marginPct ?? null },
    });
    this.pendingOvertake = null;
    this.startChallenge(spec, { quick: true, revenge: true });
  }

  /** El jugador abandona a mitad: se le devuelve el intento si acaba de empezar. */
  abortRun(spec: ChallengeSpec, elapsedMs: number): void {
    if (elapsedMs < 3000) refundAttempt(this.save, this.dayKey, spec);
    this.telemetry.track('game_abandon', { gameId: spec.gameId, value: Math.round(elapsedMs) });
    this.exitToHome();
  }

  finishRun(spec: ChallengeSpec, result: GameResult, ghostPassed: boolean, perf: FramePerf): ScoreOutcome {
    const outcome = commitResult({
      plan: this.plan,
      spec,
      save: this.save,
      result,
      secretUnlocked: this.secretUnlocked,
      ghostPassed,
      context: this.rankingContext,
    });

    this.telemetry.track('game_finish', {
      gameId: spec.gameId,
      value: result.score,
      // attemptsLeftAfter es lo que hace posible el One More Rate: sin saber
      // si a esta partida le quedaba otra oportunidad, no se puede distinguir
      // "termino y no jugo mas porque no quiso" de "termino y no jugo mas
      // porque ya no podia". Ese matiz no se puede reconstruir a posteriori.
      //
      // Las cuatro de perf van en el mismo evento a proposito: son 1 a 1 con
      // esta partida concreta, y separar "cuanto engancha" de "que tal
      // rendia" en dos sitios distintos habria hecho mas dificil cruzarlas
      // luego -que es exactamente para lo que sirven-.
      meta: {
        challengeId: spec.id,
        endedBy: result.endedBy,
        attemptsLeftAfter: attemptsLeft(this.save, this.dayKey, spec),
        frameCount: perf.frameCount,
        slowFrames50: perf.slowFrames50,
        slowFrames100: perf.slowFrames100,
        worstFrameMs: perf.worstFrameMs,
      },
    });
    if (outcome.isChallengeBest) {
      this.telemetry.track('score_improved', { gameId: spec.gameId, value: outcome.gainVsBest });
    }
    for (const passed of outcome.overtook) {
      this.telemetry.track('rival_overtaken', {
        gameId: spec.gameId,
        value: outcome.score,
        meta: { rival: passed.name },
      });
    }

    // A la cola de envio: si hay red sale ahora, y si no, en cuanto vuelva.
    if (this.isGroup && spec.countsForRanking !== undefined) {
      this.queueScore(spec, result, outcome);
    }

    if (!this.isGroup && evaluateSecretUnlock(this.save, this.plan)) {
      this.toaster.show('RETO SECRETO DESBLOQUEADO', 'gold', 3000);
      this.audio.play('unlock');
      this.telemetry.track('secret_unlocked');
    }

    if (this.dailyCompleted()) {
      this.telemetry.track('daily_all_games_completed');
    }

    this.save.flush();
    this.notify();
    return outcome;
  }

  private dailyCompleted(): boolean {
    const day = this.save.get().days[this.dayKey];
    if (!day) return false;
    return this.plan.challenges.every((spec) => (day.challenges[spec.id]?.plays ?? 0) > 0);
  }

  private queueScore(spec: ChallengeSpec, result: GameResult, outcome: ScoreOutcome): void {
    const ghost = this.play?.takeGhostTrace() ?? null;
    const pending: PendingScore = {
      attemptId: `${this.sync.playerId ?? 'anon'}-${spec.id}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      day: this.dayKey,
      challengeId: spec.id,
      gameId: spec.gameId,
      gameVersion: result.gameVersion,
      isTest: this.debugMode,
      score: result.score,
      durationMs: Math.max(1000, Math.round(result.durationMs)),
      attemptsUsed: this.save.get().days[this.dayKey]?.challenges[spec.id]?.attemptsUsed ?? 1,
      countsForRanking: spec.countsForRanking,
      // Solo tiene sentido guardar la traza si es la mejor del dia.
      ghost: ghost && outcome.isChallengeBest ? ghost : null,
      queuedAt: Date.now(),
      tries: 0,
    };
    this.sync.queueScore(pending);
  }

  exitToHome(): void {
    this.play?.destroy();
    this.play = null;
    this.save.flush();
    this.reloadDay();
    this.renderHome();
    if (this.isGroup) void this.sync.refresh();
  }

  /**
   * El siguiente reto del dia que todavia se puede jugar, si queda alguno.
   *
   * Se usa para encadenar sin pasar por la portada: al acabar un reto, lo
   * natural es meterse en el siguiente, y obligar a volver a la lista rompe
   * ese impulso. La portada sigue estando a un boton de distancia.
   */
  siguienteReto(desde: ChallengeSpec): ChallengeSpec | null {
    const orden = this.plan.challenges;
    const indice = orden.findIndex((c) => c.id === desde.id);
    if (indice < 0) return null;
    // Se busca hacia delante y luego se da la vuelta: si acabas el tercero y el
    // primero sigue teniendo intentos, ese es el siguiente.
    for (let i = 1; i <= orden.length; i++) {
      const candidato = orden[(indice + i) % orden.length];
      if (candidato && candidato.id !== desde.id && this.canPlay(candidato)) return candidato;
    }
    return null;
  }

  /**
   * Encadena con otro reto sin desmontar la pantalla de partida.
   *
   * PlayScreen ya sabe reconfigurarse, asi que no hay que crear nada: se
   * reaprovecha el lienzo, el HUD y el audio ya arrancado. Por eso no hay
   * fundido a negro por medio.
   */
  encadenar(spec: ChallengeSpec): void {
    this.startChallenge(spec);
  }

  get playScreen(): PlayScreen | null {
    return this.play;
  }

  private offeredRevenges = new Set<string>();

  /**
   * Se ha ofrecido una revancha. La clave evita contar dos veces la misma
   * oferta cuando la pantalla se repinta: si no, el Revenge Rate mentiria.
   *
   * marginPct (gap / total del rival) va ADEMAS de gap: 100 puntos es todo un
   * mundo en TRAZO y nada en CUENTA, y sin normalizar por juego "perder por
   * poco" no se puede comparar entre los doce.
   */
  offerRevenge(key: string, gap: number, rival: string | null, gameId: string, marginPct: number | null): void {
    if (this.offeredRevenges.has(key)) return;
    this.offeredRevenges.add(key);
    this.telemetry.track('revenge_available', { gameId, value: gap, meta: { rival, marginPct } });
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
    const clean = name.trim().slice(0, 16);
    if (clean.length === 0) return;
    this.save.update((data) => {
      data.profile.name = clean;
    });
    this.save.flush();
    if (this.isGroup) {
      void this.sync.rename(clean).catch(() => {
        this.toaster.show('NO SE HA PODIDO CAMBIAR EL NOMBRE', 'bad');
      });
    }
    this.refresh();
  }

  shiftDay(delta: number): void {
    if (this.isGroup) {
      this.toaster.show('EN GRUPO EL DIA LO MANDA EL SERVIDOR', 'neutral', 2600);
      return;
    }
    this.clock.shift(delta);
    this.save.flush();
    this.exitToHomeIfPlaying();
    this.refresh();
  }

  /** Standing del jugador (atajo para la UI). */
  me(): Standing {
    return this.leaderboard().me;
  }

  private exitToHomeIfPlaying(): void {
    if (this.play) {
      this.play.destroy();
      this.play = null;
      document.body.classList.remove('is-playing');
    }
  }
}
