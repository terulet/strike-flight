import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Save, memoryStorage, defaultSave, SAVE_VERSION } from '../src/storage/Save.js';
import { Telemetry, EVENTS } from '../src/telemetry/Telemetry.js';
import { t, setLanguage, missingKeys, detectLanguage, LANGUAGES } from '../src/ui/i18n.js';

test('a fresh save has every section', () => {
  const s = new Save(memoryStorage());
  assert.equal(s.data.version, SAVE_VERSION);
  for (const k of ['settings', 'stats', 'records', 'daily', 'ranking', 'unlocked', 'replays']) {
    assert.ok(k in s.data, `missing ${k}`);
  }
  assert.deepEqual(s.data.unlocked, ['puck']);
});

test('records survive a reload', () => {
  const mem = memoryStorage();
  const a = new Save(mem);
  a.update((d) => {
    d.records.bestM = 0.00042;
    d.stats.attempts = 17;
    d.records.perChallenge['daily-2026-08-21'] = { bestM: 0.0009, attempts: 3, at: 1 };
  });
  const b = new Save(mem);
  assert.equal(b.data.records.bestM, 0.00042);
  assert.equal(b.data.stats.attempts, 17);
  assert.equal(b.data.records.perChallenge['daily-2026-08-21'].bestM, 0.0009);
});

test('a better record never gets replaced by a worse one by accident', () => {
  const mem = memoryStorage();
  const s = new Save(mem);
  s.update((d) => { d.records.bestM = 0.0004; });
  const reloaded = new Save(mem);
  const candidate = 0.0009;
  if (reloaded.data.records.bestM == null || candidate < reloaded.data.records.bestM) {
    reloaded.update((d) => { d.records.bestM = candidate; });
  }
  assert.equal(new Save(mem).data.records.bestM, 0.0004);
});

test('corrupted json falls back to a clean save instead of crashing', () => {
  const s = new Save(memoryStorage({ 'omm.save.v1': '{"records":{"bestM":' }));
  assert.equal(s.corrupted, true);
  assert.equal(s.data.version, SAVE_VERSION);
  assert.equal(s.data.settings.lang, 'en');
});

test('garbage types are coerced rather than trusted', () => {
  const s = new Save(memoryStorage({
    'omm.save.v1': JSON.stringify({
      version: SAVE_VERSION, settings: 'nope', stats: { attempts: '12', falls: null },
      records: { bestM: '0.002' }, unlocked: 'puck', replays: {},
    }),
  }));
  assert.equal(s.data.settings.lang, 'en');
  assert.equal(s.data.stats.attempts, 12);
  assert.equal(s.data.records.bestM, 0.002);
  assert.deepEqual(s.data.unlocked, ['puck']);
  assert.ok(Array.isArray(s.data.replays));
});

test('an old save migrates without losing the record', () => {
  const s = new Save(memoryStorage({ 'omm.save.v1': JSON.stringify({ version: 1, best: 1.5, stats: { attempts: 9 } }) }));
  assert.equal(s.data.version, SAVE_VERSION);
  assert.equal(s.data.records.bestM, 0.0015);
  assert.equal(s.data.stats.attempts, 9);
});

test('a save from the future is not destroyed', () => {
  const s = new Save(memoryStorage({ 'omm.save.v1': JSON.stringify({ version: 99, records: { bestM: 0.0003 } }) }));
  assert.equal(s.data.records.bestM, 0.0003);
});

test('the game still runs when storage is unavailable', () => {
  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const s = new Save(broken);
  assert.equal(s.data.version, SAVE_VERSION);
  assert.equal(s.save(), false);
  s.update((d) => { d.stats.attempts = 3; });
  assert.equal(s.data.stats.attempts, 3);
});

test('reset wipes everything', () => {
  const mem = memoryStorage();
  const s = new Save(mem);
  s.update((d) => { d.records.bestM = 0.0001; });
  s.reset();
  assert.equal(s.data.records.bestM, null);
  assert.equal(new Save(mem).data.records.bestM, null);
});

test('telemetry buffers, rolls up and never throws through a bad sink', () => {
  const tel = new Telemetry({ max: 5 });
  tel.addSink(() => { throw new Error('sink exploded'); });
  for (let i = 0; i < 8; i++) tel.log(EVENTS.SHOT_RELEASE, { i });
  tel.log(EVENTS.SHOT_FALL, {});
  assert.equal(tel.buffer.length, 5);
  const s = tel.summary();
  assert.equal(s.shots, 8);
  assert.equal(s.falls, 1);
  assert.ok(Math.abs(s.fallRate - 1 / 8) < 1e-9);
});

test('every language is complete', () => {
  for (const l of LANGUAGES) assert.deepEqual(missingKeys(l.id), [], `${l.id} is missing keys`);
});

test('copy interpolates and falls back safely', () => {
  setLanguage('en');
  assert.equal(t('result.beaten', { name: 'MARC', d: '0.29' }), 'MARC BEATEN BY 0.29 mm');
  setLanguage('es');
  assert.equal(t('btn.revenge'), 'REVANCHA');
  assert.equal(t('nope.missing'), 'nope.missing');
  setLanguage('en');
  assert.ok(typeof detectLanguage() === 'string');
});
