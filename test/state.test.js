import test from 'node:test';
import assert from 'node:assert/strict';
import { State, StateMachine, canTransition, TRANSITIONS } from '../src/core/state.js';

test('the normal run is a legal path', () => {
  const sm = new StateMachine(State.BOOT);
  assert.ok(sm.set(State.TITLE));
  assert.ok(sm.set(State.PLAYING));
  assert.ok(sm.set(State.TRANSITION));
  assert.ok(sm.set(State.PLAYING));
  assert.ok(sm.set(State.DYING));
  assert.ok(sm.set(State.RESULT));
  assert.ok(sm.set(State.PLAYING));
});

test('illegal jumps are refused rather than thrown', () => {
  const sm = new StateMachine(State.TITLE);
  assert.equal(sm.set(State.RESULT), false);
  assert.equal(sm.current, State.TITLE);
  assert.equal(sm.set(State.DYING), false);
  assert.equal(sm.current, State.TITLE);
});

test('states known to be impossible stay impossible', () => {
  // Dying can only ever lead to the result screen: no silent resurrection.
  assert.deepEqual(TRANSITIONS[State.DYING], [State.RESULT]);
  assert.equal(canTransition(State.DYING, State.PLAYING), false);
  assert.equal(canTransition(State.RESULT, State.TRANSITION), false);
  assert.equal(canTransition(State.TITLE, State.TRANSITION), false);
  assert.equal(canTransition(State.BOOT, State.PLAYING), false);
});

test('every declared target is itself a known state', () => {
  const known = new Set(Object.values(State));
  for (const [from, targets] of Object.entries(TRANSITIONS)) {
    assert.ok(known.has(from), `unknown source ${from}`);
    for (const to of targets) assert.ok(known.has(to), `unknown target ${to}`);
  }
});

test('re-entering the current state is a no-op', () => {
  const sm = new StateMachine(State.PLAYING);
  assert.equal(sm.set(State.PLAYING), false);
});

test('time in state resets on every change and accumulates otherwise', () => {
  const sm = new StateMachine(State.TITLE);
  sm.update(0.5);
  assert.equal(sm.timeInState, 0.5);
  sm.set(State.PLAYING);
  assert.equal(sm.timeInState, 0);
  sm.update(0.25);
  sm.update(0.25);
  assert.equal(sm.timeInState, 0.5);
});

test('onChange reports both ends of the transition', () => {
  const seen = [];
  const sm = new StateMachine(State.BOOT, (to, from) => seen.push([from, to]));
  sm.set(State.TITLE);
  sm.set(State.PLAYING);
  assert.deepEqual(seen, [[State.BOOT, State.TITLE], [State.TITLE, State.PLAYING]]);
});
