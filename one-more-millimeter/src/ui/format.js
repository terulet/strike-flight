/**
 * Number formatting. The better the score, the more decimals we show — precision
 * is part of the drama (spec 87). Nothing here ever invents digits: the value comes
 * straight from the simulation.
 */
import { MM_PER_UNIT } from '../config/PhysicsConfig.js';

export const toMm = (metres) => metres * MM_PER_UNIT;
export const toMetres = (mm) => mm / MM_PER_UNIT;

/** Decimals to use for a distance in millimetres. */
export function decimalsFor(mm) {
  const a = Math.abs(mm);
  if (a >= 100) return 0;
  if (a >= 10) return 1;
  if (a >= 0.1) return 2;
  if (a >= 0.01) return 3;
  return 4;
}

export function formatMm(mm, extraDecimals = 0) {
  if (!Number.isFinite(mm)) return '--';
  const a = Math.abs(mm);
  const d = Math.min(6, decimalsFor(mm) + extraDecimals);
  const out = a.toFixed(d);
  // Never print a flat 0.0000 for a positive result: perfection is not a thing you
  // can reach in this game, so the UI must not claim it (spec 37).
  if (a > 0 && Number(out) === 0) return a.toExponential(1);
  return out;
}

export function formatMmUnit(mm, extraDecimals = 0) {
  return `${formatMm(mm, extraDecimals)} mm`;
}

/**
 * Formats a value with just enough decimals to be visually distinct from its
 * neighbours in a leaderboard — so two entries never both read "0.43" while one
 * of them is actually ahead (spec 86).
 */
export function formatMmDistinct(mm, others = []) {
  for (let extra = 0; extra <= 3; extra++) {
    const s = formatMm(mm, extra);
    const clash = others.some((o) => o !== mm && formatMm(o, extra) === s);
    if (!clash) return s;
  }
  return formatMm(mm, 3);
}

/** Signed difference copy: "0.30 mm". */
export function formatGap(mmA, mmB) {
  return formatMm(Math.abs(mmA - mmB));
}

export function formatCount(n) {
  return String(n | 0);
}

export function formatDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's key, UTC — deliberately explicit so every player worldwide plays the
 *  same daily challenge at the same instant (spec 31). */
export function utcDayKey(now = new Date()) {
  return formatDate(now);
}
