import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER } from '../src/config.js';
import { FIXED_DT } from '../src/core/loop.js';
import { Player } from '../src/game/player.js';
import { measureJump, NO_INPUT } from './helpers/sim.js';

const FLOOR = [{ x: -500, y: 400, w: 2000, h: 40, id: 'floor' }];
const settle = (p, steps = 90, cmd = NO_INPUT, solids = FLOOR) => {
  for (let i = 0; i < steps; i++) p.update(FIXED_DT, cmd, solids);
};

test('the bot lands, runs and reaches full speed on its own', () => {
  const p = new Player();
  p.reset(100, 300, 1);
  settle(p);
  assert.equal(p.grounded, true);
  assert.equal(p.y, 370);
  assert.ok(Math.abs(p.vx - PLAYER.RUN_SPEED) < 1, `vx ${p.vx}`);
});

/**
 * These bounds are the contract the floor layouts are authored against:
 * every mandatory gap is built for the SHORT jump, so a plain tap is always
 * enough. If the numbers move, the floors need re-checking.
 */
test('the jump arc stays inside the values the floors are designed for', () => {
  const full = measureJump({ hold: true });
  const short = measureJump({ hold: false });
  assert.ok(full.height > 68 && full.height < 78, `full height ${full.height}`);
  assert.ok(full.distance > 72 && full.distance < 82, `full distance ${full.distance}`);
  assert.ok(short.height > 34 && short.height < 44, `short height ${short.height}`);
  assert.ok(short.distance > 50 && short.distance < 60, `short distance ${short.distance}`);
  assert.ok(short.distance < full.distance);
});

test('coyote time lets you jump just after walking off a ledge', () => {
  const ledge = [{ x: 0, y: 400, w: 120, h: 40, id: 'ledge' }];
  const p = new Player();
  p.reset(80, 370, 1);
  settle(p, 30, NO_INPUT, ledge);
  while (p.grounded) p.update(FIXED_DT, NO_INPUT, ledge);
  // One frame into the fall, a tap must still be a jump.
  p.update(FIXED_DT, { press: true, held: true, swipeDown: false }, ledge);
  assert.ok(p.vy < 0, `expected upward velocity, got ${p.vy}`);
});

test('coyote time expires', () => {
  const ledge = [{ x: 0, y: 400, w: 120, h: 40, id: 'ledge' }];
  const p = new Player();
  p.reset(80, 370, 1);
  settle(p, 30, NO_INPUT, ledge);
  while (p.grounded) p.update(FIXED_DT, NO_INPUT, ledge);
  settle(p, Math.ceil(PLAYER.COYOTE / FIXED_DT) + 4, NO_INPUT, ledge);
  p.update(FIXED_DT, { press: true, held: true, swipeDown: false }, ledge);
  assert.ok(p.vy > 0, 'should still be falling');
});

test('a jump pressed slightly early is buffered until landing', () => {
  const p = new Player();
  // A few pixels above the floor: the press lands inside the buffer window.
  p.reset(100, 362, 1);
  p.vy = 200;
  p.update(FIXED_DT, { press: true, held: true, swipeDown: false }, FLOOR);
  let jumped = false;
  for (let i = 0; i < 40; i++) {
    p.update(FIXED_DT, { press: false, held: true, swipeDown: false }, FLOOR);
    if (p.vy < -100) { jumped = true; break; }
  }
  assert.ok(jumped, 'the buffered jump should fire on landing');
});

test('holding brings the bot to a stop and releasing sends it off again', () => {
  const p = new Player();
  p.reset(100, 300, 1);
  settle(p);
  settle(p, 60, { press: false, held: true, swipeDown: false });
  assert.ok(Math.abs(p.vx) < 1, `expected a standstill, got ${p.vx}`);
  assert.equal(p.braking, true);
  settle(p, 60, NO_INPUT);
  assert.ok(Math.abs(p.vx - PLAYER.RUN_SPEED) < 1);
});

test('a jump from a standstill still covers a full gap', () => {
  const p = new Player();
  p.reset(100, 300, 1);
  settle(p);
  settle(p, 60, { press: false, held: true, swipeDown: false });
  p.update(FIXED_DT, { press: true, held: true, swipeDown: false }, FLOOR);
  assert.ok(Math.abs(p.vx) >= PLAYER.RUN_SPEED - 1, `launch speed ${p.vx}`);
});

test('hitting a wall turns the bot around', () => {
  const solids = [...FLOOR, { x: 200, y: 300, w: 20, h: 100, id: 'wall' }];
  const p = new Player();
  p.reset(100, 370, 1);
  settle(p, 200, NO_INPUT, solids);
  assert.equal(p.dir, -1);
  assert.ok(p.x < 200);
});

test('a dive drops fast in the air and is a skid stop on the ground', () => {
  const air = new Player();
  air.reset(100, 100, 1);
  air.update(FIXED_DT, { press: false, held: false, swipeDown: true }, FLOOR);
  assert.equal(air.diving, true);
  assert.ok(air.vy >= PLAYER.DIVE_VEL - 20);

  const ground = new Player();
  ground.reset(100, 300, 1);
  settle(ground);
  ground.update(FIXED_DT, { press: false, held: false, swipeDown: true }, FLOOR);
  assert.equal(ground.diving, false, 'no dive state while already grounded');
  assert.ok(Math.abs(ground.vx) < 20, 'horizontal speed is killed instantly');
});

test('the hazard hitbox is strictly inside the collision box', () => {
  const p = new Player();
  p.reset(50, 50, 1);
  assert.ok(p.hitX > p.x);
  assert.ok(p.hitY > p.y);
  assert.ok(p.hitX + p.hitW < p.x + p.w);
  assert.ok(p.hitY + p.hitH < p.y + p.h);
});

test('a reset run always starts with a spawn safety window', () => {
  const p = new Player();
  p.reset(10, 10, 1);
  assert.ok(p.spawnSafe > 0);
  assert.equal(p.dead, false);
  assert.equal(p.vx, 0);
  assert.equal(p.vy, 0);
});

test('a moving platform carries the bot with it', () => {
  const plat = { x: 80, y: 400, w: 120, h: 12, id: 'plat', dx: 0, dy: 0 };
  const p = new Player();
  p.reset(120, 360, 1);
  settle(p, 40, { press: false, held: true, swipeDown: false }, [plat]);
  const before = p.x;
  for (let i = 0; i < 30; i++) {
    plat.dx = 0.5;
    plat.x += 0.5;
    p.update(FIXED_DT, { press: false, held: true, swipeDown: false }, [plat]);
  }
  assert.ok(p.x - before > 12, `expected to be carried, moved ${p.x - before}`);
});
