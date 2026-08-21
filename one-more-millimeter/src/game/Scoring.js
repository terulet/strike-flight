/**
 * Scoring — turning a settled simulation into a result the player can feel.
 */
import { GameConfig, zoneForMm } from '../config/GameConfig.js';
import { PhysicsConfig as P } from '../config/PhysicsConfig.js';
import { toMm } from '../ui/format.js';

export const OUTCOME = {
  STOPPED: 'stopped',
  FELL: 'fell',
};

/**
 * @param {object} sim    result from Simulation.buildResult
 * @param {object} ghost  the same shot simulated on an infinite platform, used to
 *                        measure honestly how far past the edge a fall went
 */
export function makeResult(sim, ghost, challenge, meta = {}) {
  const fell = sim.fell;
  const marginM = fell ? 0 : sim.marginM;
  const overshootM = fell ? Math.max(0, ghost.travelM - challenge.travelToEdge) : 0;
  const mm = toMm(marginM);
  const overshootMm = toMm(overshootM);
  const zone = fell ? null : zoneForMm(mm);
  const nearMiss = fell && overshootM <= GameConfig.tension.nearMissMargin;

  return {
    outcome: fell ? OUTCOME.FELL : OUTCOME.STOPPED,
    fell,
    valid: !fell,
    marginM,
    mm,
    overshootM,
    overshootMm,
    overhangMm: toMm(sim.overhangM || 0),
    hanging: !!sim.hanging,
    zone,
    zoneId: zone ? zone.id : 'fall',
    nearMiss,
    absurd: !fell && mm <= GameConfig.absurdMm,
    magnify: !fell && mm <= GameConfig.magnifierMm,
    travelM: sim.travelM,
    timeS: sim.timeS,
    launchSpeed: sim.launchSpeed,
    power: meta.power ?? null,
    holdMs: meta.holdMs ?? null,
    challengeId: challenge.id,
    physicsVersion: P.version,
  };
}

/** Lower is better; falls never beat a standing shot. */
export function isBetter(a, b) {
  if (!a || !a.valid) return false;
  if (!b || !b.valid) return true;
  return a.marginM < b.marginM - P.tieEpsilon;
}

/** -1 a wins, 1 b wins, 0 dead heat. */
export function compareMargins(aM, bM) {
  if (aM == null && bM == null) return 0;
  if (aM == null) return 1;
  if (bM == null) return -1;
  if (Math.abs(aM - bM) <= P.tieEpsilon) return 0;
  return aM < bM ? -1 : 1;
}

export function isTie(aM, bM) {
  return compareMargins(aM, bM) === 0;
}

/** Sorts leaderboard entries in place. Falls / missing scores sink to the bottom. */
export function sortEntries(entries) {
  return entries.sort((a, b) => compareMargins(a.marginM, b.marginM));
}

/** Where a margin would land in a list of entries (1-based). */
export function rankOf(marginM, entries) {
  let rank = 1;
  for (const e of entries) {
    if (e.marginM == null) continue;
    if (compareMargins(e.marginM, marginM) < 0) rank++;
  }
  return rank;
}

export function zoneOf(mm) {
  return zoneForMm(mm);
}
