import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, seedFrom } from '../src/core/rng.js';

test('the same seed always produces the same stream', () => {
  const a = makeRng(1234);
  const b = makeRng(1234);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test('different seeds diverge', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const sameCount = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean).length;
  assert.equal(sameCount, 0);
});

test('values stay inside their advertised ranges', () => {
  const r = makeRng(99);
  for (let i = 0; i < 500; i++) {
    const f = r.next();
    assert.ok(f >= 0 && f < 1);
    const n = r.int(3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7);
    const g = r.range(-5, 5);
    assert.ok(g >= -5 && g < 5);
  }
});

test('seedFrom is stable and mixes both inputs', () => {
  assert.equal(seedFrom(7, 3), seedFrom(7, 3));
  assert.notEqual(seedFrom(7, 3), seedFrom(3, 7));
  assert.ok(Number.isInteger(seedFrom(0, 0)));
});
