/** Progreso guardado en localStorage: pruebas desbloqueadas y mejores marcas. */
import { MISSION_COUNT } from './missions';

export interface Best {
  medal: number;
  time: number;
  score: number;
  plates: number;
  trickScore: number;
}

export interface RiderProfile {
  colors: string;
  number: string;
  name: string;
}

export interface Progress {
  unlocked: number;
  best: Record<number, Best>;
  muted: boolean;
  rider: RiderProfile;
  /** Mejor tiempo de cada Barro del Dia (clave AAAA-MM-DD). */
  daily: Record<string, { time: number; medal: number }>;
  /** Decoraciones especiales desbloqueadas. */
  liveries: string[];
}

export const BASIC_COLORS = ['orange', 'blue', 'green', 'yellow', 'purple'];
export const SPECIAL_LIVERIES: Array<{ id: string; name: string; how: string }> = [
  { id: 'gold', name: 'ORO', how: 'Gana la Final del Estadio Nocturno' },
  { id: 'neon', name: 'NEÓN', how: 'Termina 3 Barros del Día distintos' },
  { id: 'carbon', name: 'CARBONO', how: 'Consigue medalla en las 5 pruebas' },
];

/** Decoraciones que se ganan jugando (ademas de las desbloqueadas por anuncio). */
export function earnedLiveries(p: Progress): string[] {
  const out: string[] = [];
  if ((p.best[5]?.medal ?? 0) >= 3) out.push('gold');
  if (Object.keys(p.daily).length >= 3) out.push('neon');
  if ([1, 2, 3, 4, 5].every((id) => (p.best[id]?.medal ?? 0) >= 1)) out.push('carbon');
  return out;
}

export function isLiveryUnlocked(p: Progress, id: string): boolean {
  return BASIC_COLORS.includes(id) || p.liveries.includes(id) || earnedLiveries(p).includes(id);
}

export const DEFAULT_RIDER: RiderProfile = { colors: 'orange', number: '77', name: 'PILOTO' };

const KEY = 'holeshot:v1';

export function emptyProgress(): Progress {
  return { unlocked: 1, best: {}, muted: false, rider: { ...DEFAULT_RIDER }, daily: {}, liveries: [] };
}

export function loadProgress(storage: Storage | null = safeStorage()): Progress {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: Math.min(MISSION_COUNT, Math.max(1, Number(p.unlocked) || 1)),
      best: p.best && typeof p.best === 'object' ? p.best : {},
      muted: !!p.muted,
      rider: sanitizeRider(p.rider),
      daily: p.daily && typeof p.daily === 'object' ? p.daily : {},
      liveries: Array.isArray(p.liveries) ? p.liveries.filter((x): x is string => SPECIAL_LIVERIES.some((l) => l.id === x)) : [],
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: el juego sigue igual */
  }
}

/** Registra un resultado; devuelve true si es nueva mejor marca. */
export function recordResult(p: Progress, id: number, r: Best): boolean {
  const prev = p.best[id];
  let improved = false;
  if (!prev) {
    p.best[id] = { ...r };
    improved = true;
  } else {
    if (r.medal > prev.medal) {
      prev.medal = r.medal;
      improved = true;
    }
    if (r.time < prev.time) {
      prev.time = r.time;
      improved = true;
    }
    if (r.score > prev.score) prev.score = r.score;
    if (r.plates > prev.plates) prev.plates = r.plates;
    if (r.trickScore > prev.trickScore) prev.trickScore = r.trickScore;
  }
  if (r.medal > 0) p.unlocked = Math.min(MISSION_COUNT, Math.max(p.unlocked, id + 1));
  return improved;
}

export function sanitizeRider(r: unknown): RiderProfile {
  const o = (r && typeof r === 'object' ? r : {}) as Partial<RiderProfile>;
  const colors = [...BASIC_COLORS, ...SPECIAL_LIVERIES.map((l) => l.id)].includes(String(o.colors)) ? String(o.colors) : DEFAULT_RIDER.colors;
  const n = Math.max(1, Math.min(99, parseInt(String(o.number), 10) || 77));
  const name = String(o.name ?? DEFAULT_RIDER.name)
    .toUpperCase()
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .slice(0, 12);
  return { colors, number: String(n), name: name || DEFAULT_RIDER.name };
}

/** Guarda el mejor tiempo del dia; devuelve true si mejora. */
export function recordDaily(p: Progress, key: string, time: number, medal: number): boolean {
  const prev = p.daily[key];
  if (prev && prev.time <= time) return false;
  p.daily[key] = { time, medal: Math.max(medal, prev?.medal ?? 0) };
  // Solo los ultimos 30 dias.
  const keys = Object.keys(p.daily).sort();
  while (keys.length > 30) delete p.daily[keys.shift() as string];
  return true;
}

const GHOST_KEY = 'holeshot:ghost:';

/** Fantasma de tu mejor vuelta en una pista ('d:AAAA-MM-DD' o 'm:N'). */
export function loadGhostToken(track: string, storage: Storage | null = safeStorage()): string | null {
  try {
    return storage?.getItem(GHOST_KEY + track) ?? null;
  } catch {
    return null;
  }
}

export function saveGhostToken(track: string, token: string, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(GHOST_KEY + track, token);
    // Limpia fantasmas diarios de hace mas de una semana.
    if (!storage) return;
    const old: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(GHOST_KEY + 'd:') && k.slice(GHOST_KEY.length + 2) < new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)) old.push(k);
    }
    old.forEach((k) => storage.removeItem(k));
  } catch {
    /* sin almacenamiento */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
