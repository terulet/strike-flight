import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsConfig as P } from '../src/config/PhysicsConfig.js';
import { getSurface } from '../src/config/surfaces.js';
import { getObject } from '../src/config/objects.js';
import {
  deriveSetup, createState, launch, step, simulateShot, isSettled, buildResult, PHASE,
} from '../src/physics/Simulation.js';
import { createChallenge, launchSpeedFor } from '../src/game/Challenge.js';

const setupOf = (surfaceId = 'wood', objectId = 'puck', edgeX = 0.8) => ({
  surface: getSurface(surfaceId),
  object: getObject(objectId),
  startX: 0,
  edgeX,
});

test('same input produces a bit-identical result', () => {
  const s = setupOf();
  const a = simulateShot(s, 1.4, { ignoreEdge: true });
  const b = simulateShot(s, 1.4, { ignoreEdge: true });
  assert.equal(a.travelM, b.travelM);
  assert.equal(a.timeS, b.timeS);
  assert.equal(a.steps, b.steps);
});

test('the object always comes to rest', () => {
  for (const sid of ['wood', 'ice', 'rubber', 'metal', 'sand']) {
    for (const v of [0.4, 1, 2, 3]) {
      const r = simulateShot(setupOf(sid), v, { ignoreEdge: true });
      assert.ok(r.timeS < 20, `${sid} v${v} never settled`);
      assert.ok(Number.isFinite(r.travelM));
    }
  }
});

test('friction is monotonic: more friction means less travel', () => {
  const order = ['ice', 'metal', 'wood', 'sand', 'rubber'];
  const travels = order.map((id) => simulateShot(setupOf(id), 1.6, { ignoreEdge: true }).travelM);
  for (let i = 1; i < travels.length; i++) {
    assert.ok(travels[i] < travels[i - 1], `${order[i]} should travel less than ${order[i - 1]}`);
  }
});

test('travel is strictly increasing with launch speed', () => {
  let prev = -1;
  for (let v = 0.2; v <= 3; v += 0.1) {
    const d = simulateShot(setupOf(), v, { ignoreEdge: true }).travelM;
    assert.ok(d > prev, `travel not monotonic at v=${v}`);
    prev = d;
  }
});

test('crossing the edge tips the object and it falls', () => {
  const s = setupOf('wood', 'puck', 0.30);
  const r = simulateShot(s, 2.4);
  assert.equal(r.fell, true);
  assert.equal(r.marginM, 0);
});

test('stopping short of the edge is a valid score', () => {
  const s = setupOf('wood', 'puck', 3);
  const r = simulateShot(s, 1.4);
  assert.equal(r.fell, false);
  assert.ok(r.marginM > 0);
});

test('an object can overhang the edge and survive', () => {
  const ch = createChallenge('test-overhang', { surfaceId: 'wood', objectId: 'puck', pe: 0.7 });
  const v = launchSpeedFor(ch, 0.699);
  const r = simulateShot(ch.setup, v, { derived: ch.derived });
  assert.equal(r.fell, false);
  assert.ok(r.overhangM > 0, 'expected the puck to hang over the void');
  assert.ok(r.marginM > 0 && r.marginM < 0.002);
  assert.equal(r.hanging, true);
});

test('the balance point, not the front face, decides the fall', () => {
  const ch = createChallenge('test-com', { surfaceId: 'wood', objectId: 'puck', pe: 0.7 });
  const derived = ch.derived;
  const v = launchSpeedFor(ch, ch.pe + 0.0005);
  const r = simulateShot(ch.setup, v, { derived });
  assert.equal(r.fell, true, 'past the brink power must fall');
  const v2 = launchSpeedFor(ch, ch.pe - 0.0005);
  const r2 = simulateShot(ch.setup, v2, { derived });
  assert.equal(r2.fell, false, 'just short of the brink must survive');
});

test('frame rate never changes the score', () => {
  // Drive the same shot through the game-style accumulator at wildly different
  // frame rates: the trajectory is a pure function of the fixed step count.
  const s = setupOf('ice', 'phone', 0.9);
  const d = deriveSetup(s);
  const run = (fps, jitter = 0) => {
    const st = createState(d);
    launch(st, 1.2);
    let acc = 0;
    let frame = 0;
    while (!isSettled(st) && frame < 100000) {
      frame++;
      const dt = 1 / fps + (jitter ? Math.sin(frame * 12.9898) * jitter : 0);
      acc += Math.min(Math.max(dt, 0.0001), P.maxFrameDelta);
      // Mirrors Game._stepSimulation exactly.
      let budget = 5000;
      while (acc >= P.dt && budget-- > 0 && !isSettled(st)) { step(st, d, false); acc -= P.dt; }
    }
    return buildResult(st, d);
  };
  const a = run(30);
  const b = run(60);
  const c = run(120);
  const j = run(60, 0.006);
  assert.equal(a.marginM, b.marginM);
  assert.equal(b.marginM, c.marginM);
  assert.equal(c.marginM, j.marginM);
  assert.equal(a.steps, b.steps);
});

test('substeps stay stable at extreme speeds', () => {
  const r = simulateShot(setupOf('ice'), 13, { ignoreEdge: true });
  assert.ok(Number.isFinite(r.travelM) && r.travelM > 0);
  assert.ok(r.steps < 240 * 25);
});

test('a settled object is really settled', () => {
  const s = setupOf('wood', 'puck', 3);
  const d = deriveSetup(s);
  const st = createState(d);
  launch(st, 1.2);
  while (!isSettled(st)) step(st, d, false);
  assert.equal(st.v, 0);
  assert.ok(st.restTime >= P.settleTime - 1e-9);
  assert.equal(st.phase, PHASE.STOPPED);
});

test('slope and wind mutators change the outcome in the expected direction', () => {
  const base = simulateShot(setupOf(), 1.4, { ignoreEdge: true }).travelM;
  const downhill = simulateShot({ ...setupOf(), slope: 0.03 }, 1.4, { ignoreEdge: true }).travelM;
  const headwind = simulateShot({ ...setupOf(), wind: -0.08 }, 1.4, { ignoreEdge: true }).travelM;
  assert.ok(downhill > base);
  assert.ok(headwind < base);
});
