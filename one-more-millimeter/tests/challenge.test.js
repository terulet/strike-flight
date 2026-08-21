import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChallenge, createDailyChallenge, dailyId, launchSpeedFor, marginForPower, powerForMargin } from '../src/game/Challenge.js';
import { simulateShot } from '../src/physics/Simulation.js';
import { designTravel, sensitivityMmPerMs } from '../src/physics/calibration.js';
import { GameConfig } from '../src/config/GameConfig.js';
import { rivalsFor, targetRival, medianMmForSkill } from '../src/game/Rivals.js';
import { hashString, mulberry32 } from '../src/core/rng.js';

test('the same date always builds the same daily challenge', () => {
  const d = new Date('2026-08-21T09:15:00Z');
  const a = createDailyChallenge(d);
  const b = createDailyChallenge(new Date('2026-08-21T23:59:59Z'));
  assert.equal(a.id, b.id);
  assert.equal(a.objectId, b.objectId);
  assert.equal(a.surfaceId, b.surfaceId);
  assert.equal(a.mutatorId, b.mutatorId);
  assert.equal(a.pe, b.pe);
  assert.equal(a.setup.startX, b.setup.startX);
});

test('a different date builds a different challenge', () => {
  const a = createDailyChallenge(new Date('2026-08-21T09:00:00Z'));
  const b = createDailyChallenge(new Date('2026-08-22T09:00:00Z'));
  assert.notEqual(a.id, b.id);
  const different = a.objectId !== b.objectId || a.surfaceId !== b.surfaceId || Math.abs(a.pe - b.pe) > 1e-9;
  assert.ok(different, 'two consecutive dailies should not be identical');
});

test('the daily id is UTC based and stable', () => {
  assert.equal(dailyId(new Date('2026-01-02T23:30:00Z')), 'daily-2026-01-02');
  assert.equal(dailyId(new Date('2026-01-03T00:30:00Z')), 'daily-2026-01-03');
});

test('the seed is stable across runs', () => {
  assert.equal(hashString('daily-2026-08-21'), hashString('daily-2026-08-21'));
  const r1 = mulberry32(1234); const r2 = mulberry32(1234);
  for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
});

test('every challenge puts the brink inside the meter', () => {
  for (let i = 0; i < 60; i++) {
    const ch = createChallenge(`sweep-${i}`);
    assert.ok(ch.pe >= GameConfig.window.edgePowerMin - 1e-9);
    assert.ok(ch.pe <= GameConfig.window.edgePowerMax + 1e-9);
    // Zero power must be safe, full power must be a fall: the meter always spans the answer.
    assert.ok(marginForPower(ch, 0) > 0.005, `challenge ${i} is unfair at zero power`);
    assert.ok(marginForPower(ch, 1) < 0, `challenge ${i} cannot be overshot`);
  }
});

test('the calibrated launch speed realises the design curve on the real simulation', () => {
  for (const id of ['calib-a', 'calib-b', 'calib-c', 'calib-d']) {
    const ch = createChallenge(id);
    for (const p of [0, 0.25, 0.5, ch.pe, 0.9, 1]) {
      const v = launchSpeedFor(ch, p);
      const r = simulateShot(ch.setup, v, { derived: ch.derived, ignoreEdge: true });
      const err = Math.abs(r.travelM - designTravel(p, ch.surface));
      assert.ok(err < 1e-6, `${id} p=${p} error ${err}`);
    }
  }
});

test('power at the brink actually lands on the brink', () => {
  for (const id of ['brink-1', 'brink-2', 'brink-3']) {
    const ch = createChallenge(id);
    const safe = simulateShot(ch.setup, launchSpeedFor(ch, ch.pe - 0.002), { derived: ch.derived });
    const over = simulateShot(ch.setup, launchSpeedFor(ch, ch.pe + 0.002), { derived: ch.derived });
    assert.equal(safe.fell, false);
    assert.equal(over.fell, true);
    assert.ok(safe.marginM < 0.004, 'just under the brink should be a tiny margin');
  }
});

test('power and margin are inverse of each other', () => {
  const ch = createChallenge('inverse');
  for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const m = marginForPower(ch, p);
    assert.ok(Math.abs(powerForMargin(ch, m) - p) < 1e-9);
  }
});

test('difficulty stays inside the designed band on every surface', () => {
  for (let i = 0; i < 40; i++) {
    const ch = createChallenge(`band-${i}`);
    const s = sensitivityMmPerMs(ch.pe, ch.surface);
    // Roughly: 10 ms of human slop must cost between 1 mm and 5 mm.
    assert.ok(s > 0.10 && s < 0.50, `sensitivity ${s} out of band for ${ch.surfaceId}`);
  }
});

test('rivals are deterministic per challenge and ordered', () => {
  const ch = createChallenge('rival-test');
  const a = rivalsFor(ch);
  const b = rivalsFor(ch);
  assert.deepEqual(a.map((r) => r.id), b.map((r) => r.id));
  assert.deepEqual(a.map((r) => r.mm), b.map((r) => r.mm));
  for (let i = 1; i < a.length; i++) assert.ok(a[i].marginM >= a[i - 1].marginM);
  assert.ok(medianMmForSkill(0.93) < medianMmForSkill(0.62));
});

test('the hunted rival is always the closest one still ahead', () => {
  const ch = createChallenge('target-test');
  const rivals = rivalsFor(ch);
  const mid = rivals[2].marginM + 1e-5;
  const t = targetRival(rivals, mid);
  assert.ok(t);
  assert.ok(t.marginM < mid);
  assert.equal(t.id, rivals[2].id);
  assert.equal(targetRival(rivals, 0), null, 'leading the board means no target');
});
