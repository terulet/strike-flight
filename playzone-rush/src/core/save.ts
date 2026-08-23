/**
 * Estado persistente del jugador.
 *
 * Reglas de la casa:
 *  - el save siempre lleva version;
 *  - un JSON corrupto NUNCA debe impedir jugar (se archiva y se empieza limpio);
 *  - un save de una version anterior se migra;
 *  - un save al que le faltan campos (o le sobran) se normaliza contra los
 *    valores por defecto, de forma que anadir campos en el futuro no rompe
 *    nada de lo ya guardado.
 */
import { Emitter } from './emitter';
import { createStore, type KeyValueStore } from './storage';

export const SAVE_KEY = 'playzone.rush.save';
export const SAVE_BACKUP_KEY = 'playzone.rush.save.broken';
export const SAVE_VERSION = 4;

/** Como acabo la apuesta en este reto, si es que se uso aqui. */
export type ApuestaResultado = 'doblo' | 'cayo';

export interface ChallengeProgress {
  attemptsUsed: number;
  bestScore: number;
  lastScore: number;
  plays: number;
  history: number[];
  /**
   * Si el jugador gasto aqui su ficha del dia, y como acabo. null = no la uso
   * en este reto. Se guarda por reto (y no solo en el dia) porque el ranking
   * tiene que poder ensenar 🔥 o 💀 justo al lado de la marca afectada.
   */
  apuesta?: ApuestaResultado | null;
}

export interface DayRecord {
  challenges: Record<string, ChallengeProgress>;
  /**
   * La ficha de DOBLE O NADA: una por jugador y dia. Se consume tanto si gana
   * como si pierde. Vive en el dia y no en el reto porque es del dia entero:
   * se puede gastar en cualquiera de los tres, pero solo en uno.
   */
  apuestaGastada?: boolean;
  rivalsPlayed: string[];
  /** Puntos extra que el panel de debug regala a un rival ese dia. */
  rivalBoosts: Record<string, number>;
  secretUnlocked: boolean;
  chaosEnabled: boolean;
  resolvedWinner: string | null;
}

/** Como esta jugando este movil: aun sin decidir, en solitario o en grupo. */
export type PlayMode = 'none' | 'solo' | 'group';

export interface AccountState {
  mode: PlayMode;
  /** Identidad del dispositivo. No es una cuenta: no hay email ni contrasena. */
  playerId: string | null;
  secret: string | null;
  groupCode: string | null;
  joinedAt: number;
}

/** Resultado jugado que aun no ha llegado al servidor. */
export interface PendingScore {
  attemptId: string;
  day: string;
  challengeId: string;
  gameId: string;
  score: number;
  durationMs: number;
  attemptsUsed: number;
  countsForRanking: boolean;
  ghost: { trace: string; durationMs: number } | null;
  queuedAt: number;
  tries: number;
}

export interface SocialState {
  /** dia -> jugador -> total que le vimos la ultima vez. */
  lastTotals: Record<string, Record<string, number>>;
  /** Adelantamientos ya avisados, para no repetir el aviso en cada recarga. */
  seenOvertakes: string[];
}

export interface TelemetryEvent {
  type: string;
  ts: number;
  day: string;
  gameId?: string | null;
  value?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface TelemetryState {
  events: TelemetryEvent[];
  counters: Record<string, number>;
  /** Cuantos eventos se han enviado ya al servidor. */
  sent: number;
}

export interface SaveData {
  version: number;
  profile: { name: string; createdAt: number };
  prefs: { muted: boolean; haptics: boolean; reducedMotion: boolean };
  days: Record<string, DayRecord>;
  records: {
    bestByGame: Record<string, number>;
    bestDailyTotal: number;
    bestChaos: number;
  };
  streak: { holder: string | null; days: number; lastResolvedDay: string | null };
  debug: { dayOffset: number };
  account: AccountState;
  /** Cola de envios pendientes: sin red se juega igual y se sube despues. */
  outbox: PendingScore[];
  /** Ultima foto del grupo, para poder pintar el ranking sin conexion. */
  snapshot: { day: string; data: unknown } | null;
  social: SocialState;
  telemetry: TelemetryState;
}

export function emptyChallengeProgress(): ChallengeProgress {
  return { attemptsUsed: 0, bestScore: 0, lastScore: 0, plays: 0, history: [], apuesta: null };
}

export function emptyDayRecord(): DayRecord {
  return {
    challenges: {},
    rivalsPlayed: [],
    rivalBoosts: {},
    secretUnlocked: false,
    chaosEnabled: false,
    resolvedWinner: null,
  };
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    profile: { name: 'ELOI', createdAt: 0 },
    prefs: { muted: false, haptics: true, reducedMotion: false },
    days: {},
    records: { bestByGame: {}, bestDailyTotal: 0, bestChaos: 0 },
    streak: { holder: null, days: 0, lastResolvedDay: null },
    debug: { dayOffset: 0 },
    account: { mode: 'none', playerId: null, secret: null, groupCode: null, joinedAt: 0 },
    outbox: [],
    snapshot: null,
    social: { lastTotals: {}, seenOvertakes: [] },
    telemetry: { events: [], counters: {}, sent: 0 },
  };
}

