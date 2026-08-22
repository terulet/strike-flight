import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLaunchConfig, sanitizeName, sanitizeChallengeId, parseScoreMm, parseRivalList,
  buildTesterLink, LIMITS,
} from '../src/tester/LaunchConfig.js';
import { loadRivalConfig, mergeRivalSources } from '../src/tester/rivalConfig.js';
import { newPlayerId, ensurePlayer, setPlayerName, hasName } from '../src/game/Player.js';
import { Save, memoryStorage } from '../src/storage/Save.js';
import { Telemetry, telemetryStorage, classifyResult, RESULT_TYPE, EVENTS } from '../src/telemetry/Telemetry.js';
import { buildReportPayload, humanSummary } from '../src/tester/TesterReport.js';
import { createChallenge } from '../src/game/Challenge.js';
import { realRivals, findRival } from '../src/game/Rivals.js';
import { buildBoard } from '../src/game/Ranking.js';

// ------------------------------------------------------------ PLAYER IDENTITY
test('a player id is generated, stable and anonymous', () => {
  const mem = memoryStorage();
  const save = new Save(mem);
  const { player, created } = ensurePlayer(save);
  assert.equal(created, true);
  assert.ok(player.id.length >= 20);
  assert.ok(player.createdAt > 0);
  const again = ensurePlayer(new Save(mem));
  assert.equal(again.created, false);
  assert.equal(again.player.id, player.id, 'the id survives a reload');
  // Nothing about the person is in it.
  assert.ok(!/@/.test(player.id));
});

test('two ids do not collide', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(newPlayerId());
  assert.equal(ids.size, 500);
});

test('the name is sanitised and can be changed', () => {
  const mem = memoryStorage();
  const save = new Save(mem);
  ensurePlayer(save);
  assert.equal(hasName(save), false);
  assert.equal(setPlayerName(save, '  Eloi  '), 'Eloi');
  assert.equal(hasName(save), true);
  assert.equal(new Save(mem).data.player.name, 'Eloi');
  assert.equal(setPlayerName(save, 'Yoli'), 'Yoli');
  assert.equal(setPlayerName(save, '   '), '', 'an empty name is allowed to be empty, not garbage');
});

test('names cannot carry markup, control characters or unbounded length', () => {
  assert.ok(!/[<>=()]/.test(sanitizeName('<img src=x onerror=alert(1)>')));
  assert.ok(!sanitizeName('<script>alert(1)</script>').includes('<'));
  assert.equal(sanitizeName('${constructor}'), 'constructor');
  assert.equal(sanitizeName('Marc‮gnol'), 'Marcgnol');
  assert.equal(sanitizeName('a'.repeat(200)).length, LIMITS.nameMax);
  assert.equal(sanitizeName(null), '');
  assert.equal(sanitizeName(42), '');
  assert.equal(sanitizeName('José María'), 'José María', 'accents survive');
});

// -------------------------------------------------------------- LAUNCH CONFIG
test('a full tester link parses into exactly what it says', () => {
  const c = parseLaunchConfig('?tester=1&challenge=group-a&rival=Marc&score=1.42&target=Marc&mode=three&lang=es');
  assert.equal(c.challengeId, 'group-a');
  assert.deepEqual(c.rivals, [{ name: 'Marc', mm: 1.42 }]);
  assert.equal(c.targetName, 'Marc');
  assert.equal(c.mode, 'three');
  assert.equal(c.lang, 'es');
  assert.equal(c.tester, true);
});

test('rival scores keep full precision', () => {
  const c = parseLaunchConfig('?rival=Marc&score=0.4388');
  assert.equal(c.rivals[0].mm, 0.4388);
  assert.equal(parseScoreMm('0.0001'), 0.0001);
  assert.equal(parseScoreMm('1,42'), 1.42, 'a comma decimal still parses');
});

test('invalid scores are rejected, not clamped into something plausible', () => {
  for (const bad of ['-4', '0', 'NaN', '', 'abc', '1e9', '99999', null, undefined, '  ']) {
    assert.equal(parseScoreMm(bad), null, `${bad} should be rejected`);
  }
  const c = parseLaunchConfig('?rival=Marc&score=-4');
  assert.deepEqual(c.rivals, []);
  assert.ok(c.invalid.includes('rival'));
});

