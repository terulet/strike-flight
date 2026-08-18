/**
 * Cliente HTTP de PLAYZONE.
 *
 * Todo lo que puede fallar en un movil esta contemplado aqui: timeouts,
 * respuestas que no son JSON, servidor caido, y errores del servidor con
 * codigo propio para poder decidir si reintentar o descartar.
 */
import type {
  GroupSnapshot,
  RemoteGhost,
  SessionCredentials,
  SubmitScoreRequest,
  SubmitScoreResponse,
  TelemetryEventPayload,
} from './types';

/** Error con el codigo que manda el backend ('group_full', 'stale_day'...). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  /** Si no tiene sentido reintentarlo: el servidor ya ha dicho que no. */
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

export class NetworkError extends Error {
  readonly code = 'network';
  get permanent(): boolean {
    return false;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 8000;

export class ApiClient {
  baseUrl: string;
  private timeoutMs: number;
  private credentials: SessionCredentials | null = null;

  constructor(options: ApiClientOptions = {}) {
    // Por defecto, mismo origen: en desarrollo Vite reenvia /api al backend y
    // en produccion se sirve todo junto. VITE_API_URL lo cambia si hace falta.
    this.baseUrl = options.baseUrl ?? (import.meta.env?.VITE_API_URL as string | undefined) ?? '';
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  setCredentials(credentials: SessionCredentials | null): void {
    this.credentials = credentials;
  }

  get token(): string | null {
    return this.credentials ? `${this.credentials.playerId}.${this.credentials.secret}` : null;
  }

  get hasSession(): boolean {
    return this.credentials !== null;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; auth?: boolean; timeoutMs?: number } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth !== false && this.token) headers.Authorization = `Bearer ${this.token}`;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch {
      throw new NetworkError('No hay conexion con PLAYZONE');
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(response.status, 'invalid_response', 'Respuesta ilegible del servidor');
      }
    }

    if (!response.ok) {
      const payload = (data ?? {}) as { error?: string; message?: string };
      throw new ApiError(
        response.status,
        payload.error ?? 'server_error',
        payload.message ?? 'El servidor ha dicho que no',
      );
    }
    return data as T;
  }

  health(): Promise<{ ok: boolean; day: string }> {
    return this.request('/api/health', { auth: false, timeoutMs: 4000 });
  }

  createGroup(name: string): Promise<{
    group: { code: string };
    player: { id: string; name: string; secret: string };
    snapshot: GroupSnapshot;
  }> {
    return this.request('/api/groups', { method: 'POST', body: { name }, auth: false });
  }

  joinGroup(
    code: string,
    name: string,
  ): Promise<{
    group: { code: string };
    player: { id: string; name: string; secret: string };
    snapshot: GroupSnapshot;
  }> {
    return this.request('/api/groups/join', {
      method: 'POST',
      body: { code, name },
      auth: false,
    });
  }

  async snapshot(): Promise<GroupSnapshot> {
    const data = await this.request<{ snapshot: GroupSnapshot }>('/api/snapshot');
    return data.snapshot;
  }

  submitScore(payload: SubmitScoreRequest): Promise<SubmitScoreResponse> {
    return this.request('/api/scores', { method: 'POST', body: payload, timeoutMs: 10_000 });
  }

  async ghost(playerId: string, gameId: string, day?: string): Promise<RemoteGhost | null> {
    const params = new URLSearchParams({ playerId, gameId });
    if (day) params.set('day', day);
    const data = await this.request<{ ghost: RemoteGhost | null }>(`/api/ghost?${params}`);
    return data.ghost;
  }

  rename(name: string): Promise<{ name: string; snapshot: GroupSnapshot }> {
    return this.request('/api/name', { method: 'POST', body: { name } });
  }

  sendEvents(events: TelemetryEventPayload[]): Promise<{ ok: boolean; stored: number }> {
    return this.request('/api/events', { method: 'POST', body: { events } });
  }

  stats(): Promise<{ counts: Record<string, number>; revengeRate: number | null; recent: unknown[] }> {
    return this.request('/api/stats');
  }

  /** URL del stream de eventos (EventSource no admite cabeceras, va en query). */
  streamUrl(): string | null {
    if (!this.token) return null;
    return `${this.baseUrl}/api/stream?token=${encodeURIComponent(this.token)}`;
  }
}
