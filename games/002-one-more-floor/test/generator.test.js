import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/config.js';
import { generateFloor, difficultyScale } from '../src/floors/generator.js';
import { FloorManager } from '../src/floors/floorManager.js';
import { hasEntity } from '../src/floors/registry.js';
import '../src/floors/hazards/index.js';

test('a generated floor is the same every time you meet it', () => {
  for (const n of [21, 37, 58, 104]) {
    const a = generateFloor(n);
    const b = generateFloor(n);
    assert.deepEqual(a, b, `floor ${n} is not deterministic`);
  }
});

test('generated floors only use registered types', () => {
  for (let n = RULES.ENDLESS_START; n < 120; n++) {
    for (const e of generateFloor(n).entities || []) {
      assert.ok(hasEntity(e.type), `floor ${n} uses unknown type ${e.type}`);
    }
  }
});

test('difficulty ramps but is capped', () => {
  assert.ok(difficultyScale(21) >= 1);
  assert.ok(difficultyScale(21) < difficultyScale(50));
  assert.equal(difficultyScale(10_000), RULES.ENDLESS_MAX_SCALE);
  for (let n = 21; n < 300; n++) {
    const s = difficultyScale(n);
    assert.ok(s >= 1 && s <= RULES.ENDLESS_MAX_SCALE, `scale ${s} out of range at ${n}`);
  }
});

/**
 * The whole fairness promise rests on telegraphs staying readable. Speeding
 * the game up must never shorten a wind-up below the point where a human can
 * react to it.
 */
test('telegraphs never shrink below the readable minimum', () => {
  const MIN = { charge: 0.26, telegraph: 0.3, warn: 0.26 };
  for (let n = RULES.ENDLESS_START; n < 400; n++) {
    for (const e of generateFloor(n).entities || []) {
      for (const [key, min] of Object.entries(MIN)) {
        if (typeof e[key] === 'number') {
          assert.ok(e[key] >= min - 1e-9, `floor ${n}: ${e.type}.${key} = ${e[key]} < ${min}`);
        }
      }
    }
  }
});

test('cycle times get shorter but never hit zero or go negative', () => {
  for (let n = RULES.ENDLESS_START; n < 400; n++) {
    for (const e of generateFloor(n).entities || []) {
      for (const key of ['onTime', 'offTime', 'idleTime', 'burn']) {
        if (typeof e[key] === 'number') assert.ok(e[key] > 0.05, `floor ${n}: ${e.type}.${key}`);
      }
      if (e.path?.time != null) assert.ok(e.path.time > 0.2, `floor ${n}: path too fast`);
    }
  }
});

test('a boss lands on every tenth floor of the endless climb', () => {
  for (const n of [30, 40, 70, 130]) {
    assert.ok(generateFloor(n).entities.some((e) => e.type === 'boss'), `floor ${n} should be a boss`);
  }
  for (const n of [31, 42, 55, 68]) {
    assert.equal(generateFloor(n).entities.some((e) => e.type === 'boss'), false);
  }
});

test('boss health grows with the climb but is capped', () => {
  const hp = (n) => generateFloor(n).entities.find((e) => e.type === 'boss').hp;
  assert.ok(hp(30) >= 4);
  assert.ok(hp(200) >= hp(30));
  assert.ok(hp(5000) <= 6);
});

test('generated floors drop the teaching hints', () => {
  for (const n of [21, 33, 47]) assert.equal(generateFloor(n).hint, null);
});

test('the floor manager keeps its cache bounded during a long climb', () => {
  const fm = new FloorManager();
  for (let n = 1; n <= 400; n++) fm.definitionFor(n);
  assert.ok(fm.cache.size <= 64, `cache grew to ${fm.cache.size}`);
});

test('authored floors are never generated', () => {
  const fm = new FloorManager();
  for (let n = 1; n <= 20; n++) assert.equal(fm.definitionFor(n).generated, undefined);
  assert.equal(fm.definitionFor(21).generated, true);
});
