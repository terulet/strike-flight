/**
 * Deterministic RNG. Used ONLY for challenge generation and simulated rivals —
 * never inside the physics step. Same seed, same everything, on every device.
 */

/** FNV-1a 32-bit — turns any string into a seed. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough, fully reproducible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromString(str) {
  return mulberry32(hashString(str));
}

/** Deterministic pick from an array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Deterministic float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}
