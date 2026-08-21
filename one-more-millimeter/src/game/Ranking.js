/**
 * Ranking — one board per challenge: the player plus the simulated friends.
 * Persisted through Save so "you are #2 today" survives a reload.
 */
import { sortEntries, compareMargins } from './Scoring.js';
import { rivalsFor } from './Rivals.js';

export function buildBoard(challenge, playerMarginM, playerName = 'YOU', playerObjectId = null) {
  const entries = rivalsFor(challenge).map((r) => ({ ...r, isPlayer: false }));
  entries.push({
    id: 'player',
    name: playerName,
    color: '#ffffff',
    isPlayer: true,
    isRival: false,
    marginM: playerMarginM,
    mm: playerMarginM == null ? null : playerMarginM * 1000,
    objectId: playerObjectId,
    challengeId: challenge.id,
  });
  sortEntries(entries);
  let rank = 0;
  let lastM = null;
  entries.forEach((e, i) => {
    if (lastM === null || compareMargins(e.marginM, lastM) !== 0) rank = i + 1;
    e.rank = e.marginM == null ? null : rank;
    e.tie = lastM !== null && compareMargins(e.marginM, lastM) === 0;
    lastM = e.marginM;
  });
  return entries;
}

export function playerRank(board) {
  const me = board.find((e) => e.isPlayer);
  return me ? me.rank : null;
}

export function leader(board) {
  return board.find((e) => e.marginM != null) || null;
}
