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
export const SAVE_VERSION = 2;

export interface ChallengeProgress {
  attemptsUsed: number;
  bestScore: number;
  lastScore: number;
  plays: number;
  history: number[];
}

export interface DayRecord {
  challenges: Record<string, ChallengeProgress>;
  rivalsPlayed: string[];
  /** Puntos extra que el panel de debug regala a un rival ese dia. */
  rivalBoosts: Record<string, number>;
  secretUnlocked: boolean;
  chaosEnabled: boolean;
  resolvedWinner: string | null;
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
}

export function emptyChallengeProgress(): ChallengeProgress {
  return { attemptsUsed: 0, bestScore: 0, lastScore: 0, plays: 0, history: [] };
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
  };
}

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