/** Cuantos eventos de telemetria guardamos en local antes de tirar los viejos. */
export const TELEMETRY_LIMIT = 600;

/* ------------------------------------------------------------------ */
/* Normalizacion                                                       */
/* ------------------------------------------------------------------ */

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' && v.length > 0 ? v : fallback;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function normalizeChallenge(raw: unknown): ChallengeProgress {
  const r = obj(raw);
  const history = Array.isArray(r.history)
    ? r.history.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).slice(-20)
    : [];
  return {
    // Solo se aceptan los dos valores validos: un save manipulado no puede
    // colar una marca de apuesta inventada.
    apuesta: r.apuesta === 'doblo' || r.apuesta === 'cayo' ? r.apuesta : null,
    attemptsUsed: Math.max(0, Math.round(num(r.attemptsUsed, 0))),
    bestScore: Math.max(0, Math.round(num(r.bestScore, 0))),
    lastScore: Math.max(0, Math.round(num(r.lastScore, 0))),
    plays: Math.max(0, Math.round(num(r.plays, 0))),
    history,
  };
}

function normalizeDay(raw: unknown): DayRecord {
  const r = obj(raw);
  const challenges: Record<string, ChallengeProgress> = {};
  for (const [key, value] of Object.entries(obj(r.challenges))) {
    challenges[key] = normalizeChallenge(value);
  }
  const rivalBoosts: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj(r.rivalBoosts))) {
    rivalBoosts[key] = Math.round(num(value, 0));
  }

  return {
    challenges,
    apuestaGastada: bool(r.apuestaGastada, false),
    rivalBoosts,
    rivalsPlayed: Array.isArray(r.rivalsPlayed)
      ? Array.from(new Set(r.rivalsPlayed.filter((v): v is string => typeof v === 'string')))
      : [],
    secretUnlocked: bool(r.secretUnlocked, false),
    chaosEnabled: bool(r.chaosEnabled, false),
    resolvedWinner: typeof r.resolvedWinner === 'string' ? r.resolvedWinner : null,
  };
}

/** Rellena huecos, descarta basura y deja siempre una forma valida. */
export function normalizeSave(raw: unknown): SaveData {
  const base = defaultSave();
  const r = obj(raw);
  const profile = obj(r.profile);
  const prefs = obj(r.prefs);
  const records = obj(r.records);
  const streak = obj(r.streak);
  const debug = obj(r.debug);

  const days: Record<string, DayRecord> = {};
  for (const [key, value] of Object.entries(obj(r.days))) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days[key] = normalizeDay(value);
  }

  const bestByGame: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj(records.bestByGame))) {
    bestByGame[key] = Math.max(0, Math.round(num(value, 0)));
  }

  const account = obj(r.account);
  const social = obj(r.social);
  const telemetry = obj(r.telemetry);

  return {
    version: SAVE_VERSION,
    profile: {
      name: str(profile.name, base.profile.name).slice(0, 12).toUpperCase(),
      createdAt: num(profile.createdAt, base.profile.createdAt),
    },
    prefs: {
      muted: bool(prefs.muted, base.prefs.muted),
      haptics: bool(prefs.haptics, base.prefs.haptics),
      reducedMotion: bool(prefs.reducedMotion, base.prefs.reducedMotion),
    },
    days,
    records: {
      bestByGame,
      bestDailyTotal: Math.max(0, Math.round(num(records.bestDailyTotal, 0))),
      bestChaos: Math.max(0, Math.round(num(records.bestChaos, 0))),
    },
    streak: {
      holder: typeof streak.holder === 'string' ? streak.holder : null,
      days: Math.max(0, Math.round(num(streak.days, 0))),
      lastResolvedDay: typeof streak.lastResolvedDay === 'string' ? streak.lastResolvedDay : null,
    },
    debug: { dayOffset: Math.round(num(debug.dayOffset, 0)) },
    account: normalizeAccount(account),
    outbox: Array.isArray(r.outbox)
      ? r.outbox
          .map(normalizePending)
          .filter((entry): entry is PendingScore => entry !== null)
          .slice(-40)
      : [],
    snapshot: normalizeSnapshot(r.snapshot),
    social: {
      lastTotals: normalizeTotals(social.lastTotals),
      seenOvertakes: Array.isArray(social.seenOvertakes)
        ? social.seenOvertakes.filter((v): v is string => typeof v === 'string').slice(-200)
        : [],
    },
    telemetry: {
      events: Array.isArray(telemetry.events)
        ? telemetry.events
            .map(normalizeEvent)
            .filter((entry): entry is TelemetryEvent => entry !== null)
            .slice(-TELEMETRY_LIMIT)
        : [],
      counters: normalizeCounters(telemetry.counters),
      sent: Math.max(0, Math.round(num(telemetry.sent, 0))),
    },
  };
}

