import { describe, expect, it } from 'vitest';
import { formatTime, saveBestTimeIfBetter } from '../src/gameplay/Scoring';

describe('Scoring', () => {
  it('formats seconds as mm:ss.mmm', () => {
    expect(formatTime(0)).toBe('00:00.000');
    expect(formatTime(1.5)).toBe('00:01.500');
    expect(formatTime(65.234)).toBe('01:05.234');
  });

  it('only updates the best time when the new time is strictly lower', () => {
    expect(saveBestTimeIfBetter(40, null)).toBe(true); // primera vez, siempre es record
    expect(saveBestTimeIfBetter(35, 40)).toBe(true); // mejora
    expect(saveBestTimeIfBetter(35, 35)).toBe(false); // empate no cuenta
    expect(saveBestTimeIfBetter(36, 35)).toBe(false); // peor
  });
});
