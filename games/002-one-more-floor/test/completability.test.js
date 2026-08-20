/**
 * "Can this floor actually be finished?"
 *
 * A pass is real evidence: some sequence of one-finger inputs reaches the
 * exit inside the simulation the game itself runs. A failure is a prompt to
 * go and look at the floor — every one of these that fired during
 * development turned out to be a genuine design fault.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORED_COUNT, FLOORS } from '../src/floors/definitions.js';
import { trySolve } from './helpers/pilot.js';
import '../src/floors/hazards/index.js';

const BOSS_FLOORS = FLOORS.map((f, i) => (f.boss ? i + 1 : null)).filter(Boolean);

test('every authored floor can be finished', () => {
  const failed = [];
  for (let n = 1; n <= AUTHORED_COUNT; n++) {
    if (BOSS_FLOORS.includes(n)) continue;
    if (!trySolve(n)) failed.push(`${n} (${FLOORS[n - 1].name})`);
  }
  assert.deepEqual(failed, [], `floors that could not be finished: ${failed.join(', ')}`);
});

test('both boss fights can be won', () => {
  for (const n of BOSS_FLOORS) {
    const solved = trySolve(n, { boss: true, attempts: 60, seconds: 45 });
    assert.ok(solved, `floor ${n} (${FLOORS[n - 1].name}) could not be beaten`);
  }
});

test('generated floors stay finishable as the climb speeds up', () => {
  const failed = [];
  for (const n of [21, 23, 25, 27, 29, 31, 34, 37, 41, 47]) {
    if (!trySolve(n, { attempts: 300 })) failed.push(n);
  }
  assert.deepEqual(failed, [], `generated floors that could not be finished: ${failed.join(', ')}`);
});
