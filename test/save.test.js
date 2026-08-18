import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager, memoryStorage, detectStorage, SAVE_KEY } from '../src/core/save.js';

test('a fresh save starts at zero', () => {
  const s = new SaveManager(memoryStorage());
  assert.equal(s.bestFloor, 0);
  assert.equal(s.data.runs, 0);
  assert.equal(s.muted, false);
});

test('a better run sets a new record, a worse one does not', () => {
  const s = new SaveManager(memoryStorage());
  assert.equal(s.submitRun(5), true);
  assert.equal(s.bestFloor, 5);
  assert.equal(s.submitRun(3), false);
  assert.equal(s.bestFloor, 5);
  assert.equal(s.submitRun(6), true);
  assert.equal(s.bestFloor, 6);
  assert.equal(s.data.runs, 3);
  assert.equal(s.data.totalFloors, 14);
});

test('equalling the record is not a new record', () => {
  const s = new SaveManager(memoryStorage());
  s.submitRun(4);
  assert.equal(s.submitRun(4), false);
});

test('the record survives being reloaded from storage', () => {
  const storage = memoryStorage();
  const first = new SaveManager(storage);
  first.submitRun(12);
  first.setMuted(true);
  const second = new SaveManager(storage);
  assert.equal(second.bestFloor, 12);
  assert.equal(second.muted, true);
});

test('a corrupt payload falls back to defaults instead of throwing', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, '{not json');
  const s = new SaveManager(storage);
  assert.equal(s.bestFloor, 0);
});

test('nonsense values are rejected', () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ bestFloor: -4, runs: 'many', muted: 'yes' }));
  const s = new SaveManager(storage);
  assert.equal(s.bestFloor, 0);
  assert.equal(s.data.runs, 0);
  assert.equal(s.muted, false);
});

test('a storage that throws degrades to memory instead of crashing', () => {
  const hostile = {
    get localStorage() {
      return {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => { throw new Error('blocked'); },
      };
    },
  };
  const storage = detectStorage(hostile);
  const s = new SaveManager(storage);
  assert.equal(s.submitRun(9), true);
  assert.equal(s.bestFloor, 9);
});

test('reset clears everything', () => {
  const s = new SaveManager(memoryStorage());
  s.submitRun(20);
  s.reset();
  assert.equal(s.bestFloor, 0);
  assert.equal(s.data.totalFloors, 0);
});