function normalizeAccount(raw: Record<string, unknown>): AccountState {
  const mode = raw.mode;
  return {
    mode: mode === 'solo' || mode === 'group' ? mode : 'none',
    playerId: typeof raw.playerId === 'string' ? raw.playerId.slice(0, 64) : null,
    secret: typeof raw.secret === 'string' ? raw.secret.slice(0, 128) : null,
    groupCode: typeof raw.groupCode === 'string' ? raw.groupCode.slice(0, 12).toUpperCase() : null,
    joinedAt: Math.max(0, Math.round(num(raw.joinedAt, 0))),
  };
}

function normalizePending(raw: unknown): PendingScore | null {
  const r = obj(raw);
  if (typeof r.attemptId !== 'string' || typeof r.gameId !== 'string') return null;
  if (typeof r.challengeId !== 'string' || typeof r.day !== 'string') return null;
  const ghost = obj(r.ghost);
  return {
    attemptId: r.attemptId.slice(0, 64),
    day: r.day.slice(0, 10),
    challengeId: r.challengeId.slice(0, 24),
    gameId: r.gameId.slice(0, 24),
    score: Math.max(0, Math.round(num(r.score, 0))),
    durationMs: Math.max(0, Math.round(num(r.durationMs, 0))),
    attemptsUsed: Math.max(0, Math.round(num(r.attemptsUsed, 0))),
    countsForRanking: bool(r.countsForRanking, true),
    ghost:
      typeof ghost.trace === 'string'
        ? {
            trace: ghost.trace.slice(0, 8000),
            durationMs: Math.max(0, Math.round(num(ghost.durationMs, 0))),
          }
        : null,
    queuedAt: Math.max(0, Math.round(num(r.queuedAt, 0))),
    tries: Math.max(0, Math.round(num(r.tries, 0))),
  };
}

function normalizeSnapshot(raw: unknown): { day: string; data: unknown } | null {
  const r = obj(raw);
  if (typeof r.day !== 'string' || !r.data) return null;
  return { day: r.day.slice(0, 10), data: r.data };
}

function normalizeTotals(raw: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [day, value] of Object.entries(obj(raw))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const totals: Record<string, number> = {};
    for (const [playerId, total] of Object.entries(obj(value))) {
      totals[playerId.slice(0, 64)] = Math.max(0, Math.round(num(total, 0)));
    }
    out[day] = totals;
  }
  return out;
}

function normalizeCounters(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj(raw))) {
    out[key.slice(0, 40)] = Math.max(0, Math.round(num(value, 0)));
  }
  return out;
}

