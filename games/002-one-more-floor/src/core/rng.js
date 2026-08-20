/**
 * Deterministic PRNG (mulberry32). Every generated floor derives its layout
 * from its floor number, so "floor 37" is always the same floor: fair, and
 * learnable. No Math.random anywhere in gameplay.
 */

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Float in [lo, hi). */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** Integer in [lo, hi]. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

/** Mixes two integers into a stable seed (floor number + salt). */
export const seedFrom = (a, b = 0) =>
  (Math.imul(a >>> 0 || 1, 0x9e3779b1) ^ Math.imul(b >>> 0 || 1, 0x85ebca6b)) >>> 0;
