import type { RunRecord } from './types';

const STORAGE_KEY = 'crashpoint.the_tower.record.v1';

const EMPTY_RECORD: RunRecord = {
  bestDestructionPct: 0,
  bestScore: 0,
  bestChain: 0,
  fewestShotsForClear: null,
  perfectCollapse: false,
  timesPlayed: 0,
};

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadRecord(): RunRecord {
  if (!hasLocalStorage()) return { ...EMPTY_RECORD };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_RECORD };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_RECORD, ...parsed };
  } catch {
    return { ...EMPTY_RECORD };
  }
}

export function saveRecord(record: RunRecord): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable (private mode / quota) — silently skip, gameplay must not break.
  }
}

/**
 * Merges a finished run into the stored record, returning the updated record and
 * which fields were freshly improved (for "NEW BEST" UI badges).
 */
export function mergeRunIntoRecord(
  previous: RunRecord,
  run: { destructionPct: number; score: number; bestChain: number; shotsUsed: number; cleared: boolean; perfectCollapse: boolean }
): { record: RunRecord; improved: Partial<Record<keyof RunRecord, boolean>> } {
  const improved: Partial<Record<keyof RunRecord, boolean>> = {};
  const record: RunRecord = { ...previous, timesPlayed: previous.timesPlayed + 1 };

  if (run.destructionPct > previous.bestDestructionPct) {
    record.bestDestructionPct = run.destructionPct;
    improved.bestDestructionPct = true;
  }
  if (run.score > previous.bestScore) {
    record.bestScore = run.score;
    improved.bestScore = true;
  }
  if (run.bestChain > previous.bestChain) {
    record.bestChain = run.bestChain;
    improved.bestChain = true;
  }
  if (run.cleared) {
    if (previous.fewestShotsForClear === null || run.shotsUsed < previous.fewestShotsForClear) {
      record.fewestShotsForClear = run.shotsUsed;
      improved.fewestShotsForClear = true;
    }
  }
  if (run.perfectCollapse && !previous.perfectCollapse) {
    record.perfectCollapse = true;
    improved.perfectCollapse = true;
  }

  return { record, improved };
}
