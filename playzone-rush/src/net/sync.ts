/**
 * Sincronizacion con el grupo.
 *
 * Reglas de la casa:
 *  - jugar nunca depende de la red: si no hay conexion, la partida se guarda
 *    en una cola y se sube cuando vuelve;
 *  - el servidor manda en lo compartido (miembros, marcas, participacion),
 *    el movil manda en lo suyo (identidad, preferencias, cache);
 *  - nada se pierde en silencio: si un envio se descarta, queda registrado.
 */
import { Emitter } from '../core/emitter';
import type { PendingScore, SaveManager } from '../core/save';
import { ApiClient, ApiError, NetworkError } from './client';
import type { GroupSnapshot, RemoteGhost, TelemetryEventPayload } from './types';

export type NetStatus = 'solo' | 'offline' | 'connecting' | 'online' | 'syncing' | 'error';

export interface SyncEvents extends Record<string, unknown> {
  snapshot: GroupSnapshot;
  status: { status: NetStatus; pending: number };
  dropped: { pending: PendingScore; reason: string };
}

const RECONNECT_STEPS = [1000, 2000, 4000, 8000, 15_000, 30_000];
const POLL_INTERVAL = 20_000;

export class SyncEngine extends Emitter<SyncEvents> {
  readonly client: ApiClient;
  private save: SaveManager;
  private source: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private attempt = 0;
  private flushing = false;
  /** Alguien ha pedido enviar mientras ya estabamos enviando. */
  private flushAgain = false;
  private _status: NetStatus = 'offline';
  private _snapshot: GroupSnapshot | null = null;
  private started = false;

  constructor(save: SaveManager, client = new ApiClient()) {
    super();
    this.save = save;
    this.client = client;

    const account = save.get().account;
    if (account.mode === 'group' && account.playerId && account.secret) {
      this.client.setCredentials({
        playerId: account.playerId,
        secret: account.secret,
        name: save.get().profile.name,
        groupCode: account.groupCode ?? '',
      });
    }
    const cached = save.get().snapshot;
    if (cached?.data) this._snapshot = cached.data as GroupSnapshot;
    this._status = account.mode === 'solo' ? 'solo' : 'offline';
  }

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */

  get mode(): 'none' | 'solo' | 'group' {
    return this.save.get().account.mode;
  }

  get isGroup(): boolean {
    return this.mode === 'group' && this.client.hasSession;
  }

  get snapshot(): GroupSnapshot | null {
    return this.isGroup ? this._snapshot : null;
  }

  get status(): NetStatus {
    return this._status;
  }

  get pendingCount(): number {
    return this.save.get().outbox.length;
  }

  get playerId(): string | null {
    return this.save.get().account.playerId;
  }

  /** Dia competitivo: en grupo lo dice el servidor; en solitario, el reloj local. */
  get serverDay(): string | null {
    return this._snapshot?.day ?? null;
  }

  private setStatus(status: NetStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.emit('status', { status, pending: this.pendingCount });
  }

  private applySnapshot(snapshot: GroupSnapshot): void {
    this._snapshot = snapshot;
    this.save.update((data) => {
      data.snapshot = { day: snapshot.day, data: snapshot };
    });
    this.emit('snapshot', snapshot);
  }

  /* ------------------------------------------------------------------ */
  /* Alta                                                                */
  /* ------------------------------------------------------------------ */

  async createGroup(name: string): Promise<GroupSnapshot> {
    const response = await this.client.createGroup(name);
    this.adoptSession(response.player, response.group.code);
    this.applySnapshot(response.snapshot);
    this.start();
    return response.snapshot;
  }

  async joinGroup(code: string, name: string): Promise<GroupSnapshot> {
    const response = await this.client.joinGroup(code.trim().toUpperCase(), name);
    this.adoptSession(response.player, response.group.code);
    this.applySnapshot(response.snapshot);
    this.start();
    return response.snapshot;
  }

  private adoptSession(player: { id: string; name: string; secret: string }, code: string): void {
    this.save.update((data) => {
      data.account = {
        mode: 'group',
        playerId: player.id,
        secret: player.secret,
        groupCode: code,
        joinedAt: Date.now(),
      };
      data.profile.name = player.name;
    });
    this.save.flush();
    this.client.setCredentials({
      playerId: player.id,
      secret: player.secret,
      name: player.name,
      groupCode: code,
    });
  }

