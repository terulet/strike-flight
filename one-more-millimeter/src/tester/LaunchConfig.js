/**
 * LaunchConfig - the ONE place the app reads the URL.
 *
 * Everything here is hostile input: these links get pasted into WhatsApp, forwarded,
 * edited by hand and mangled by link previews. Every value is validated, clamped and
 * length-limited, and anything unrecognised falls back to the normal game rather
 * than breaking it.
 *
 * Nothing in this file may change physics or scoring - it only decides which
 * challenge is loaded, who you are hunting, and whether tester tooling is visible.
 */

/** Hard caps so a crafted link can never blow up storage or layout. */
export const LIMITS = {
  nameMax: 16,
  challengeMax: 40,
  rivals: 6,
  scoreMinMm: 0.0001,
  scoreMaxMm: 500,
};

/**
 * A whitelist, not a blacklist: letters (any script, so accents survive), digits,
 * and a handful of separators. Everything else - markup, control characters, bidi
 * overrides, backticks, braces - is simply not a name.
 */
const NAME_ALLOWED = /[^\p{L}\p{M}\p{N} ._'-]/gu;

/**
 * Strips invisibles and markup, collapses whitespace and truncates. Used for every
 * human-supplied string (URL rivals AND the player's own name), so nothing that
 * reaches the DOM or the report can carry markup.
 */
export function sanitizeName(raw, max = LIMITS.nameMax) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFC')
    .replace(NAME_ALLOWED, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Challenge ids also become storage keys and RNG seeds, so keep them boring. */
export function sanitizeChallengeId(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, LIMITS.challengeMax);
}

/** A rival score in millimetres. Rejects NaN, negatives, zero and absurd values. */
export function parseScoreMm(raw) {
  const n = typeof raw === 'number'
    ? raw
    : Number(String(raw == null ? '' : raw).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n < LIMITS.scoreMinMm || n > LIMITS.scoreMaxMm) return null;
  // Full precision is kept on purpose: 0.4388 mm must stay 0.4388 mm internally.
  return n;
}

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', '']);
const boolParam = (v) => v !== null && TRUE_VALUES.has(String(v).toLowerCase());

/**
 * `rivals=Marc:1.42,Yoli:0.88` - the compact multi-rival form.
 * The single-rival form is `rival=Marc&score=1.42`.
 */
export function parseRivalList(raw) {
  if (typeof raw !== 'string' || !raw) return [];
  const out = [];
  for (const chunk of raw.split(',')) {
    if (out.length >= LIMITS.rivals) break;
    const idx = chunk.lastIndexOf(':');
    if (idx <= 0) continue;
    const name = sanitizeName(chunk.slice(0, idx));
    const mm = parseScoreMm(chunk.slice(idx + 1));
    if (!name || mm == null) continue;
    if (out.some((r) => r.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, mm });
  }
  return out;
}

const MODES = new Set(['quick', 'three', 'daily', 'beat']);

/**
 * @param {string|URLSearchParams} [search]
 * @returns a frozen, fully validated config. Never throws.
 */
export function parseLaunchConfig(search) {
  const input = search === undefined
    ? (typeof location !== 'undefined' ? location.search : '')
    : search;
  const cfg = {
    challengeId: null,
    rivals: [],
    targetName: null,
    solo: false,
    mode: null,
    lang: null,
    surfaceId: null,
    objectId: null,
    pe: null,
    tester: false,
    report: false,
    debug: false,
    noCache: false,
    playerName: null,
    invalid: [],
  };

  let q;
  try {
    q = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  } catch (e) {
    return Object.freeze(cfg);
  }

  const get = (k) => (q.has(k) ? q.get(k) : null);
  const note = (k) => cfg.invalid.push(k);

  const challenge = get('challenge');
  if (challenge !== null) {
    const id = sanitizeChallengeId(challenge);
    if (id) cfg.challengeId = id; else note('challenge');
  }

  const rivalName = get('rival');
  if (rivalName !== null) {
    const name = sanitizeName(rivalName);
    const mm = parseScoreMm(get('score'));
    if (name && mm != null) cfg.rivals.push({ name, mm });
    else note('rival');
  }
  const list = parseRivalList(get('rivals'));
  for (const r of list) {
    if (cfg.rivals.length >= LIMITS.rivals) break;
    if (!cfg.rivals.some((x) => x.name.toLowerCase() === r.name.toLowerCase())) cfg.rivals.push(r);
  }
  if (get('rivals') !== null && !list.length) note('rivals');

  const target = get('target');
  if (target !== null) {
    const name = sanitizeName(target);
    if (name) cfg.targetName = name; else note('target');
  }

  cfg.solo = boolParam(get('solo'));
  cfg.tester = boolParam(get('tester'));
  cfg.report = boolParam(get('report'));
  cfg.debug = boolParam(get('debug'));
  cfg.noCache = boolParam(get('nocache'));

  const mode = get('mode');
  if (mode !== null) {
    const m = String(mode).toLowerCase();
    if (MODES.has(m)) cfg.mode = m; else note('mode');
  }

  const lang = get('lang');
  if (lang !== null) {
    const l = String(lang).slice(0, 2).toLowerCase();
    if (l === 'en' || l === 'es') cfg.lang = l; else note('lang');
  }

  const name = get('name');
  if (name !== null) {
    const n = sanitizeName(name);
    if (n) cfg.playerName = n; else note('name');
  }

  // Debug-only physics overrides, carried over from the previous milestone.
  const surface = get('surface');
  if (surface !== null) {
    const s = sanitizeChallengeId(surface);
    if (s) cfg.surfaceId = s; else note('surface');
  }
  const object = get('object');
  if (object !== null) {
    const o = sanitizeChallengeId(object);
    if (o) cfg.objectId = o; else note('object');
  }
  const pe = get('pe');
  if (pe !== null) {
    const n = Number(pe);
    if (Number.isFinite(n) && n > 0.2 && n < 0.95) cfg.pe = n; else note('pe');
  }

  // A link carrying real rival scores is a tester link whether it says so or not.
  if (cfg.rivals.length || cfg.solo || cfg.report) cfg.tester = true;
  // Real rivals and solo are mutually exclusive; solo wins because it is explicit.
  if (cfg.solo) cfg.rivals = [];

  return Object.freeze({
    ...cfg,
    rivals: Object.freeze(cfg.rivals),
    invalid: Object.freeze(cfg.invalid),
  });
}

/** Builds a tester link. Used by the docs, the report screen and the tests. */
export function buildTesterLink(base, opts) {
  const o = opts || {};
  const rivals = o.rivals || [];
  const q = new URLSearchParams();
  q.set('tester', '1');
  if (o.challengeId) q.set('challenge', sanitizeChallengeId(o.challengeId));
  if (o.solo) q.set('solo', '1');
  else if (rivals.length === 1) {
    q.set('rival', rivals[0].name);
    q.set('score', String(rivals[0].mm));
  } else if (rivals.length > 1) {
    q.set('rivals', rivals.map((r) => r.name + ':' + r.mm).join(','));
  }
  if (o.targetName) q.set('target', o.targetName);
  if (o.mode) q.set('mode', o.mode);
  if (o.lang) q.set('lang', o.lang);
  return base + '?' + q.toString();
}
