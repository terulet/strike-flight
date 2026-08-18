/**
 * Local persistence. Storage is injected so it can be tested headlessly and
 * so a corrupt/unavailable localStorage degrades to an in-memory store
 * instead of crashing the game (Safari private mode throws on write).
 */

export const SAVE_KEY = 'omf.save.v1';

const DEFAULTS = {
  bestFloor: 0,
  runs: 0,
  totalFloors: 0,
  muted: false,
};

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

/** Returns localStorage when usable, otherwise an in-memory fallback. */
export function detectStorage(globalObj = globalThis) {
  try {
    const ls = globalObj.localStorage;
    if (!ls) return memoryStorage();
    const probe = '__omf_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

const isFiniteInt = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export class SaveManager {
  constructor(storage = memoryStorage(), key = SAVE_KEY) {
    this.storage = storage;
    this.key = key;
    this.data = { ...DEFAULTS };
    this.load();
  }

  load() {
    let raw = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      raw = null;
    }
    if (!raw) return this.data;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.data = {
          ...DEFAULTS,
          bestFloor: isFiniteInt(parsed.bestFloor) ? Math.floor(parsed.bestFloor) : 0,
          runs: isFiniteInt(parsed.runs) ? Math.floor(parsed.runs) : 0,
          totalFloors: isFiniteInt(parsed.totalFloors) ? Math.floor(parsed.totalFloors) : 0,
          muted: parsed.muted === true,
        };
      }
    } catch {
      // Corrupt payload: keep defaults rather than losing the session.
      this.data = { ...DEFAULTS };
    }
    return this.data;
  }

  save() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  get bestFloor() {
    return this.data.bestFloor;
  }

  get muted() {
    return this.data.muted;
  }

  setMuted(v) {
    this.data.muted = !!v;
    this.save();
  }

  /** Returns true when the run beat the stored record. */
  submitRun(floor) {
    const reached = isFiniteInt(floor) ? Math.floor(floor) : 0;
    this.data.runs += 1;
    this.data.totalFloors += reached;
    const isRecord = reached > this.data.bestFloor;
    if (isRecord) this.data.bestFloor = reached;
    this.save();
    return isRecord;
  }

  reset() {
    this.data = { ...DEFAULTS };
    this.save();
  }
}