test('a hostile link cannot inject anything or blow up storage', () => {
  const c = parseLaunchConfig('?challenge=' + encodeURIComponent('<script>x</script>../../etc') +
    '&rivals=' + encodeURIComponent('<b>Marc</b>:1.4,' + 'x'.repeat(200) + ':2'));
  assert.ok(!/[<>/]/.test(c.challengeId));
  for (const r of c.rivals) {
    assert.ok(!/[<>&"']/.test(r.name));
    assert.ok(r.name.length <= LIMITS.nameMax);
  }
});

test('at most six rivals, no duplicates', () => {
  const many = Array.from({ length: 12 }, (_, i) => `P${i}:${i + 1}`).join(',');
  assert.equal(parseRivalList(many).length, LIMITS.rivals);
  assert.equal(parseRivalList('Marc:1.4,marc:2.2').length, 1, 'same name twice is one rival');
});

test('unknown and malformed parameters are ignored, never fatal', () => {
  const c = parseLaunchConfig('?mode=nonsense&lang=zz&pe=9&surface=<x>&nope=1&score=abc');
  assert.equal(c.mode, null);
  assert.equal(c.lang, null);
  assert.equal(c.pe, null);
  assert.ok(c.invalid.includes('mode'));
  assert.doesNotThrow(() => parseLaunchConfig('?%%%&&=='));
  assert.doesNotThrow(() => parseLaunchConfig(null));
});

test('solo beats rivals, because it is the explicit control arm', () => {
  const c = parseLaunchConfig('?solo=1&rival=Marc&score=1.4');
  assert.deepEqual(c.rivals, []);
  assert.equal(c.solo, true);
  assert.equal(c.tester, true);
});

test('a generated link round trips through the parser', () => {
  const link = buildTesterLink('https://x/y/', {
    challengeId: 'group-a', rivals: [{ name: 'Marc', mm: 0.4388 }], targetName: 'Marc',
  });
  const c = parseLaunchConfig(link.slice(link.indexOf('?')));
  assert.equal(c.challengeId, 'group-a');
  assert.equal(c.rivals[0].mm, 0.4388);
  assert.equal(c.targetName, 'Marc');
});

// --------------------------------------------------------------- RIVAL CONFIG
const FIXTURE = {
  version: 1,
  challenges: {
    'group-a': { target: 'Marc', rivals: [{ name: 'Marc', scoreMm: 1.42 }, { name: 'Yoli', scoreMm: 0.88 }] },
    'broken': { rivals: [{ name: '', scoreMm: 1 }, { name: 'X', scoreMm: -3 }, 'nonsense'] },
  },
};
const okFetch = async () => ({ ok: true, json: async () => FIXTURE });

test('the json config loads real rivals for a challenge', async () => {
  const r = await loadRivalConfig('group-a', okFetch);
  assert.equal(r.rivals.length, 2);
  assert.equal(r.targetName, 'Marc');
});

test('a broken or missing json never stops the game', async () => {
  assert.deepEqual((await loadRivalConfig('broken', okFetch)).rivals, []);
  assert.deepEqual((await loadRivalConfig('nope', okFetch)).rivals, []);
  assert.deepEqual((await loadRivalConfig('group-a', async () => { throw new Error('offline'); })).rivals, []);
  assert.deepEqual((await loadRivalConfig('group-a', async () => ({ ok: false }))).rivals, []);
  assert.deepEqual((await loadRivalConfig('group-a', async () => ({ ok: true, json: async () => 'not json' }))).rivals, []);
});

test('the link always wins over the committed file', async () => {
  const json = await loadRivalConfig('group-a', okFetch);
  const link = parseLaunchConfig('?challenge=group-a&rival=Marc&score=0.4');
  const merged = mergeRivalSources(link, json);
  assert.equal(merged.source, 'link');
  assert.equal(merged.rivals[0].mm, 0.4);
  const plain = mergeRivalSources(parseLaunchConfig('?challenge=group-a'), json);
  assert.equal(plain.source, 'json');
  assert.equal(plain.rivals.length, 2);
  const solo = mergeRivalSources(parseLaunchConfig('?solo=1'), json);
  assert.equal(solo.source, 'solo');
  assert.deepEqual(solo.rivals, []);
});

test('real rivals become a board the player can be ranked against', () => {
  const ch = createChallenge('group-a');
  const rivals = realRivals(ch, [{ name: 'Marc', mm: 1.42 }, { name: 'Yoli', mm: 0.88 }]);
  assert.equal(rivals[0].name, 'YOLI', 'best first');
  assert.ok(rivals.every((r) => r.real && r.objectId === ch.objectId));
  assert.equal(findRival(rivals, 'marc').mm, 1.42);
  assert.equal(findRival(rivals, 'nobody'), null);
  const board = buildBoard(ch, 1.0 / 1000, 'YOU');
  assert.equal(board.length, 6, 'simulated board still works when no real rivals exist');
});

// ------------------------------------------------------------------ TELEMETRY
function fakeClock() {
  let t = 1000;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test('every result type is classified from what the player actually saw', () => {
  assert.equal(classifyResult({ fell: true, nearMiss: true }), RESULT_TYPE.NEAR_MISS_FALL);
  assert.equal(classifyResult({ fell: true }), RESULT_TYPE.FALL);
  assert.equal(classifyResult({ fell: false, hadTarget: true, beatTarget: false }), RESULT_TYPE.RIVAL_LOSS);
  assert.equal(classifyResult({ fell: false, hadTarget: true, beatTarget: true }), RESULT_TYPE.RIVAL_WIN);
  assert.equal(classifyResult({ fell: false, isPersonalBest: true }), RESULT_TYPE.PERSONAL_BEST);
  assert.equal(classifyResult({ fell: false, hadPreviousBest: true }), RESULT_TYPE.PERSONAL_MISS);
  assert.equal(classifyResult({ fell: false }), RESULT_TYPE.NORMAL_STOP);
  // A rival loss that is also a personal best is still a rival loss: that is the feeling.
  assert.equal(classifyResult({ fell: false, hadTarget: true, beatTarget: false, isPersonalBest: true }), RESULT_TYPE.RIVAL_LOSS);
});

test('retries are attributed to the cause, never lumped together', () => {
  const clock = fakeClock();
  const tel = new Telemetry({ now: clock.now });
  tel.beginSession({ arm: 'rival' });
  const play = (type, retried, delay = 500) => {
    clock.advance(3000);
    tel.noteResult(type, {});
    tel.markResultShown();
    if (retried) { clock.advance(delay); tel.noteRetry(); }
  };
  play(RESULT_TYPE.RIVAL_LOSS, true, 400);
  play(RESULT_TYPE.RIVAL_LOSS, true, 600);
  play(RESULT_TYPE.RIVAL_LOSS, false);
  play(RESULT_TYPE.FALL, true);
  play(RESULT_TYPE.NORMAL_STOP, false);
  const s = tel.summary();
  assert.ok(Math.abs(s.retryAfterRivalLoss - 2 / 3) < 1e-9);
  assert.equal(s.retryAfterFall, 1);
  assert.equal(s.retryAfterNormalStop, 0);
  assert.equal(s.retryAfterPersonalMiss, null, 'never happened means null, not zero');
  assert.equal(s.medianRetryDelayMs, 500);
});

test('a retry cannot be double counted', () => {
  const clock = fakeClock();
  const tel = new Telemetry({ now: clock.now });
  tel.beginSession({});
  tel.noteResult(RESULT_TYPE.FALL, {});
  tel.markResultShown();
  clock.advance(300);
  tel.noteRetry();
  tel.noteRetry();
  tel.noteRetry();
  assert.equal(tel.summary().retries[RESULT_TYPE.FALL], 1);
});

test('walking away is not a retry', () => {
  const clock = fakeClock();
  const tel = new Telemetry({ now: clock.now });
  tel.beginSession({});
  tel.noteResult(RESULT_TYPE.RIVAL_LOSS, {});
  tel.markResultShown();
  tel.abandonPending('quit');
  tel.noteRetry();
  const s = tel.summary();
  assert.equal(s.results[RESULT_TYPE.RIVAL_LOSS], 1);
  assert.equal(s.retries[RESULT_TYPE.RIVAL_LOSS], 0);
  assert.equal(s.retryAfterRivalLoss, 0);
});

test('the retry delay is measured from the result being shown, not from settling', () => {
  const clock = fakeClock();
  const tel = new Telemetry({ now: clock.now });
  tel.beginSession({});
  tel.noteResult(RESULT_TYPE.FALL, {});
  clock.advance(260);          // presentation delay
  tel.markResultShown();
  clock.advance(700);          // actual hesitation
  const r = tel.noteRetry();
  assert.equal(r.delayMs, 700);
});

test('sessions are separated and split into solo and rival arms', () => {
  const clock = fakeClock();
  const tel = new Telemetry({ now: clock.now });
  tel.beginSession({ arm: 'solo' });
  tel.noteResult(RESULT_TYPE.FALL, {}); tel.recordAttempt({ scoreMm: null, fell: true });
  clock.advance(5000);
  tel.beginSession({ arm: 'rival' });
  tel.noteResult(RESULT_TYPE.RIVAL_LOSS, {}); tel.recordAttempt({ scoreMm: 2, fell: false });
  const agg = tel.aggregate();
  assert.equal(agg.sessions, 2);
  assert.equal(agg.solo.sessions, 1);
  assert.equal(agg.rival.sessions, 1);
});

test('telemetry survives a reload and respects its cap', () => {
  const mem = memoryStorage();
  const store = telemetryStorage(mem);
  const a = new Telemetry({ storage: store, caps: { sessions: 3, events: 50, attempts: 50 } });
  for (let i = 0; i < 5; i++) { a.beginSession({ playerName: `p${i}` }); a.flush(); }
  const b = new Telemetry({ storage: store, caps: { sessions: 3, events: 50, attempts: 50 } });
  assert.equal(b.sessions.length, 3, 'oldest sessions are dropped, not the newest');
  assert.equal(b.sessions[2].playerName, 'p4');
});

test('telemetry keeps working when storage is blocked', () => {
  const broken = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); }, removeItem() { throw new Error('no'); } };
  const tel = new Telemetry({ storage: telemetryStorage(broken) });
  assert.doesNotThrow(() => {
    tel.beginSession({});
    tel.noteResult(RESULT_TYPE.FALL, {});
    tel.noteRetry();
    tel.flush();
  });
  assert.equal(tel.summary().results[RESULT_TYPE.FALL], 1);
});

