/**
 * Save — versioned, migratable, corruption-proof local persistence.
 *
 * The storage backend is injected so tests (and a future native shell) can swap it.
 * Every read is defensive: a broken payload must never stop the player from playing.
 */
const KEY = 'omm.save.v1';
export const SAVE_VERSION = 4;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    createdAt: 0,
    /** Local identity for tester reports. Anonymous by construction. */
    player: { id: '', name: '', createdAt: 0 },
    settings: {
      lang: 'en',
      sound: true,
      haptics: true,
      shake: true,
      reduceFx: false,
      highContrast: false,
    },
    stats: {
      attempts: 0,
      shots: 0,
      falls: 0,
      nearMisses: 0,
      closeCalls: 0,
      rivalsBeaten: 0,
      records: 0,
      streak: 0,
      bestStreak: 0,
      sessions: 0,
      zones: {},
    },
    records: {
      bestM: null,
      bestAt: 0,
      bestChallengeId: null,
      today: { day: '', bestM: null },
      perChallenge: {},
    },
    daily: { day: '', attempts: 0, bestM: null, done: false, results: [] },
    ranking: { day: '', entries: [] },
    rivals: { beaten: [], seen: [] },
    unlocked: ['puck'],
    practiceIndex: 1,
    replays: [],
  };
}

/** Deep-ish merge that keeps unknown keys out and never trusts types. */
function coerce(base, raw) {
  if (!raw || typeof raw !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(base)) {
    const b = base[k];
    const v = raw[k];
    if (v === undefined || v === null) continue;
    if (b === null) {
      // Nullable slot (a record that may not exist yet). Numeric strings become
      // numbers: a record stored as "0.002" must still compare as a number.
      const ty = typeof v;
      if (ty === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) out[k] = Number(v);
      else if (ty === 'number' || ty === 'string' || ty === 'boolean' || ty === 'object') out[k] = v;
      else out[k] = b;
    } else if (Array.isArray(b)) out[k] = Array.isArray(v) ? v : b;
    else if (typeof b === 'object') out[k] = coerce(b, v);
    else if (typeof b === typeof v) out[k] = v;
    else if (typeof b === 'number' && typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) out[k] = Number(v);
  }
  // Free-form maps we deliberately keep as-is.
  if (raw.records && typeof raw.records.perChallenge === 'object' && raw.records.perChallenge)
    out.records.perChallenge = raw.records.perChallenge;
  if (raw.stats && typeof raw.stats.zones === 'object' && raw.stats.zones) out.stats.zones = raw.stats.zones;
  return out;
}

/** Migrations run oldest -> newest, each one small and reversible in spirit. */
const MIGRATIONS = {
  1: (s) => {
    // v1 kept a flat `best` in millimetres.
    if (typeof s.best === 'number') {
      s.records = s.records || {};
      s.records.bestM = s.best / 1000;
      delete s.best;
    }
    s.version = 2;
    return s;
  },
  2: (s) => {
    s.rivals = s.rivals || { beaten: [], seen: [] };
    s.unlocked = Array.isArray(s.unlocked) ? s.unlocked : ['puck'];
    s.version = 3;
    return s;
  },
  3: (s) => {
    // Tester build: an identity so a copied report can be attributed to a person.
    if (!s.player || typeof s.player !== 'object') s.player = { id: '', name: '', createdAt: 0 };
    s.version = 4;
    return s;
  },
};

function migrate(raw) {
  let s = raw;
  let guard = 0;
  while (typeof s.version === 'number' && s.version < SAVE_VERSION && guard++ < 10) {
    const fn = MIGRATIONS[s.version];
    if (!fn) break;
    s = fn(s);
  }
  return s;
}

export class Save {
  /** @param {Storage|null} backend anything with getItem/setItem/removeItem */
  constructor(backend = null, key = KEY) {
    this.key = key;
    this.backend = backend !== null ? backend : safeLocalStorage();
    this.data = defaultSave();
    this.corrupted = false;
    this.load();
  }

  load() {
    const base = defaultSave();
    let raw = null;
    try {
      const text = this.backend && this.backend.getItem(this.key);
      if (text) raw = JSON.parse(text);
    } catch (e) {
      this.corrupted = true;
      raw = null;
    }
    if (raw && typeof raw === 'object') {
      try {
        this.data = coerce(base, migrate(raw));
      } catch (e) {
        this.corrupted = true;
        this.data = base;
      }
    } else {
      if (raw !== null) this.corrupted = true;
      this.data = base;
    }
    if (!this.data.createdAt) this.data.createdAt = Date.now();
    this.data.version = SAVE_VERSION;
    return this.data;
  }

  save() {
    if (!this.backend) return false;
    try {
      this.backend.setItem(this.key, JSON.stringify(this.data));
      return true;
    } catch (e) {
      return false; // quota / private mode: the game keeps running in memory
    }
  }

  reset() {
    this.data = defaultSave();
    this.data.createdAt = Date.now();
    try { this.backend && this.backend.removeItem(this.key); } catch (e) { /* ignore */ }
    return this.data;
  }

  /** Mutate + persist in one call. */
  update(fn) {
    fn(this.data);
    this.save();
    return this.data;
  }
}

export function safeLocalStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__omm_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch (e) {
    return null;
  }
}

/** In-memory backend for tests and for browsers that block storage. */
export function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() { return map.size; },
  };
}