  /** Modo solitario: bots, sin backend, todo local. */
  playSolo(): void {
    this.stop();
    this.save.update((data) => {
      data.account = { ...data.account, mode: 'solo' };
    });
    this.save.flush();
    this.setStatus('solo');
  }

  /** Volver a la pantalla de bienvenida (debug / cambiar de grupo). */
  reset(): void {
    this.stop();
    this._snapshot = null;
    this.save.update((data) => {
      data.account = { mode: 'none', playerId: null, secret: null, groupCode: null, joinedAt: 0 };
      data.snapshot = null;
      data.outbox = [];
      data.social = { lastTotals: {}, seenOvertakes: [] };
    });
    this.save.flush();
    this.client.setCredentials(null);
    this.setStatus('offline');
  }

  /* ------------------------------------------------------------------ */
  /* Conexion                                                            */
  /* ------------------------------------------------------------------ */

  start(): void {
    if (!this.isGroup || this.started) return;
    this.started = true;
    this.setStatus('connecting');
    void this.refresh();
    void this.flush();
    this.openStream();
    this.startPolling();

    globalThis.addEventListener?.('online', this.handleOnline);
    globalThis.addEventListener?.('offline', this.handleOffline);
    document?.addEventListener?.('visibilitychange', this.handleVisibility);
  }

  stop(): void {
    this.started = false;
    this.closeStream();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    globalThis.removeEventListener?.('online', this.handleOnline);
    globalThis.removeEventListener?.('offline', this.handleOffline);
    document?.removeEventListener?.('visibilitychange', this.handleVisibility);
  }

  private handleOnline = (): void => {
    this.attempt = 0;
    void this.refresh();
    void this.flush();
    this.openStream();
  };

  private handleOffline = (): void => {
    this.setStatus('offline');
    this.closeStream();
  };

  private handleVisibility = (): void => {
    if (document.hidden) return;
    // Al volver a la app: foto fresca y a vaciar la cola.
    void this.refresh();
    void this.flush();
    if (!this.source) this.openStream();
  };

  private openStream(): void {
    if (!this.isGroup) return;
    if (typeof EventSource === 'undefined') return; // sin SSE nos queda el polling
    this.closeStream();
    const url = this.client.streamUrl();
    if (!url) return;

    const source = new EventSource(url);
    this.source = source;
    source.addEventListener('snapshot', (event) => {
      try {
        this.attempt = 0;
        this.setStatus(this.pendingCount > 0 ? 'syncing' : 'online');
        this.applySnapshot(JSON.parse((event as MessageEvent).data) as GroupSnapshot);
      } catch {
        /* un frame roto no puede tumbar la app */
      }
    });
    source.onopen = () => {
      this.attempt = 0;
      this.setStatus('online');
    };
    source.onerror = () => {
      // El navegador reintenta solo, pero con su propio ritmo: preferimos
      // controlarlo nosotros con backoff y no dejar sockets colgando.
      this.closeStream();
      this.setStatus('offline');
      this.scheduleReconnect();
    };
  }

