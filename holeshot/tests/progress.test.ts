import { describe, expect, it } from 'vitest';
import { emptyProgress, loadProgress, recordResult, saveProgress } from '../src/game/progress';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}

describe('progreso', () => {
  it('una medalla desbloquea la siguiente prueba y guarda la mejor marca', () => {
    const p = emptyProgress();
    expect(p.unlocked).toBe(1);
    recordResult(p, 1, { medal: 1, time: 50, score: 100, plates: 0, trickScore: 0 });
    expect(p.unlocked).toBe(2);
    recordResult(p, 1, { medal: 3, time: 42, score: 200, plates: 0, trickScore: 0 });
    recordResult(p, 1, { medal: 2, time: 45, score: 50, plates: 0, trickScore: 0 });
    expect(p.best[1]).toMatchObject({ medal: 3, time: 42, score: 200 });
  });

  it('se guarda y se recupera; datos corruptos no rompen el juego', () => {
    const s = new MemStorage() as unknown as Storage;
    const p = emptyProgress();
    recordResult(p, 1, { medal: 2, time: 47, score: 1, plates: 0, trickScore: 0 });
    saveProgress(p, s);
    expect(loadProgress(s).unlocked).toBe(2);
    s.setItem('holeshot:v1', '{no es json');
    expect(loadProgress(s)).toEqual(emptyProgress());
  });
});