// --------------------------------------------------------------------- REPORT
test('the report is valid, versioned and self-describing', () => {
  const clock = fakeClock();
  const tel = new Telemetry({ now: clock.now });
  const save = new Save(memoryStorage());
  ensurePlayer(save);
  setPlayerName(save, 'Eloi');
  tel.beginSession({ playerId: save.data.player.id, playerName: 'Eloi', arm: 'rival' });
  clock.advance(2000);
  tel.noteResult(RESULT_TYPE.RIVAL_LOSS, {}); tel.markResultShown();
  tel.recordAttempt({ attemptNumber: 1, scoreMm: 1.9, fell: false, resultType: 'rival_loss' });
  clock.advance(800); tel.noteRetry();

  const payload = buildReportPayload({ telemetry: tel, save });
  assert.equal(payload.schemaVersion, 1);
  assert.ok(payload.appVersion && payload.physicsVersion);
  assert.equal(payload.player.name, 'Eloi');
  assert.equal(payload.player.id, save.data.player.id);
  assert.ok(Array.isArray(payload.sessions) && payload.sessions.length === 1);
  assert.ok(payload.sessions[0].summary, 'every session carries its own rollup');
  // Must survive a round trip through a chat app.
  const text = JSON.stringify(payload);
  assert.deepEqual(JSON.parse(text).currentSummary.attempts, 1);

  const human = humanSummary(payload);
  assert.match(human, /PLAYER: Eloi/);
  assert.match(human, /RETRY AFTER RIVAL LOSS: 100%/);
  assert.match(human, /ATTEMPTS: 1/);
});

