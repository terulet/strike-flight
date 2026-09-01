import { describe, expect, it } from 'vitest';
import { RaceManager } from '../src/gameplay/RaceManager';
import { buildCanyonRun } from '../src/tracks/CanyonRun';
import { InputState } from '../src/input/InputManager';
import { SIM_DT } from '../src/config/GameConfig';

function neutralInput(): InputState {
  return { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false };
}

function driveToRacing(race: RaceManager): void {
  race.begin();
  // Avanza el countdown hasta RACING.
  while (race.state === 'COUNTDOWN') {
    race.step(SIM_DT, neutralInput());
  }
}

describe('RaceManager', () => {
  it('only advances the race timer while RACING, and freezes it once FINISHED', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    expect(race.raceTime).toBe(0);

    // En READY/COUNTDOWN no debe avanzar el crono de carrera.
    race.step(SIM_DT, neutralInput());
    expect(race.raceTime).toBe(0);

    driveToRacing(race);
    expect(race.state).toBe('RACING');

    race.step(SIM_DT, { throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false });
    const afterOneStep = race.raceTime;
    expect(afterOneStep).toBeCloseTo(SIM_DT, 9);

    // Forzamos el final de la carrera colocando la moto justo sobre la meta,
    // ya asentada en el suelo para no disparar un crash de chasis.
    race.bike.x = track.finishX;
    race.bike.y = track.terrain.surfaceY(track.finishX) + 0.9;
    race.bike.vx = 5;
    race.bike.vy = 0;
    race.step(SIM_DT, neutralInput());
    expect(race.state).toBe('FINISHED');
    expect(race.sectorSplits).toHaveLength(track.sectors.length);
    const frozenTime = race.raceTime;

    for (let i = 0; i < 10; i++) {
      race.step(SIM_DT, neutralInput());
    }
    expect(race.raceTime).toBe(frozenTime);
  });

  it('never promotes a crashed partial run to best time', () => {
    const race = new RaceManager(buildCanyonRun());
    driveToRacing(race);
    race.bike.y = -1000;
    race.step(SIM_DT, neutralInput());
    expect(race.getResultsSummary().isNewBest).toBe(false);
  });

  it('la vuelta tiene dos sectores: aprendizaje y espectaculo', () => {
    // El delta comparado por sector sigue congelado; lo que se comprueba aqui
    // es que el cronometraje por sectores esta enganchado, empieza en el
    // primero y cierra los dos al cruzar la meta.
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    driveToRacing(race);
    expect(race.currentSectorName).toBe('S1/2 APRENDIZAJE');
    expect(race.sectorSplits).toHaveLength(0);

    race.bike.x = track.finishX;
    race.bike.y = track.terrain.surfaceY(track.finishX) + 0.9;
    race.bike.vx = 5;
    race.step(SIM_DT, neutralInput());
    expect(race.state).toBe('FINISHED');
    expect(race.sectorSplits).toHaveLength(2);
  });

  it('resets all transient race state on restart but preserves the best time', () => {
    const track = buildCanyonRun();
    const race = new RaceManager(track);
    driveToRacing(race);
    race.step(SIM_DT, { throttle: true, brake: false, lean: 0, restartPressed: false, boostPressed: false });

    // Termina la carrera para fijar un "best time".
    race.bike.x = track.finishX;
    race.bike.y = track.terrain.surfaceY(track.finishX) + 0.9;
    race.bike.vx = 5;
    race.bike.vy = 0;
    race.step(SIM_DT, neutralInput());
    expect(race.state).toBe('FINISHED');
    race.getResultsSummary(); // persiste el best (localStorage si existe, o al menos en memoria)
    const bestAfterFinish = race.getBestTimeSeconds();
    expect(bestAfterFinish).not.toBeNull();

    race.restart();
    expect(race.state).toBe('COUNTDOWN');
    expect(race.raceTime).toBe(0);
    expect(race.flow.value).toBe(0);
    expect(race.styleScore.tricks).toBe(0);
    expect(race.styleScore.perfectLandings).toBe(0);
    expect(race.bike.x).toBeCloseTo(buildCanyonRun().startX, 5);
    expect(race.bike.vx).toBe(0);
    expect(race.bike.vy).toBe(0);

    // El mejor tiempo se conserva a traves del reinicio.
    expect(race.getBestTimeSeconds()).toBe(bestAfterFinish);
  });

  it('restart also works as an immediate escape from a CRASHED state', () => {
    const race = new RaceManager(buildCanyonRun());
    driveToRacing(race);
    // Forzamos un crash directo manipulando el estado del chasis.
    race.bike.y = -1000; // muy por debajo del terreno -> chasis "tocando suelo"
    race.step(SIM_DT, neutralInput());
    expect(race.state).toBe('CRASHED');

    race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: true, boostPressed: false });
    expect(race.state).toBe('COUNTDOWN');
    expect(race.raceTime).toBe(0);
  });
});
