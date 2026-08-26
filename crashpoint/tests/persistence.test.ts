import { describe, it, expect } from 'vitest';
import { mergeRunIntoRecord } from '../src/core/Persistence';
import type { RunRecord } from '../src/core/types';

const BASE: RunRecord = {
  bestDestructionPct: 50,
  bestScore: 1000,
  bestChain: 2,
  fewestShotsForClear: 3,
  perfectCollapse: false,
  timesPlayed: 1,
};

describe('mergeRunIntoRecord', () => {
  it('updates only the fields that actually improved', () => {
    const { record, improved } = mergeRunIntoRecord(BASE, {
      destructionPct: 70,
      score: 900, // worse than best
      bestChain: 1, // worse than best
      shotsUsed: 2,
      cleared: true,
      perfectCollapse: false,
    });

    expect(record.bestDestructionPct).toBe(70);
    expect(improved.bestDestructionPct).toBe(true);
    expect(record.bestScore).toBe(1000);
    expect(improved.bestScore).toBeUndefined();
    expect(record.bestChain).toBe(2);
    expect(record.fewestShotsForClear).toBe(2);
    expect(improved.fewestShotsForClear).toBe(true);
    expect(record.timesPlayed).toBe(2);
  });

  it('only updates fewestShotsForClear on a cleared run', () => {
    const { record, improved } = mergeRunIntoRecord(BASE, {
      destructionPct: 40,
      score: 100,
      bestChain: 0,
      shotsUsed: 1,
      cleared: false,
      perfectCollapse: false,
    });
    expect(record.fewestShotsForClear).toBe(3);
    expect(improved.fewestShotsForClear).toBeUndefined();
  });

  it('locks in perfectCollapse permanently once achieved', () => {
    const { record, improved } = mergeRunIntoRecord(BASE, {
      destructionPct: 96,
      score: 9000,
      bestChain: 4,
      shotsUsed: 1,
      cleared: true,
      perfectCollapse: true,
    });
    expect(record.perfectCollapse).toBe(true);
    expect(improved.perfectCollapse).toBe(true);

    const second = mergeRunIntoRecord(record, {
      destructionPct: 96,
      score: 1,
      bestChain: 0,
      shotsUsed: 3,
      cleared: false,
      perfectCollapse: false,
    });
    expect(second.record.perfectCollapse).toBe(true);
    expect(second.improved.perfectCollapse).toBeUndefined();
  });

  it('increments timesPlayed on every merge', () => {
    const { record } = mergeRunIntoRecord(BASE, {
      destructionPct: 0,
      score: 0,
      bestChain: 0,
      shotsUsed: 3,
      cleared: false,
      perfectCollapse: false,
    });
    expect(record.timesPlayed).toBe(2);
  });
});