function normalizeEvent(raw: unknown): TelemetryEvent | null {
  const r = obj(raw);
  if (typeof r.type !== 'string' || r.type.length === 0) return null;
  return {
    type: r.type.slice(0, 40),
    ts: Math.max(0, Math.round(num(r.ts, 0))),
    day: typeof r.day === 'string' ? r.day.slice(0, 10) : '',
    gameId: typeof r.gameId === 'string' ? r.gameId.slice(0, 24) : null,
    value: typeof r.value === 'number' && Number.isFinite(r.value) ? Math.round(r.value) : null,
    meta: r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Migraciones                                                         */
/* ------------------------------------------------------------------ */

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Cada entrada migra DESDE esa version A la siguiente. Las migraciones no
 * necesitan ser exhaustivas: normalizeSave() se encarga del resto, aqui solo
 * se resuelven los cambios que no se pueden deducir (renombrados, reformas).
 */
export const migrations: Record<number, Migration> = {
  // v0/v1 -> v2: antes las mejores marcas por juego colgaban de la raiz
  // ("bests") y la racha era un simple contador ("streakDays").
  1: (data) => {
    const out = { ...data };
    const legacyBests = obj(data.bests);
    if (Object.keys(legacyBests).length > 0) {
      const records = obj(out.records);
      out.records = { ...records, bestByGame: { ...obj(records.bestByGame), ...legacyBests } };
    }
    if (typeof data.streakDays === 'number') {
      const streak = obj(out.streak);
      out.streak = { ...streak, days: data.streakDays };
    }
    delete out.bests;
    delete out.streakDays;
    out.version = 2;
    return out;
  },
  // v2 -> v3: aparecen identidad de grupo, cola de envios, cache del snapshot,
  // memoria social y telemetria. Los campos nuevos los rellena normalizeSave()
  // con sus valores por defecto, asi que aqui solo se marca la version: nada
  // de lo que ya habia jugado el jugador se toca.
  2: (data) => ({ ...data, version: 3 }),
  // v3 -> v4: aparece la ficha de DOBLE O NADA. Quien ya venia jugando la
  // encuentra sin gastar, que es lo correcto: no se le quita nada ni se le
  // regala una marca doblada de un dia que jugo sin conocer el sistema.
  3: (data) => ({ ...data, version: 4 }),
};

export interface LoadReport {
  save: SaveData;
  /** 'ok' | 'fresh' (no habia nada) | 'migrated' | 'recovered' (JSON roto) */
  status: 'ok' | 'fresh' | 'migrated' | 'recovered';
  fromVersion: number | null;
}

export function loadSaveFrom(store: KeyValueStore): LoadReport {
  const raw = store.get(SAVE_KEY);
  if (raw === null) return { save: defaultSave(), status: 'fresh', fromVersion: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON corrupto: lo apartamos por si algun dia queremos mirarlo y seguimos.
    store.set(SAVE_BACKUP_KEY, raw.slice(0, 20000));
    store.remove(SAVE_KEY);
    return { save: defaultSave(), status: 'recovered', fromVersion: null };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    store.set(SAVE_BACKUP_KEY, raw.slice(0, 20000));
    store.remove(SAVE_KEY);
    return { save: defaultSave(), status: 'recovered', fromVersion: null };
  }

  let data = parsed as Record<string, unknown>;
  const fromVersion = typeof data.version === 'number' ? data.version : 1;
  let migrated = false;

  let v = fromVersion;
  while (v < SAVE_VERSION) {
    const step = migrations[v];
    if (!step) break;
    data = step(data);
    migrated = true;
    v = typeof data.version === 'number' ? data.version : v + 1;
  }

  const save = normalizeSave(data);
  const status: LoadReport['status'] = migrated ? 'migrated' : 'ok';
  return { save, status, fromVersion };
}

/* ------------------------------------------------------------------ */
/* Gestor                                                              */
/* ------------------------------------------------------------------ */

export interface SaveEvents extends Record<string, unknown> {
  change: SaveData;
}

export class SaveManager extends Emitter<SaveEvents> {
  readonly store: KeyValueStore;
  readonly report: LoadReport;
  private data: SaveData;
  private flushHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(store: KeyValueStore = createStore()) {
    super();
    this.store = store;
    this.report = loadSaveFrom(store);
    this.data = this.report.save;
    if (this.data.profile.createdAt === 0) this.data.profile.createdAt = Date.now();
  }

  get(): Readonly<SaveData> {
    return this.data;
  }

  /** Modifica el save. El callback recibe el objeto mutable. */
  update(fn: (data: SaveData) => void, options: { silent?: boolean } = {}): SaveData {
    fn(this.data);
    this.scheduleFlush();
    if (!options.silent) this.emit('change', this.data);
    return this.data;
  }

  /** Devuelve (creando si hace falta) el registro de un dia. */
  day(dayKey: string): DayRecord {
    let record = this.data.days[dayKey];
    if (!record) {
      record = emptyDayRecord();
      this.data.days[dayKey] = record;
    }
    return record;
  }

  /** Devuelve (creando si hace falta) el progreso de un reto de un dia. */
  challenge(dayKey: string, challengeId: string): ChallengeProgress {
    const day = this.day(dayKey);
    let progress = day.challenges[challengeId];
    if (!progress) {
      progress = emptyChallengeProgress();
      day.challenges[challengeId] = progress;
    }
    return progress;
  }

  private scheduleFlush(): void {
    if (this.flushHandle !== null) return;
    this.flushHandle = setTimeout(() => {
      this.flushHandle = null;
      this.flush();
    }, 120);
  }

  /** Escribe ya. Devuelve false si el almacenamiento lo rechazo. */
  flush(): boolean {
    if (this.flushHandle !== null) {
      clearTimeout(this.flushHandle);
      this.flushHandle = null;
    }
    try {
      return this.store.set(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      return false;
    }
  }

  reset(): SaveData {
    this.data = defaultSave();
    this.data.profile.createdAt = Date.now();
    this.store.remove(SAVE_KEY);
    this.flush();
    this.emit('change', this.data);
    return this.data;
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2);
  }
}
