/** Regla comun de caida para jugador y rivales. */
import { angleDiff } from '../core/math';
import { BikeState, isAirborne } from '../physics/bike';
import { TrackData } from '../physics/trackBuilder';

/**
 * Hay caida si la cabeza o la espalda tocan el suelo, si se cae al fondo de
 * un foso o si la moto se queda volcada en el suelo mas de un cuarto de
 * segundo. `upside` guarda ese tiempo entre llamadas.
 */
export function crashCheck(track: TrackData, b: BikeState, headHit: boolean, dt: number, upside: { t: number }): boolean {
  if (headHit) return true;
  for (const pit of track.pits) {
    if (b.x > pit.startX && b.x < pit.endX && b.y < pit.killY) return true;
  }
  const slope = Math.atan(track.terrain.slopeAt(b.x));
  const tilt = Math.abs(angleDiff(b.angle, slope));
  if (!isAirborne(b) && tilt > 1.6) {
    upside.t += dt;
    if (upside.t > 0.25) return true;
  } else upside.t = 0;
  return false;
}
