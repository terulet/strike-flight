import type { Medal } from '../core/types';

export const OBJECTIVE_DESTRUCTION_PCT = 80;
export const SILVER_DESTRUCTION_PCT = 90;
export const GOLD_DESTRUCTION_PCT = 95;
export const PERFECT_COLLAPSE_PCT = 95;
export const MAX_SHOTS = 3;

/** Pure scoring math — kept free of EventBus/DOM so it's trivial to unit test (section 35). */

export function computeMedal(destructionPct: number, shotsUsed: number): Medal {
  if (destructionPct >= PERFECT_COLLAPSE_PCT && shotsUsed === 1) return 'crashpoint';
  if (destructionPct >= GOLD_DESTRUCTION_PCT) return 'gold';
  if (destructionPct >= SILVER_DESTRUCTION_PCT) return 'silver';
  if (destructionPct >= OBJECTIVE_DESTRUCTION_PCT) return 'bronze';
  return 'none';
}

export function isPerfectCollapse(destructionPct: number, shotsUsed: number): boolean {
  return destructionPct >= PERFECT_COLLAPSE_PCT && shotsUsed === 1;
}

export interface ScoreInput {
  destructionPct: number; // 0..100
  shotsUsed: number;
  bestChain: number;
  /** Sum over every closed chain of (length - 1), i.e. total "extra" chained breaks. */
  totalChainLinks: number;
  timeMs: number;
  cleared: boolean; // destructionPct >= OBJECTIVE_DESTRUCTION_PCT
}

export function computeScore(input: ScoreInput): number {
  const destructionScore = Math.round(input.destructionPct * 120);
  const chainBonus = input.totalChainLinks * 250;

  let shotsBonus = 0;
  let timeBonus = 0;
  if (input.cleared) {
    shotsBonus = Math.max(0, MAX_SHOTS - input.shotsUsed) * 400;
    timeBonus = Math.max(0, 2000 - Math.floor(input.timeMs / 50));
  }
  const perfectBonus = isPerfectCollapse(input.destructionPct, input.shotsUsed) ? 5000 : 0;

  return destructionScore + chainBonus + shotsBonus + timeBonus + perfectBonus;
}

/** How far below the next medal threshold the player landed — powers the "JUST X% FROM GOLD" UI (section 46). */
export function nextMedalGap(destructionPct: number): { label: string; gap: number } | null {
  const thresholds: Array<[string, number]> = [
    ['CRASHPOINT', PERFECT_COLLAPSE_PCT],
    ['GOLD', GOLD_DESTRUCTION_PCT],
    ['SILVER', SILVER_DESTRUCTION_PCT],
    ['BRONZE', OBJECTIVE_DESTRUCTION_PCT],
  ];
  for (const [label, threshold] of thresholds) {
    if (destructionPct < threshold) {
      const gap = Math.round((threshold - destructionPct) * 10) / 10;
      if (gap <= 5) return { label, gap };
      return null;
    }
  }
  return null;
}
