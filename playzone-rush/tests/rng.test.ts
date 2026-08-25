import { describe, expect, it } from 'vitest';
import { Rng, hashString, seedFrom } from '../src/core/rng';

describe('rng determinista', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = new Rng('playzone');
    const b = new Rng('playzone');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('semillas distintas divergen', () => {
    const a = new Rng('2026-08-18');
    const b = new Rng('2026-08-19');
    expect(a.next()).not.toBe(b.next());
  });

  it('los valores estan en [0,1)', () => {
    const rng = new Rng('rango');
    for (let i = 0; i < 500; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() respeta los limites inclusive', () => {
    const rng = new Rng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(rng.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('shuffle no muta la entrada y conserva los elementos', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const rng = new Rng('shuffle');
    const out = rng.shuffle(input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(out.slice().sort()).toEqual(input.slice().sort());
  });

  it('hashString es estable', () => {
    expect(hashString('marc')).toBe(hashString('marc'));
    expect(hashString('marc')).not.toBe(hashString('kali'));
  });

  it('seedFrom compone piezas legibles', () => {
    expect(seedFrom('2026-08-18', 'c1', 'pulse')).toBe('2026-08-18|c1|pulse');
  });

  it('derive() no consume el generador padre', () => {
    const parent = new Rng('padre');
    const first = parent.next();
    const parent2 = new Rng('padre');
    parent2.derive('hijo');
    expect(parent2.next()).toBe(first);
  });
});
