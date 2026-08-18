/**
 * End-to-end gameplay in the headless simulator: the same Room and Player the
 * browser runs, stepped by hand. These are the tests that would catch "the
 * floor cannot be finished" or "the hazard stopped hurting".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_DT } from '../src/core/loop.js';
import { PLAYER } from '../src/config.js';
import { buildFloor, run, NO_INPUT } from './helpers/sim.js';
import { STUCK } from '../src/floors/hazards/boss.js';
import '../src/floors/hazards/index.js';

/** The same heuristic the browser playtest bot uses: jump at gaps and walls. */
function runner(_step, { room, player }) {
  // Hold while rising: a real player keeps their thumb down for a full jump.
  if (!player.grounded) return { press: false, held: player.vy < 0, swipeDown: false };
  const feet = player.y + player.h;
  const probe = player.cx + player.dir * 34;
  const ground = room.solids.some((s) =>
    probe > s.x - 2 && probe < s.x + s.w + 2 && s.y > feet - 6 && s.y < feet + 26);
  const bx = player.dir > 0 ? player.x + player.w : player.x - 26;
  const blocked = room.solids.some((s) =>
    bx < s.x + s.w && bx + 26 > s.x && player.y + 6 < s.y + s.h && player.y + player.h - 4 > s.y && s.y < feet - 4);
  // Anything lethal sitting in the way at foot height also gets jumped.
  const hazardAhead = room.hazards.some((h) => {
    const hx = h.kind === 'circle' ? h.x - h.r : h.x;
    const hw = h.kind === 'circle' ? h.r * 2 : h.w;
    const hy = h.kind === 'circle' ? h.y : h.y + h.h / 2;
    const near = player.dir > 0 ? hx : hx + hw;
    const front = player.dir > 0 ? player.x + player.w : player.x;
    const gap = (near - front) * player.dir;
    return gap > -8 && gap < 16 && hy > player.y && hy < feet + 20;
  });
  const jump = !ground || blocked || hazardAhead;
  return { press: jump, held: jump, swipeDown: false };
}

test('a plain runner clears the movement floors', () => {
  for (const n of [1, 3, 7, 11, 13]) {
    const state = buildFloor(n);
    const result = run(state, 14, runner);
    assert.equal(result.outcome, 'exit', `floor ${n} ended as ${result.outcome}${result.cause ? ' by ' + result.cause : ''}`);
  }
});

test('floor 1 cannot kill you however badly you play', () => {
  for (const script of [() => NO_INPUT, () => ({ press: true, held: true, swipeDown: false }), runner]) {
    const state = buildFloor(1);
    const result = run(state, 12, script);
    assert.notEqual(result.outcome, 'hazard');
    assert.notEqual(result.outcome, 'fall');
  }
});

test('standing still on a crumbling floor drops you', () => {
  const state = buildFloor(3);
  // Walk on, then plant your feet and wait.
  const result = run(state, 10, (_i, s) => (s.player.x > 120 && s.player.x < 200
    ? { press: false, held: true, swipeDown: false }
    : NO_INPUT));
  assert.equal(result.outcome, 'fall');
});

test('a saw is lethal on contact', () => {
  const state = buildFloor(2);
  const saw = state.room.entities.find((e) => e.type === 'saw');
  state.player.spawnSafe = 0;
  state.player.x = saw.pos.x - PLAYER.W / 2;
  state.player.y = saw.pos.y - PLAYER.H / 2;
  const cause = state.room.checkHazards(state.player);
  assert.equal(cause, 'saw');
});

test('the spawn safety window really does hold hazards off', () => {
  const state = buildFloor(2);
  const saw = state.room.entities.find((e) => e.type === 'saw');
  state.player.x = saw.pos.x - PLAYER.W / 2;
  state.player.y = saw.pos.y - PLAYER.H / 2;
  assert.ok(state.player.spawnSafe > 0);
  assert.equal(state.room.checkHazards(state.player), null);
});

