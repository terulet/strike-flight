/**
 * Rival config — real tester scores, without a backend.
 *
 * Two sources, in order of precedence:
 *   1. the link itself  (?rival=Marc&score=1.42  /  ?rivals=Marc:1.42,Yoli:0.88)
 *   2. tester-challenges.json, keyed by challenge id, for groups you do not want
 *      to re-link every round
 *
 * Both are optional. If neither is present the game falls back to its simulated
 * rivals exactly as before, and if the JSON is missing, malformed, slow or blocked,
 * the game starts anyway.
 */
import { sanitizeName, parseScoreMm, sanitizeChallengeId, LIMITS } from './LaunchConfig.js';

const CONFIG_URL = './tester-challenges.json';
const TIMEOUT_MS = 1200;

/** Validates one entry of the JSON file. Returns null if it is not usable. */
function coerceRival(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = sanitizeName(raw.name);
  const mm = parseScoreMm(raw.scoreMm ?? raw.mm ?? raw.score);
  if (!name || mm == null) return null;
  return { name, mm };
}

/**
 * @returns {Promise<{rivals: Array, targetName: string|null, label: string|null, source: string}>}
 */
export async function loadRivalConfig(challengeId, fetchImpl) {
  const empty = { rivals: [], targetName: null, label: null, source: 'none' };
  const id = sanitizeChallengeId(challengeId || '');
  if (!id) return empty;

  const f = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!f) return empty;

  let json;
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), TIMEOUT_MS);
    const res = await f(CONFIG_URL, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' });
    clearTimeout(timer);
    if (!res || !res.ok) return empty;
    json = await res.json();
  } catch (e) {
    // Missing file, offline, blocked, malformed: the game does not care.
    return empty;
  }

  try {
    const table = json && json.challenges;
    const entry = table && typeof table === 'object' ? table[id] : null;
    if (!entry) return empty;
    const rivals = Array.isArray(entry.rivals)
      ? entry.rivals.map(coerceRival).filter(Boolean).slice(0, LIMITS.rivals)
      : [];
    const targetName = entry.target ? sanitizeName(entry.target) : null;
    const label = entry.label ? sanitizeName(entry.label, 40) : null;
    return { rivals, targetName: targetName || null, label, source: rivals.length ? 'json' : 'none' };
  } catch (e) {
    return empty;
  }
}

/**
 * Merges the link and the file. The link always wins, so a freshly generated
 * WhatsApp link never gets overridden by a stale committed file.
 */
export function mergeRivalSources(launch, fromJson) {
  if (launch.solo) return { rivals: [], targetName: null, source: 'solo' };
  if (launch.rivals.length) {
    return { rivals: launch.rivals.slice(), targetName: launch.targetName, source: 'link' };
  }
  if (fromJson && fromJson.rivals.length) {
    return {
      rivals: fromJson.rivals.slice(),
      targetName: launch.targetName || fromJson.targetName,
      source: 'json',
    };
  }
  return { rivals: [], targetName: null, source: 'simulated' };
}
