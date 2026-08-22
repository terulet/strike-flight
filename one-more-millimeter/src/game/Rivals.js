/**
 * Rivals — simulated friends. Everything is derived from (challengeId, rivalId), so a
 * rival's score is stable across reloads and identical for every player on the same
 * challenge. When a backend arrives, `fetchRivals` is the only function that changes.
 */
import { rngFromString } from '../core/rng.js';
import { OBJECTS } from '../config/objects.js';
import { powerForMargin } from './Challenge.js';
import { toMetres } from '../ui/format.js';

export const ROSTER = [
  { id: 'silvia', name: 'SILVIA', skill: 0.93, color: '#ff2fd0' },
  { id: 'marc', name: 'MARC', skill: 0.875, color: '#59c2ff' },
  { id: 'eloi', name: 'ELOI', skill: 0.80, color: '#3ddc97' },
  { id: 'yoli', name: 'YOLI', skill: 0.72, color: '#ffd166' },
  { id: 'kali', name: 'KALI', skill: 0.62, color: '#ff8a5b' },
];

/** Box-Muller from a seeded uniform source — deterministic normal noise. */
function normal(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Median result (mm) a given skill level lands on. Tuned against the harness. */
export function medianMmForSkill(skill) {
  return 30 * Math.pow(Math.max(0.02, 1 - skill), 1.6);
}

/**
 * One rival's attempt at one challenge.
 * @returns {{id,name,color,marginM,mm,objectId,power,at,challengeId}}
 */
export function rivalScore(challenge, rival) {
  const rng = rngFromString(`${challenge.id}::${rival.id}`);
  const median = medianMmForSkill(rival.skill);
  const spread = Math.exp(normal(rng) * 0.45);
  let mm = median * spread;
  // Nobody is superhuman, and nobody on the board has fallen (falls do not score).
  mm = Math.min(Math.max(mm, 0.06), 120);
  const marginM = toMetres(mm);
  const objectId = OBJECTS[Math.floor(rng() * OBJECTS.length)].id;
  return {
    id: rival.id,
    name: rival.name,
    color: rival.color,
    isRival: true,
    marginM,
    mm,
    objectId,
    /** Reconstructed input, so their ghost could be replayed shot-for-shot later. */
    power: powerForMargin(challenge, marginM),
    at: 0,
    challengeId: challenge.id,
  };
}

/** The whole board for a challenge, best first. */
export function rivalsFor(challenge, roster = ROSTER) {
  return roster
    .map((r) => rivalScore(challenge, r))
    .sort((a, b) => a.marginM - b.marginM);
}

/**
 * The rival to hunt: the closest one still ahead of the player, or the leader when
 * the player has not scored yet. This is the whole point of the game (spec 15/16).
 */
export function targetRival(rivals, playerMarginM) {
  if (playerMarginM == null) {
    // Start with someone beatable, not the untouchable leader.
    return rivals[Math.min(2, rivals.length - 1)] || rivals[0] || null;
  }
  let best = null;
  for (const r of rivals) {
    if (r.marginM < playerMarginM) best = best && best.marginM > r.marginM ? best : r;
  }
  // The tightest rival still ahead.
  const ahead = rivals.filter((r) => r.marginM < playerMarginM);
  if (ahead.length) return ahead[ahead.length - 1];
  return null; // player leads the board
}

/** Everyone the player just went past with this score. */
export function rivalsBeatenBy(rivals, marginM, previousMarginM) {
  const prev = previousMarginM == null ? Infinity : previousMarginM;
  return rivals.filter((r) => r.marginM > marginM && r.marginM <= prev);
}

/** Colours for real testers, assigned by position so a name always looks the same
 *  within one link. */
const REAL_COLORS = ['#ff2fd0', '#59c2ff', '#3ddc97', '#ffd166', '#ff8a5b', '#c56bff'];

/**
 * Real tester scores, injected from a link or the JSON config, turned into board
 * entries. They replace the simulated roster entirely — mixing invented people
 * with real ones would poison the only measurement this milestone cares about.
 *
 * @param {object} challenge
 * @param {Array<{name:string, mm:number}>} list already sanitised by LaunchConfig
 */
export function realRivals(challenge, list) {
  return list
    .map((r, i) => ({
      id: `real-${r.name.toLowerCase().replace(/[^a-z0-9]/g, '') || i}`,
      name: r.name.toUpperCase(),
      rawName: r.name,
      color: REAL_COLORS[i % REAL_COLORS.length],
      isRival: true,
      real: true,
      marginM: r.mm / 1000,
      mm: r.mm,
      // They played this exact challenge, so their ghost throws the same object.
      objectId: challenge.objectId,
      power: powerForMargin(challenge, r.mm / 1000),
      at: 0,
      challengeId: challenge.id,
    }))
    .sort((a, b) => a.marginM - b.marginM);
}

/** Finds a named rival on a board, case-insensitively. */
export function findRival(rivals, name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  return rivals.find((r) => r.name.toLowerCase() === n || (r.rawName || '').toLowerCase() === n) || null;
}

/** Async-shaped so a real backend can slot straight in. */
export async function fetchRivals(challenge) {
  return rivalsFor(challenge);
}
