/**
 * Formas que viajan entre cliente y servidor.
 *
 * Estan escritas a mano (no generadas) porque el backend es JavaScript puro y
 * no queremos un paso de build compartido: son cuatro objetos y cambian poco.
 * Si algun dia divergen, los tests multicliente lo cazan enseguida.
 */
export interface GroupInfo {
  code: string;
  maxPlayers: number;
  timezone: string;
  season: string;
  createdAt?: number;
}

export interface MemberState {
  id: string;
  name: string;
  joinedAt: number;
  lastSeenAt: number;
  online: boolean;
  activeToday: boolean;
  completedDaily: boolean;
}

export interface ScoreRow {
  playerId: string;
  challengeId: string;
  gameId: string;
  bestScore: number;
  attemptsUsed: number;
  plays: number;
  countsForRanking: boolean;
  updatedAt: number;
}

export interface GhostSummary {
  playerId: string;
  gameId: string;
  score: number;
  durationMs: number;
  bytes: number;
}

export interface SecretState {
  unlocked: boolean;
  activeCount: number;
  /** Cuantos hacen falta hoy para abrirlo (el umbral, o los activos si son menos). */
  neededCount?: number;
  readyCount: number;
  missing: string[];
}

/** La foto completa del grupo para un dia. Es lo unico que el cliente necesita. */
export interface GroupSnapshot {
  serverTime: number;
  day: string;
  group: GroupInfo;
  members: MemberState[];
  scores: ScoreRow[];
  secret: SecretState;
  ghosts: GhostSummary[];
}

export interface SessionCredentials {
  playerId: string;
  secret: string;
  name: string;
  groupCode: string;
}

export interface GhostPayload {
  trace: string;
  durationMs: number;
}

export interface SubmitScoreRequest {
  attemptId: string;
  gameId: string;
  challengeId: string;
  day: string;
  score: number;
  durationMs: number;
  attemptsUsed: number;
  countsForRanking: boolean;
  gameVersion: number;
  isTest: boolean;
  ghost?: GhostPayload | null;
}

export interface SubmitScoreResponse {
  ok: true;
  day: string;
  challengeId: string;
  bestScore: number;
  improved: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  ghostStored: boolean;
  duplicate?: boolean;
  snapshot: GroupSnapshot;
}

export interface RemoteGhost {
  playerId: string;
  playerName: string;
  gameId: string;
  score: number;
  durationMs: number;
  trace: string;
}

export interface TelemetryEventPayload {
  type: string;
  ts: number;
  day: string;
  gameId?: string | null;
  gameVersion?: number | null;
  value?: number | null;
  meta?: Record<string, unknown> | null;
  isTest?: boolean;
}
