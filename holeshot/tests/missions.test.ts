import { describe, expect, it } from 'vitest';
import { Autopilot } from '../src/game/autopilot';
import { MISSION_COUNT, getMission, medalFor } from '../src/game/missions';
import { Race } from '../src/game/race';
import { DT, runBot, runInput } from './helpers';

const ids = Array.from({ length: MISSION_COUNT }, (_, i) => i + 1);

describe('las cinco pruebas', () => {
  it('hay cinco pruebas con objetivos y mundos distintos', () => {
    expect(MISSION_COUNT).toBe(5);
    const ms = ids.map(getMission);
    expect(new Set(ms.map((m) => m.objective)).size).toBe(5);
    expect(new Set(ms.map((m) => m.theme.weather)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(ms.map((m) => m.name)).size).toBe(5);
  });

  it.each(ids)('prueba %i: trazado largo y variado, datos coherentes', (id) => {
    const m = getMission(id);
    const t = m.track;
    expect(t.finishX - t.startX).toBeGreaterThan(650);
    expect(t.checkpoints.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < t.checkpoints.length; i++) expect(t.checkpoints[i]).toBeGreaterThan(t.checkpoints[i - 1] + 40);
    expect(t.kickers.length).toBeGreaterThanOrEqual(4);
    expect(t.obstacles.length).toBeGreaterThan(0);
    expect(t.sections.length).toBeGreaterThanOrEqual(7);
    for (const p of t.pickups) expect(p.y).toBeGreaterThan(t.terrain.heightAt(p.x));
    // Desniveles de verdad: la pista sube y baja varios metros.
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = t.startX; x < t.finishX; x += 1) {
      const h = t.terrain.heightAt(x);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    expect(hi - lo).toBeGreaterThan(4);
  });

  it.each(ids)('prueba %i: el piloto automatico la termina sin caerse y con medalla', (id) => {
    const m = getMission(id);
    const race = runBot(id);
    expect(race.state).toBe('finished');
    expect(race.crashes).toBe(0);
    expect(race.maxAirTime).toBeGreaterThan(1.5);
    const medal = medalFor(m, { finished: true, time: race.time, trickScore: race.trickScore, plates: race.platesCollected, crashes: race.crashes, position: race.position });
    expect(medal).toBeGreaterThanOrEqual(m.objective === 'tricks' ? 1 : 2);
  });

  it.each(ids)('prueba %i: desde cada checkpoint se puede seguir (sin trampas de reaparicion)', (id) => {
    const m = getMission(id);
    for (let cp = 1; cp < m.track.checkpoints.length; cp++) {
      const race = new Race(m);
      race.countdown = 0;
      race.step(DT, { throttle: 0, brake: 0, lean: 0, nitro: false });
      race.startFromCheckpoint(cp);
      const pilot = new Autopilot();
      const target = m.track.checkpoints[cp + 1] ?? m.track.finishX;
      let t = 0;
      while (t < 40 && race.bike.x < target && race.state === 'racing') {
        race.step(DT, pilot.input(race));
        t += DT;
      }
      expect(race.crashes, `checkpoint ${cp}`).toBe(0);
      expect(race.bike.x >= target || race.state === 'finished', `checkpoint ${cp}`).toBe(true);
    }
  });

  it('la cantera: se pueden coger las 10 placas', () => {
    const race = runBot(2);
    expect(race.track.pickups.filter((p) => p.kind === 'plate').length).toBe(10);
    expect(race.platesCollected).toBe(10);
  });

  it('el bosque: los mortales puntuan y encadenan combo', () => {
    const race = runBot(3, { tricks: true });
    expect(race.state).toBe('finished');
    expect(race.flips).toBeGreaterThanOrEqual(2);
    expect(race.trickScore).toBeGreaterThanOrEqual(getMission(3).medals.silverScore ?? 0);
    expect(race.bestCombo).toBeGreaterThanOrEqual(1);
  });

  it('la tormenta alcanza a quien se queda parado', () => {
    const race = new Race(getMission(4));
    runInput(race, 20, () => ({ throttle: 0, brake: 0, lean: 0, nitro: false }));
    expect(race.state).toBe('failed');
    expect(race.failReason).toMatch(/tormenta/i);
  });

  it('caer en un foso cuenta como caida y reaparece en el checkpoint', () => {
    const m = getMission(1);
    let crashes = 0;
    let respawns = 0;
    const race = new Race(m, { onCrash: () => crashes++, onRespawn: () => respawns++ });
    // Llegar al barranco sin gas suficiente: el salto se queda corto.
    race.countdown = 0;
    runInput(race, 60, (t) => ({ throttle: t % 1 < 0.35 ? 1 : 0, brake: 0, lean: 0, nitro: false }));
    expect(crashes).toBeGreaterThan(0);
    expect(respawns).toBeGreaterThan(0);
    expect(race.state === 'racing' || race.state === 'crashed' || race.state === 'finished').toBe(true);
  });

  it('la final: cuatro pilotos, parrilla, holeshot y el mejor gana', () => {
    const m = getMission(5);
    expect(m.rivals.length).toBe(3);
    let holeshot: string | null = null;
    let start = '';
    const race = runBot(5, {}, 150, {
      onHoleshot: (r) => (holeshot = r ? r.spec.name : 'JUGADOR'),
      onStart: (k) => (start = k),
    });
    expect(start).toBe('perfect');
    expect(holeshot).toBe('JUGADOR');
    expect(race.state).toBe('finished');
    expect(race.position).toBe(1);
    // Los rivales corren de verdad: van por detras pero cerca, no parados.
    for (const r of race.rivals) {
      expect(r.state === 'racing' || r.state === 'finished').toBe(true);
      expect(r.bike.x).toBeGreaterThan(m.track.startX + (m.track.finishX - m.track.startX) * 0.7);
    }
  });

  it('un piloto flojo pierde la final contra los rivales', () => {
    const race = new Race(getMission(5));
    const pilot = new Autopilot();
    let t = 0;
    while (t < 150 && race.state !== 'finished') {
      const inp = pilot.input(race);
      inp.nitro = false;
      // Levanta el gas en cada recta (pero va a fondo a los saltos).
      const next = race.track.kickers.find((k) => k > race.bike.x - 2);
      const nearJump = next !== undefined && next - race.bike.x < 48;
      if (!race.airborne && !nearJump && Math.hypot(race.bike.vx, race.bike.vy) > 14) inp.throttle = 0.1;
      race.step(DT, inp);
      t += DT;
    }
    expect(race.state).toBe('finished');
    expect(race.position).toBeGreaterThan(1);
  });

  it('la parrilla: gas justo antes = salida perfecta; gas toda la cuenta atras = patina', () => {
    const perfect = new Race(getMission(5));
    runInput(perfect, 3.2, (t) => ({ throttle: t > 2.5 ? 1 : 0, brake: 0, lean: 0, nitro: false }));
    expect(perfect.startKind).toBe('perfect');
    const spin = new Race(getMission(5));
    runInput(spin, 3.2, () => ({ throttle: 1, brake: 0, lean: 0, nitro: false }));
    expect(spin.startKind).toBe('spin');
    const late = new Race(getMission(5));
    runInput(late, 4, (t) => ({ throttle: t > 3.6 ? 1 : 0, brake: 0, lean: 0, nitro: false }));
    expect(late.startKind).toBe('late');
    expect(perfect.bike.x).toBeGreaterThan(spin.bike.x);
  });

  it('el barro frena y resbala', () => {
    const m = getMission(3);
    const zone = m.track.terrain.mud[0];
    expect(zone).toBeDefined();
    expect(m.track.terrain.mudAt((zone.x0 + zone.x1) / 2)).toBe(1);
    expect(m.track.terrain.mudAt(zone.x0 - 5)).toBe(0);
  });

  it('las medallas siguen las reglas de cada prueba', () => {
    const t = getMission(1);
    const base = { finished: true, time: 0, trickScore: 0, plates: 0, crashes: 0 };
    expect(medalFor(t, { ...base, time: t.medals.gold - 1 })).toBe(3);
    expect(medalFor(t, { ...base, time: t.medals.silver - 0.5 })).toBe(2);
    expect(medalFor(t, { ...base, time: 999 })).toBe(1);
    expect(medalFor(t, { ...base, finished: false })).toBe(0);
    const q = getMission(2);
    expect(medalFor(q, { ...base, time: 1, plates: 9 })).toBe(2);
    expect(medalFor(q, { ...base, time: 1, plates: 10 })).toBe(3);
    const f = getMission(3);
    expect(medalFor(f, { ...base, time: 999, trickScore: f.medals.goldScore ?? 0 })).toBe(3);
    const fin = getMission(5);
    expect(medalFor(fin, { ...base, time: 999, position: 1 })).toBe(3);
    expect(medalFor(fin, { ...base, time: 1, position: 2 })).toBe(2);
    expect(medalFor(fin, { ...base, time: 1, position: 4 })).toBe(1);
  });
});
