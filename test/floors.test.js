import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../src/config.js';
import { FLOORS, AUTHORED_COUNT, FLOOR_Y } from '../src/floors/definitions.js';
import { hasEntity, entityTypes } from '../src/floors/registry.js';
import { FloorManager } from '../src/floors/floorManager.js';
import { mirrorDefinition, mirrorEntityDef } from '../src/floors/floorRuntime.js';
import { analyse } from './helpers/reach.js';
import '../src/floors/hazards/index.js';

const fm = new FloorManager();
const CHECK_UP_TO = 60; // 20 authored + 40 generated
/** Breathing room the player must have around the spawn before anything can hurt them. */
const CLEARANCE = 12;

test('the prototype ships the promised number of authored floors', () => {
  assert.equal(AUTHORED_COUNT, 20);
  assert.equal(FLOORS.length, 20);
});

test('floor ids and names are unique', () => {
  assert.equal(new Set(FLOORS.map((f) => f.id)).size, 20);
  assert.equal(new Set(FLOORS.map((f) => f.name)).size, 20);
});

test('every entity type used by a floor is registered', () => {
  const registered = new Set(entityTypes());
  for (const f of FLOORS) {
    for (const e of f.entities || []) {
      assert.ok(hasEntity(e.type), `floor ${f.id} uses unregistered type "${e.type}"`);
      assert.ok(registered.has(e.type));
    }
  }
});

test('nothing is authored outside the room', () => {
  for (const f of FLOORS) {
    for (const p of f.pits || []) {
      assert.ok(p.x >= 0 && p.x + p.w <= ROOM.W, `${f.id}: pit out of bounds`);
      assert.ok(p.w > 0);
    }
    for (const e of f.entities || []) {
      const xs = e.slots ? e.slots.map((sl) => sl.x) : [e.x];
      for (const x of xs) assert.ok(x >= -2 && x <= ROOM.W + 2, `${f.id}: ${e.type} x=${x}`);
      const ys = e.slots ? e.slots.map((sl) => sl.y) : [e.y ?? e.hoverY ?? 0];
      for (const y of ys) assert.ok(y >= -2 && y <= ROOM.H + 2, `${f.id}: ${e.type} y=${y}`);
    }
  }
});

test('the first floor cannot kill you', () => {
  const room = fm.build(1);
  assert.equal((FLOORS[0].pits || []).length, 0);
  assert.equal(room.hazards.length, 0, 'floor 1 must have no lethal shape at all');
});

test('the teaching floors all carry a hint', () => {
  for (const id of ['f01', 'f02', 'f03', 'f04', 'f05', 'f06']) {
    const f = FLOORS.find((x) => x.id === id);
    assert.ok(f.hint?.text, `${id} should teach something`);
  }
});

test('mirroring twice returns the original geometry', () => {
  for (const f of FLOORS) {
    const twice = mirrorDefinition(mirrorDefinition(f));
    for (let i = 0; i < (f.entities || []).length; i++) {
      const before = f.entities[i];
      const after = twice.entities[i];
      if (before.slots) {
        before.slots.forEach((sl, k) => assert.ok(Math.abs(after.slots[k].x - sl.x) < 1e-9,
          `${f.id}: door slot drifted when mirrored twice`));
      } else {
        assert.ok(Math.abs(after.x - before.x) < 1e-9,
          `${f.id}: ${before.type} drifted when mirrored twice`);
      }
    }
    for (let i = 0; i < (f.pits || []).length; i++) {
      assert.ok(Math.abs(twice.pits[i].x - f.pits[i].x) < 1e-9);
    }
  }
});

test('mirrored moving paths keep the same travel distance', () => {
  for (const f of FLOORS) {
    for (const e of f.entities || []) {
      if (!e.path?.to || e.path.type !== 'line') continue;
      const m = mirrorEntityDef(e);
      assert.ok(Math.abs((e.path.to.x - e.x) + (m.path.to.x - m.x)) < 1e-9,
        `${f.id}: ${e.type} path length changed when mirrored`);
    }
  }
});

test('every floor builds without throwing', () => {
  for (let n = 1; n <= CHECK_UP_TO; n++) {
    const room = fm.build(n);
    assert.ok(room.solids.length > 0, `floor ${n} has no geometry`);
    assert.ok(room.exitEntity, `floor ${n} has no way out`);
  }
});

test('the exit is reachable from the spawn on every floor', () => {
  const bad = [];
  for (let n = 1; n <= CHECK_UP_TO; n++) {
    const room = fm.build(n);
    const a = analyse(room);
    if (!a.exitReachable) bad.push(`${n} (${room.def.name})`);
  }
  assert.deepEqual(bad, [], `unreachable exits on floors: ${bad.join(', ')}`);
});