test('a report with no play at all is still valid', () => {
  const tel = new Telemetry({ now: () => 1000 });
  const save = new Save(memoryStorage());
  ensurePlayer(save);
  tel.beginSession({});
  const payload = buildReportPayload({ telemetry: tel, save });
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.currentSummary.attempts, 0);
  assert.equal(payload.currentSummary.retryAfterFall, null);
  assert.doesNotThrow(() => humanSummary(payload));
});

test('clearing test data leaves the game save alone', () => {
  const mem = memoryStorage();
  const save = new Save(mem);
  ensurePlayer(save);
  setPlayerName(save, 'Eloi');
  save.update((d) => { d.records.bestM = 0.00042; });
  const tel = new Telemetry({ storage: telemetryStorage(mem) });
  tel.beginSession({});
  tel.flush();
  tel.clear();
  assert.equal(tel.sessions.length, 0);
  const reloaded = new Save(mem);
  assert.equal(reloaded.data.records.bestM, 0.00042, 'the record survives CLEAR TEST DATA');
  assert.equal(reloaded.data.player.name, 'Eloi');
});

test('an attempt record keeps more precision than the display', async () => {
  // A score of 0.00001 mm is 10x finer than the tie epsilon; storing it as
  // "0.0000" would erase a real result from the report.
  const { formatMm } = await import('../src/ui/format.js');
  assert.notEqual(Number((0.00001).toFixed(6)), 0);
  assert.notEqual(formatMm(0.00001), '0.0000');
  assert.equal(Number((0.00001).toFixed(4)), 0, 'this is the rounding that used to lose it');
});
