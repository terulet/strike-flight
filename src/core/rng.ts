/**
 * Aleatoriedad determinista.
 *
 * Todo lo que tenga que ser identico para todos los jugadores en un mismo dia
 * (retos, mutadores, marcadores de los rivales) sale de aqui: misma semilla,
 * misma partida. Nada de Math.random en la capa de meta.
 */

/** Hash de cadena -> entero de 32 bits (xmur3). Estable entre plataformas. */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Generador mulberry32: rapido, sin estado global, suficiente para un arcade. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  readonly seed: string;
  private next01: () => number;

  constructor(seed: string | number) {
    this.seed = String(seed);
    this.next01 = mulberry32(typeof seed === 'number' ? seed : hashString(this.seed));
  }

  /** [0,1) */
  next(): number {
    return this.next01();
  }

  /** [min,max) en coma flotante. */
  range(min: number, max: number): number {
    return min + this.next01() * (max - min);
  }

  /** [min,max] entero, ambos incluidos. */
  int(min: number, max: number): number {
    return Math.floor(min + this.next01() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next01() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick sobre una lista vacia');
    return items[Math.floor(this.next01() * items.length)] as T;
  }

  /** Copia barajada (Fisher-Yates). No muta la entrada. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next01() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** Deriva un generador hijo etiquetado, sin consumir este. */
  derive(label: string): Rng {
    return new Rng(`${this.seed}::${label}`);
  }
}

/** Atajo: crea un Rng a partir de varias piezas ("2026-08-18", "pulse", "marc"). */
export function seedFrom(...parts: (string | number)[]): string {
  return parts.map((p) => String(p)).join('|');
}