test('the spawn point is never inside geometry or a hazard', () => {
  for (let n = 1; n <= CHECK_UP_TO; n++) {
    const room = fm.build(n);
    const { x, y } = room.spawn;
    const w = 22;
    const h = 30;
    for (const s of room.solids) {
      const overlap = x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y;
      assert.equal(overlap, false, `floor ${n}: spawn is inside a solid`);
    }
    for (const hz of room.hazards) {
      if (hz.kind === 'circle') {
        const dx = Math.max(x - hz.x, 0, hz.x - (x + w));
        const dy = Math.max(y - hz.y, 0, hz.y - (y + h));
        assert.ok(Math.hypot(dx, dy) > hz.r + CLEARANCE, `floor ${n}: a saw starts on top of the spawn`);
      } else {
        const overlap = x - CLEARANCE < hz.x + hz.w && x + w + CLEARANCE > hz.x &&
                        y < hz.y + hz.h && y + h > hz.y;
        assert.equal(overlap, false, `floor ${n}: a ${hz.cause} starts on top of the spawn`);
      }
    }
  }
});

test('the way out is never blocked by a hazard at floor start', () => {
  for (let n = 1; n <= CHECK_UP_TO; n++) {
    const room = fm.build(n);
    // Where the player has to stand to leave.
    let zone;
    if (room.exitIsDoors) {
      const slot = room.exitEntity.exitSlot;
      zone = { x: slot.x + 6, y: slot.y + 4, w: slot.w - 12, h: slot.h - 4 };
    } else {
      const e = room.exitEntity;
      zone = { x: e.x, y: e.y - 20, w: e.w, h: e.h + 20 };
    }
    for (const hz of room.hazards) {
      if (hz.kind !== 'box') continue;
      const overlap = zone.x < hz.x + hz.w && zone.x + zone.w > hz.x &&
                      zone.y < hz.y + hz.h && zone.y + zone.h > hz.y;
      assert.equal(overlap, false, `floor ${n}: a ${hz.cause} is parked on the way out`);
    }
  }
});

test('every pit is bridged by something standable', () => {
  for (let n = 1; n <= CHECK_UP_TO; n++) {
    const room = fm.build(n);
    for (const pit of room.def.pits || []) {
      const bridged = room.entities.some((e) => {
        if (e.type !== 'crumble' && e.type !== 'platform') return false;
        const x = e.x ?? e.x0;
        return x + (e.w || 0) > pit.x && x < pit.x + pit.w;
      });
      assert.ok(bridged, `floor ${n}: pit at ${pit.x} has nothing to cross it`);
    }
  }
});

test('the boss arena lets you reach the crown', () => {
  for (const n of [10, 20, 30]) {
    const room = fm.build(n);
    assert.ok(room.boss, `floor ${n} should have a boss`);
    assert.equal(room.exitLocked, true, 'the exit must be shut while it lives');
    const floorTop = room.originY + FLOOR_Y;
    const crown = room.boss.groundY;         // boss top once it is stuck
    assert.ok(floorTop - crown < 72, `boss crown is ${floorTop - crown} above the floor: out of jump range`);
  }
});

test('the doors always offer exactly one way out and it is stable', () => {
  const room = fm.build(6);
  assert.equal(room.exitIsDoors, true);
  const doors = room.exitEntity;
  assert.equal(doors.slots.length, 2);
  assert.equal(doors.hazards.length, 1, 'exactly one slot is a trap');
  assert.ok(doors.safeIndex >= 0 && doors.safeIndex < 2);
  // Same floor, same answer: the tell is a sign to read, not a coin to flip.
  for (let i = 0; i < 5; i++) {
    assert.equal(new FloorManager().build(6).exitEntity.safeIndex, doors.safeIndex);
  }
});

test('the hatch above the exit is always inside the room', () => {
  for (let n = 1; n <= CHECK_UP_TO; n++) {
    const room = fm.build(n);
    assert.ok(room.hatch.w > 20, `floor ${n}: hatch too narrow`);
    assert.ok(room.hatch.x >= ROOM.WALL - 1);
    assert.ok(room.hatch.x + room.hatch.w <= ROOM.W - ROOM.WALL + 1);
  }
});

test('floors alternate the side you enter from', () => {
  assert.equal(FloorManager.isMirrored(1), false);
  assert.equal(FloorManager.isMirrored(2), true);
  for (let n = 1; n < 20; n++) {
    assert.notEqual(FloorManager.isMirrored(n), FloorManager.isMirrored(n + 1));
    const a = fm.build(n);
    const b = fm.build(n + 1);
    // You leave on one side and come back in on the same side.
    const exitSide = a.exitCenterX() > ROOM.W / 2;
    const entrySide = b.spawn.x > ROOM.W / 2;
    assert.equal(exitSide, entrySide, `floor ${n} -> ${n + 1} enters on the wrong side`);
  }
});
