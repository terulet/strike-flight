import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PhysicsConfig as P } from '../src/config/PhysicsConfig.js';
import { makeResult, isBetter, compareMargins, isTie, sortEntries, rankOf, OUTCOME } from '../src/game/Scoring.js';
import { zoneForMm } from '../src/config/GameConfig.js';
import { formatMm, formatMmDistinct, decimalsFor, toMm, toMetres } from '../src/ui/format.js';
import { buildBoard, playerRank } from '../src/game/Ranking.js';
import { createChallenge } from '../src/game/Challenge.js';

const challenge = { id: 'c', travelToEdge: 0.5 };

test('a standing shot scores its distance to the brink, in millimetres', () => {
  const r = makeResult({ fell: false, marginM: 0.00083, overhangM: 0.02, hanging: true, travelM: 0.5 }, { travelM: 0.5 }, challenge);
  assert.equal(r.outcome, OUTCOME.STOPPED);
  assert.equal(r.valid, true);
  assert.ok(Math.abs(r.mm - 0.83) < 1e-9);
  assert.equal(r.zoneId, 'elite');
  assert.equal(r.hanging, true);
});

test('a fall scores nothing and reports how far past the edge it went', () => {
  const r = makeResult({ fell: true, marginM: 0, travelM: 0.6 }, { travelM: 0.50017 }, challenge);
  assert.equal(r.valid, false);
  assert.equal(r.marginM, 0);
  assert.ok(Math.abs(r.overshootMm - 0.17) < 1e-6);
  assert.equal(r.nearMiss, true);
});

test('a big overshoot is not a near miss', () => {
  const r = makeResult({ fell: true, marginM: 0, travelM: 0.6 }, { travelM: 0.56 }, challenge);
  assert.equal(r.nearMiss, false);
  assert.ok(Math.abs(r.overshootMm - 60) < 1e-6);
});

test('falls never beat a standing shot', () => {
  const good = makeResult({ fell: false, marginM: 0.04, travelM: 0.4 }, { travelM: 0.4 }, challenge);
  const fall = makeResult({ fell: true, marginM: 0, travelM: 0.6 }, { travelM: 0.6 }, challenge);
  assert.equal(isBetter(fall, good), false);
  assert.equal(isBetter(good, fall), true);
  assert.equal(isBetter(good, null), true);
});

test('zones match the spec boundaries', () => {
  assert.equal(zoneForMm(40).id, 'safe');
  assert.equal(zoneForMm(25).id, 'good');
  assert.equal(zoneForMm(10).id, 'great');
  assert.equal(zoneForMm(3).id, 'insane');
  assert.equal(zoneForMm(1).id, 'elite');
  assert.equal(zoneForMm(0.25).id, 'legendary');
  assert.equal(zoneForMm(0.05).id, 'legendary');
});

test('ties inside the epsilon are dead heats, outside they resolve', () => {
  assert.equal(compareMargins(0.001, 0.001 + P.tieEpsilon / 2), 0);
  assert.equal(isTie(0.001, 0.001), true);
  assert.equal(compareMargins(0.001, 0.00101), -1);
  assert.equal(compareMargins(0.00101, 0.001), 1);
});

test('ranking sorts best first and pushes empty scores to the bottom', () => {
  const entries = [
    { name: 'a', marginM: 0.00072 },
    { name: 'b', marginM: null },
    { name: 'c', marginM: 0.00031 },
    { name: 'd', marginM: 0.00119 },
  ];
  sortEntries(entries);
  assert.deepEqual(entries.map((e) => e.name), ['c', 'a', 'd', 'b']);
  assert.equal(rankOf(0.0005, entries), 2);
});

test('a board gives the player a rank and marks dead heats', () => {
  const ch = createChallenge('board-test');
  const board = buildBoard(ch, 0.0004, 'YOU', 'puck');
  assert.ok(board.length >= 6);
  assert.ok(playerRank(board) >= 1);
  const ranks = board.filter((e) => e.marginM != null).map((e) => e.rank);
  for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i] >= ranks[i - 1]);
});

test('formatting shows more precision the better the score', () => {
  assert.equal(formatMm(14.23), '14.2');
  assert.equal(formatMm(3.4812), '3.48');
  assert.equal(formatMm(0.7231), '0.72');
  assert.equal(formatMm(0.0834), '0.083');
  assert.equal(formatMm(0.00412), '0.0041');
  assert.equal(decimalsFor(120), 0);
});

test('formatting never claims a perfect zero', () => {
  const s = formatMm(1e-9);
  assert.notEqual(Number(s), 0);
});

test('leaderboard neighbours never print the same number', () => {
  const all = [0.4341, 0.4388];
  const a = formatMmDistinct(0.4341, all);
  const b = formatMmDistinct(0.4388, all);
  assert.notEqual(a, b);
  const close = [0.43411, 0.43412];
  assert.notEqual(formatMmDistinct(0.43411, close), formatMmDistinct(0.43412, close));
});

test('millimetre conversion round trips', () => {
  assert.ok(Math.abs(toMetres(toMm(0.00042)) - 0.00042) < 1e-15);
});