  private closeStream(): void {
    this.source?.close();
    this.source = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.started) return;
    const step = RECONNECT_STEPS[Math.min(this.attempt, RECONNECT_STEPS.length - 1)] as number;
    this.attempt++;
    // Un poco de aleatoriedad para que cinco moviles no reconecten a la vez.
    const delay = step + Math.random() * 400;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.started) return;
      this.setStatus('connecting');
      void this.refresh();
      this.openStream();
    }, delay);
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    // Red de seguridad: aunque el SSE se caiga sin avisar, cada 20 s miramos.
    this.pollTimer = setInterval(() => {
      if (!this.started) return;
      void this.refresh();
      void this.flush();
    }, POLL_INTERVAL);
  }

  /* ------------------------------------------------------------------ */
  /* Datos                                                               */
  /* ------------------------------------------------------------------ */

  async refresh(): Promise<GroupSnapshot | null> {
    if (!this.isGroup) return null;
    try {
      const snapshot = await this.client.snapshot();
      this.applySnapshot(snapshot);
      this.setStatus(this.pendingCount > 0 ? 'syncing' : 'online');
      return snapshot;
    } catch (error) {
      this.setStatus(error instanceof NetworkError ? 'offline' : 'error');
      return null;
    }
  }

  /** Encola un resultado. Se guarda ya, se sube cuando se pueda. */
  queueScore(pending: PendingScore): void {
    if (!this.isGroup) return;
    this.save.update((data) => {
      if (data.outbox.some((entry) => entry.attemptId === pending.attemptId)) return;
      data.outbox.push(pending);
      if (data.outbox.length > 40) data.outbox.shift();
    });
    this.save.flush();
    this.setStatus(this.pendingCount > 0 ? 'syncing' : this._status);
    void this.flush();
  }

  /**
   * Vacia la cola en orden. Devuelve cuantos se subieron.
   *
   * Si mientras se esta enviando entra una partida nueva, se vuelve a dar otra
   * vuelta al terminar: si no, esa partida se quedaria esperando al siguiente
   * sondeo (hasta 20 segundos) sin motivo.
   */
  async flush(): Promise<number> {
    if (!this.isGroup) return 0;
    if (this.flushing) {
      this.flushAgain = true;
      return 0;
    }
    if (this.save.get().outbox.length === 0) return 0;

    this.flushing = true;
    this.setStatus('syncing');
    let sent = 0;
    try {
      let keepGoing = true;
      while (keepGoing) {
        keepGoing = false;
        for (const pending of this.save.get().outbox.slice()) {
          try {
            const response = await this.client.submitScore({
              attemptId: pending.attemptId,
              gameId: pending.gameId,
              challengeId: pending.challengeId,
              day: pending.day,
              score: pending.score,
              durationMs: pending.durationMs,
              attemptsUsed: pending.attemptsUsed,
              countsForRanking: pending.countsForRanking,
              gameVersion: pending.gameVersion,
              isTest: pending.isTest,
              isBet: pending.isBet,
              ghost: pending.ghost,
            });
            this.removePending(pending.attemptId);
            this.applySnapshot(response.snapshot);
            sent++;
          } catch (error) {
            if (error instanceof ApiError && error.permanent) {
              // El servidor lo rechaza para siempre (dia cerrado, sin intentos,
              // datos invalidos). Se saca de la cola, pero se deja constancia.
              this.removePending(pending.attemptId);
              this.emit('dropped', { pending, reason: error.code });
              continue;
            }
            // Problema de red o del servidor: se queda en la cola y paramos.
            this.bumpTries(pending.attemptId);
            this.setStatus('offline');
            this.flushAgain = false;
            return sent;
          }
        }
        if (this.flushAgain) {
          this.flushAgain = false;
          keepGoing = this.save.get().outbox.length > 0;
        }
      }
    } finally {
      this.flushing = false;
      this.flushAgain = false;
      this.save.flush();
      if (this.pendingCount === 0 && this._status === 'syncing') this.setStatus('online');
      this.emit('status', { status: this._status, pending: this.pendingCount });
    }
    return sent;
  }

  private removePending(attemptId: string): void {
    this.save.update((data) => {
      data.outbox = data.outbox.filter((entry) => entry.attemptId !== attemptId);
    });
  }

  private bumpTries(attemptId: string): void {
    this.save.update((data) => {
      const entry = data.outbox.find((item) => item.attemptId === attemptId);
      if (entry) entry.tries++;
    });
  }

  async rename(name: string): Promise<void> {
    if (!this.isGroup) return;
    const response = await this.client.rename(name);
    this.save.update((data) => {
      data.profile.name = response.name;
    });
    this.applySnapshot(response.snapshot);
  }

  async fetchGhost(playerId: string, gameId: string, day?: string): Promise<RemoteGhost | null> {
    if (!this.isGroup) return null;
    try {
      return await this.client.ghost(playerId, gameId, day);
    } catch {
      return null;
    }
  }

  async sendTelemetry(events: TelemetryEventPayload[]): Promise<boolean> {
    if (!this.isGroup || events.length === 0) return false;
    try {
      await this.client.sendEvents(events);
      return true;
    } catch {
      return false;
    }
  }
}
