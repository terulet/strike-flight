import { describe, expect, it } from 'vitest';
import { Autopilot } from '../src/game/autopilot';
import { buildDailyTrack, dayKey, dayNumber, getDailyMission, isDayKey } from '../src/game/daily';
import { Race } from '../src/game/race';
import { DT } from './helpers';

function keys(from: string, n: number): string[] {
  const [y, m, d] = from.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

describe('Barro del Día', () => {
  it('la misma fecha da exactamente la misma pista; otra fecha, otra distinta', () => {
    const a = buildDailyTrack('2026-10-01');
    const b = buildDailyTrack('2026-10-01');
    const c = buildDailyTrack('2026-10-02');
    expect(a.sections.map((s) => s.name)).toEqual(b.sections.map((s) => s.name));
    expect(a.finishX).toBe(b.finishX);
    for (let x = 0; x < a.finishX; x += 7) expect(a.terrain.heightAt(x)).toBe(b.terrain.heightAt(x));
    expect(c.sections.map((s) => s.name)).not.toEqual(a.sections.map((s) => s.name));
  });

  it('numera las ediciones y reconoce las claves', () => {
    expect(dayNumber('2026-09-24')).toBe(1);
    expect(dayNumber('2026-10-24')).toBe(31);
    expect(isDayKey(dayKey())).toBe(true);
    expect(isDayKey('2026-9-1')).toBe(false);
  });

  it.each(keys('2026-09-24', 30))('%s: se termina sin caerse y cada checkpoint tiene salida', (key) => {
    const m = getDailyMission(key);
    const t = m.track;
    expect(t.finishX - t.startX).toBeGreaterThan(600);
    expect(t.kickers.length).toBeGreaterThanOrEqual(3);
    expect(t.terrain.mud.length).toBeGreaterThan(0);
    expect(m.medals.gold).toBeLessThan(m.medals.silver);

    const race = new Race(m);
    const pilot = new Autopilot();
    for (let s = 0; s < 150 && race.state !== 'finished'; s += DT) race.step(DT, pilot.input(race));
    expect(race.state).toBe('finished');
    expect(race.crashes).toBe(0);

    for (let cp = 1; cp < t.checkpoints.length; cp++) {
      const r = new Race(m);
      r.countdown = 0;
      r.step(DT, { throttle: 0, brake: 0, lean: 0, nitro: false });
      r.startFromCheckpoint(cp);
      const p = new Autopilot();
      const target = t.checkpoints[cp + 1] ?? t.finishX;
      for (let s = 0; s < 40 && r.bike.x < target && r.state === 'racing'; s += DT) r.step(DT, p.input(r));
      expect(r.crashes, `checkpoint ${cp}`).toBe(0);
    }
  });
});
