/**
 * El record se crea al TERMINAR la vuelta, no al mirar el panel.
 *
 * Estaba dentro de `getResultsSummary()`: guardar el mejor tiempo y el
 * fantasma era un efecto secundario de pintar la pantalla de resultados. Se
 * veia jugando -el HUD lee el record en cuanto cambia el estado a FINISHED, o
 * sea antes de que el panel exista, y por eso la segunda vuelta seguia
 * mostrando "--:--.---" con el record ya guardado en el navegador- y ademas
 * dejaba el estado del juego dependiendo de si alguien habia abierto una
 * ventana.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RaceManager } from '../src/gameplay/RaceManager';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { SIM_DT } from '../src/config/GameConfig';
import { isAirborne } from '../src/physics/Bike';
import { StorageKeys } from '../src/config/GameConfig';

/** localStorage minimo: en node no existe y el juego lo consulta de verdad. */
function installStorage(): Map<string, string> {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  });
  return data;
}

function correrVuelta(race: RaceManager, track: ReturnType<typeof buildCanyonRun>): void {
  race.begin();
  while (race.state === 'COUNTDOWN') {
    race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });
  }
  while (race.state === 'RACING' && race.raceTime < 120 && race.bike.x < track.finishX) {
    let lean = 0;
    if (isAirborne(race.bike)) {
      const bike = race.bike;
      const ahead = Math.max(2, Math.abs(bike.vx) * 0.32);
      let delta = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) - bike.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      const want = delta * 2.2 - bike.angularVelocity * 0.42;
      lean = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
    }
    race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed: false });
  }
}

describe('record de vuelta', () => {
  let data: Map<string, string>;
  beforeEach(() => { data = installStorage(); });

  it('terminar la vuelta guarda tiempo y fantasma SIN abrir el panel de resultados', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    correrVuelta(race, track);
    expect(race.state).toBe('FINISHED');

    // Nadie ha llamado a getResultsSummary(), y aun asi hay record.
    expect(data.has(StorageKeys.bestTime)).toBe(true);
    expect(data.has(StorageKeys.bestGhost)).toBe(true);
    // Y el HUD, que lee esto en cuanto cambia el estado, ya ve el numero.
    expect(race.getBestTimeSeconds()).toBeCloseTo(race.raceTime, 5);
  });

  it('el delta del resumen compara contra el record ANTERIOR, no contra si mismo', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    correrVuelta(race, track);
    const primera = race.getResultsSummary();
    // Primera vuelta: no habia con que compararse.
    expect(primera.isNewBest).toBe(true);
    expect(primera.deltaSeconds).toBeNull();

    correrVuelta(race, track);
    const segunda = race.getResultsSummary();
    // Si el delta se midiera contra el record ya actualizado, una vuelta que
    // mejora daria 0,000 exactamente cuando mas interesa verlo.
    expect(segunda.deltaSeconds).not.toBeNull();
    expect(segunda.deltaSeconds).toBeCloseTo(segunda.timeSeconds - primera.timeSeconds, 5);
  });

  it('leer el resumen dos veces no cambia nada', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    correrVuelta(race, track);
    const a = race.getResultsSummary();
    const b = race.getResultsSummary();
    expect(b).toEqual(a);
  });
});
