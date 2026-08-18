/**
 * PRNG con semilla (mulberry32). Determinista → un mismo intento se puede
 * repetir tal cual mientras balanceamos, en vez de pelearse con Math.random.
 */
export class Rng {
  constructor(seed = 0x9e3779b9) { this.seed = seed >>> 0; }

  /** [0, 1) */
  next() {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo, hi) { return lo + this.next() * (hi - lo); }
  int(lo, hi) { return Math.floor(this.range(lo, hi + 1)); }
  /** [-a, a] */
  spread(a) { return (this.next() * 2 - 1) * a; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
}

/** Instancia compartida. Se re-siembra en cada reinicio de partida. */
export const rng = new Rng();