test('a laser only kills while it is actually firing', () => {
  const state = buildFloor(4);
  const laser = state.room.entities.find((e) => e.type === 'laser');
  state.player.spawnSafe = 0;
  state.player.x = laser.x - 6;
  state.player.y = laser.y + 60;
  const seen = new Set();
  for (let i = 0; i < 60 * 6; i++) {
    state.room.update(FIXED_DT, state.ctx);
    seen.add(`${laser.phase}:${state.room.checkHazards(state.player) ? 'kill' : 'safe'}`);
  }
  assert.ok(seen.has('off:safe'), 'a dormant beam must be safe to stand in');
  assert.ok(seen.has('charge:safe'), 'the wind-up must be survivable — that is the whole point of it');
  assert.ok(seen.has('on:kill'), 'a firing beam must kill');
});

test('landing on a drone kills the drone, not the player', () => {
  const state = buildFloor(15);
  const walker = state.room.entities.find((e) => e.type === 'walker');
  assert.ok(walker, 'floor 15 should have drones');
  let stomped = null;
  state.ctx.onWalkerStomp = (w) => { stomped = w; };
  state.player.spawnSafe = 0;
  state.player.x = walker.x;
  state.player.y = walker.y - PLAYER.H;
  state.player.vy = 300;
  state.room.checkStomps(state.player, state.ctx);
  assert.equal(walker.alive, false);
  assert.equal(stomped, walker);
  assert.equal(state.room.checkHazards(state.player), null, 'a dead drone must stop being lethal');
});

test('a drone is still lethal when you run into its side', () => {
  const state = buildFloor(15);
  const walker = state.room.entities.find((e) => e.type === 'walker');
  state.player.spawnSafe = 0;
  state.player.x = walker.x;
  state.player.y = walker.y;
  assert.equal(state.room.checkHazards(state.player), 'enemy');
});

test('the boss takes three hits and only then opens the way up', () => {
  const state = buildFloor(10);
  const boss = state.room.boss;
  assert.equal(state.room.exitLocked, true);
  const hits = [];
  state.ctx.onBossHit = (_b, hp) => hits.push(hp);

  for (let round = 0; round < boss.maxHp; round++) {
    let guard = 0;
    while (boss.phase !== STUCK && guard++ < 60 * 20) state.room.update(FIXED_DT, state.ctx);
    assert.equal(boss.vulnerable, true, 'the boss should expose its core after a slam');
    // Land on the crown.
    state.player.x = boss.x + boss.w / 2 - PLAYER.W / 2;
    state.player.y = boss.topSolid.y - PLAYER.H;
    state.player.vy = 200;
    state.player.grounded = true;
    state.player.rideId = boss.topSolid.id;
    assert.equal(state.room.checkBossStomp(state.player, state.ctx), true);
  }

  assert.equal(boss.hp, 0);
  assert.deepEqual(hits, [2, 1, 0]);
  assert.equal(boss.defeated, true);
  assert.equal(state.room.exitLocked, false, 'beating it must unlock the exit');
  assert.equal(state.room.checkHazards(state.player), null, 'a dead boss must stop being lethal');
});

test('the boss body hurts while it is on the move', () => {
  const state = buildFloor(10);
  const boss = state.room.boss;
  state.player.spawnSafe = 0;
  state.player.x = boss.x + boss.w / 2;
  state.player.y = boss.y + boss.h / 2;
  assert.equal(state.room.checkHazards(state.player), 'boss');
});

test('falling out of the room is a death, not an infinite drop', () => {
  const state = buildFloor(5);
  const result = run(state, 10, () => NO_INPUT);
  assert.equal(result.outcome, 'fall');
});

test('a floor cleared once can be cleared again from a fresh build', () => {
  const first = run(buildFloor(1), 14, runner);
  const second = run(buildFloor(1), 14, runner);
  assert.equal(first.outcome, 'exit');
  assert.equal(second.outcome, 'exit');
  assert.equal(first.step, second.step, 'the simulation must be deterministic');
});
