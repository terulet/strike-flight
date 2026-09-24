/**
 * Trazada de referencia: las placas que cuelgan en pleno salto se colocan
 * sobre la parabola real de una vuelta a gas a fondo del piloto automatico.
 * Asi siempre son alcanzables yendo rapido y limpio, aunque se retoque la
 * fisica o el trazado; la altura escrita en la pista es solo orientativa.
 */
import { Autopilot } from './autopilot';
import type { Mission } from './missions';
import { Race } from './race';

export function alignAirPickups(mission: Mission): void {
  const air = mission.track.pickups.filter((p) => p.air);
  if (!air.length) return;
  const race = new Race(mission);
  const pilot = new Autopilot();
  const found = new Set<number>();
  let prevX = race.bike.x;
  for (let t = 0; t < 120 && race.state !== 'finished' && race.state !== 'failed'; t += 1 / 120) {
    race.step(1 / 120, pilot.input(race));
    const x = race.bike.x;
    air.forEach((p, i) => {
      if (!found.has(i) && race.state === 'racing' && race.airborne && prevX < p.x && x >= p.x) {
        p.y = race.bike.y + 0.5;
        found.add(i);
      }
    });
    prevX = x;
  }
}
