import { Autopilot, AutopilotOptions } from '../src/game/autopilot';
import { getMission } from '../src/game/missions';
import { Race, RaceEvents } from '../src/game/race';
import { BikeInput } from '../src/physics/bike';
import { TrackBuilder } from '../src/physics/trackBuilder';

export const DT = 1 / 120;

export function flatTerrain(len = 400) {
  return new TrackBuilder().flat(len).build(10, 10).terrain;
}

export function runBot(id: number, opts: AutopilotOptions = {}, maxTime = 150, events: RaceEvents = {}): Race {
  const race = new Race(getMission(id), events);
  const pilot = new Autopilot(opts);
  let t = 0;
  while (t < maxTime && race.state !== 'finished' && race.state !== 'failed') {
    race.step(DT, pilot.input(race));
    t += DT;
  }
  return race;
}

export function runInput(race: Race, seconds: number, input: (t: number) => BikeInput): void {
  for (let t = 0; t < seconds; t += DT) {
    if (race.state === 'finished' || race.state === 'failed') return;
    race.step(DT, input(t));
  }
}
