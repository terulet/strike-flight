import { describe, it, expect } from 'vitest';
import { computeMedal, computeScore, isPerfectCollapse, nextMedalGap, MAX_SHOTS } from '../src/systems/ScoreSystem';

describe('ScoreSystem — medals', () => {
  it('awards no medal below 80%', () => {
    expect(computeMedal(79.9, 2)).toBe('none');
  });
  it('awards bronze at 80%+', () => {
    expect(computeMedal(80, 3)).toBe('bronze');
  });
  it('awards silver at 90%+', () => {
    expect(computeMedal(91, 2)).toBe('silver');
  });
  it('awards gold at 95%+ with more than one shot', () => {
    expect(computeMedal(97, 2)).toBe('gold');
  });
  it('awards the CRASHPOINT medal only at 95%+ with exactly one shot', () => {
    expect(computeMedal(95, 1)).toBe('crashpoint');
    expect(computeMedal(99, 2)).toBe('gold');
    expect(computeMedal(94.9, 1)).toBe('silver'); // below the CRASHPOINT/gold cutoff, but still 90%+
  });
});

describe('ScoreSystem — Perfect Collapse', () => {
  it('requires both the destruction threshold and a single shot', () => {
    expect(isPerfectCollapse(95, 1)).toBe(true);
    expect(isPerfectCollapse(95, 2)).toBe(false);
    expect(isPerfectCollapse(90, 1)).toBe(false);
  });
});

describe('ScoreSystem — score computation', () => {
  it('is monotonically higher for more destruction', () => {
    const low = computeScore({ destructionPct: 40, shotsUsed: 3, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: false });
    const high = computeScore({ destructionPct: 80, shotsUsed: 3, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: true });
    expect(high).toBeGreaterThan(low);
  });

  it('rewards using fewer shots, but only on a cleared run', () => {
    const withBonus = computeScore({ destructionPct: 85, shotsUsed: 1, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: true });
    const noBonus = computeScore({ destructionPct: 85, shotsUsed: MAX_SHOTS, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: true });
    expect(withBonus).toBeGreaterThan(noBonus);

    const notCleared1Shot = computeScore({ destructionPct: 50, shotsUsed: 1, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: false });
    const notCleared3Shots = computeScore({ destructionPct: 50, shotsUsed: 3, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: false });
    expect(notCleared1Shot).toBe(notCleared3Shots); // no shot-efficiency bonus if the objective wasn't met
  });

  it('rewards longer chain reactions', () => {
    const noChain = computeScore({ destructionPct: 60, shotsUsed: 2, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: false });
    const bigChain = computeScore({ destructionPct: 60, shotsUsed: 2, bestChain: 5, totalChainLinks: 6, timeMs: 5000, cleared: false });
    expect(bigChain).toBeGreaterThan(noChain);
  });

  it('adds a flat bonus for a Perfect Collapse', () => {
    const normal = computeScore({ destructionPct: 95, shotsUsed: 2, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: true });
    const perfect = computeScore({ destructionPct: 95, shotsUsed: 1, bestChain: 0, totalChainLinks: 0, timeMs: 5000, cleared: true });
    expect(perfect - normal).toBeGreaterThanOrEqual(5000);
  });
});

describe('ScoreSystem — near-miss messaging', () => {
  it('flags a close miss below the next threshold', () => {
    const gap = nextMedalGap(94.8);
    expect(gap).not.toBeNull();
    expect(gap!.label).toBe('CRASHPOINT');
    expect(gap!.gap).toBeCloseTo(0.2, 5);
  });

  it('returns null when nowhere near a threshold', () => {
    expect(nextMedalGap(40)).toBeNull();
  });

  it('returns null once every medal is secured', () => {
    expect(nextMedalGap(99)).toBeNull();
  });
});
