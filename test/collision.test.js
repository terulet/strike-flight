import test from 'node:test';
import assert from 'node:assert/strict';
import { moveAndCollide, groundUnder, overlapsAny } from '../src/systems/collision.js';

const body = (x, y, w = 20, h = 30) => ({ x, y, w, h });
const s = (x, y, w, h, extra = {}) => ({ x, y, w, h, id: `${x},${y}`, ...extra });

test('falling onto a floor lands exactly on top of it', () => {
  const b = body(0, 60);
  const r = moveAndCollide(b, 0, 40, [s(-50, 100, 200, 20)]);
  assert.equal(b.y, 70);
  assert.equal(r.hitBottom, true);
  assert.equal(r.ground.id, '-50,100');
});

test('running into a wall stops flush against it', () => {
  const b = body(0, 0);
  const r = moveAndCollide(b, 40, 0, [s(30, -10, 20, 60)]);
  assert.equal(b.x, 10);
  assert.equal(r.hitRight, true);
  assert.equal(r.hitLeft, false);
});

test('a jump into a ceiling is stopped from below', () => {
  const b = body(0, 50);
  const r = moveAndCollide(b, 0, -40, [s(-50, 0, 200, 20)]);
  assert.equal(b.y, 20);
  assert.equal(r.hitTop, true);
});

test('one-way platforms are solid from above and empty from below', () => {
  const platform = [s(0, 100, 100, 10, { oneWay: true })];
  const rising = body(20, 130);
  moveAndCollide(rising, 0, -40, platform);
  assert.equal(rising.y, 90, 'passes upwards through it');

  const falling = body(20, 60);
  const r = moveAndCollide(falling, 0, 45, platform);
  assert.equal(falling.y, 70, 'lands on it coming down');
  assert.equal(r.hitBottom, true);
});

test('a one-way platform never blocks horizontal movement', () => {
  const b = body(0, 100);
  const r = moveAndCollide(b, 40, 0, [s(30, 100, 20, 60, { oneWay: true })]);
  assert.equal(b.x, 40);
  assert.equal(r.hitRight, false);
});

test('the ground probe only sees what is directly underfoot', () => {
  const solids = [s(0, 100, 100, 10)];
  assert.ok(groundUnder(body(20, 70), solids));
  assert.equal(groundUnder(body(20, 40), solids), null);
  assert.equal(groundUnder(body(200, 70), solids), null);
});

test('overlapsAny reports the box it hit', () => {
  const boxes = [s(0, 0, 10, 10), s(50, 50, 10, 10)];
  assert.equal(overlapsAny(52, 52, 4, 4, boxes).id, '50,50');
  assert.equal(overlapsAny(30, 30, 4, 4, boxes), null);
});
