import { describe, expect, it } from 'vitest';
import { Autopilot } from '../src/game/autopilot';
import { GhostPlayer, GhostRecorder, decodeGhost, encodeGhost } from '../src/game/ghost';
import { getMission } from '../src/game/missions';
import { Race } from '../src/game/race';
import { DT } from './helpers';

describe('fantasmas', () => {
  const race = new Race(getMission(1));
  const rec = new GhostRecorder();
  const pilot = new Autopilot();
  for (let t = 0; t < 150 && race.state !== 'finished'; t += DT) {
    race.step(DT, pilot.input(race));
    if (race.state === 'racing') rec.record(race.time, race.bike.x, race.bike.y, race.bike.angle);
  }
  const data = { track: 'm:1', time: race.time, colors: 'blue', number: '23', name: 'ÑOÑO_RÁPIDO', samples: rec.samples };
  const token = encodeGhost(data);

  it('cabe en un enlace y solo usa caracteres validos para un ancla', () => {
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThan(3000);
  });

  it('ida y vuelta: misma pista, tiempo, piloto y trayectoria (a 5 cm)', () => {
    const g = decodeGhost(token);
    expect(g).not.toBeNull();
    expect(g!.track).toBe('m:1');
    expect(g!.time).toBeCloseTo(race.time, 2);
    expect(g!.colors).toBe('blue');
    expect(g!.number).toBe('23');
    expect(g!.name).toBe('ÑOÑO_RÁPIDO');
    expect(g!.samples.length).toBe(rec.samples.length);
    for (let i = 0; i < rec.samples.length; i += 3) {
      expect(Math.abs(g!.samples[i] - rec.samples[i])).toBeLessThan(0.05);
      expect(Math.abs(g!.samples[i + 1] - rec.samples[i + 1])).toBeLessThan(0.05);
    }
  });

  it('las fechas del Barro del Dia viajan en el enlace', () => {
    const g = decodeGhost(encodeGhost({ ...data, track: 'd:2026-10-31' }));
    expect(g!.track).toBe('d:2026-10-31');
  });

  it('un enlace roto no rompe nada', () => {
    expect(decodeGhost('')).toBeNull();
    expect(decodeGhost('%%%')).toBeNull();
    expect(decodeGhost(token.slice(0, 20))).toBeNull();
    expect(decodeGhost('AAAAAAAA')).toBeNull();
  });

  it('reproduce la posicion y sabe cuando paso por cada punto', () => {
    const p = new GhostPlayer(decodeGhost(token)!);
    const mid = p.at(10);
    expect(Math.abs(mid.x - rec.samples[100 * 3])).toBeLessThan(0.1);
    const tx = p.timeAtX(mid.x);
    expect(tx).not.toBeNull();
    expect(Math.abs((tx as number) - 10)).toBeLessThan(0.15);
    expect(p.at(9999).done).toBe(true);
  });
});
