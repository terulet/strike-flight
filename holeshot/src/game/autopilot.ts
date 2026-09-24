/**
 * Piloto automatico. Conduce SOLO con los mandos de un jugador (gas, freno,
 * cuerpo, nitro): nada de tocar la fisica. Se usa para la demo del menu, para
 * `?autoplay=1` y en las pruebas para demostrar que cada prueba se puede
 * terminar.
 */
import { angleDiff, clamp } from '../core/math';
import { BikeInput, BikeState, isAirborne } from '../physics/bike';
import { TrackData } from '../physics/trackBuilder';

/** Lo que el piloto automatico necesita ver de quien conduce (jugador o rival). */
export interface PilotView {
  readonly bike: BikeState;
  readonly state: string;
  readonly track: TrackData;
  readonly currentAirTime: number;
  readonly currentAirRotation: number;
  readonly nitro: number;
  /** Segundos que faltan para que caiga la parrilla (si esta en la salida). */
  readonly countdown?: number;
}

export interface AutopilotOptions {
  /** Intenta mortales hacia atras cuando hay aire de sobra. */
  tricks?: boolean;
  /** Error de punteria del piloto (rad): 0 = perfecto. */
  sloppiness?: number;
}

export class Autopilot {
  private flipping = false;
  private flipTarget = 0;

  constructor(private readonly opts: AutopilotOptions = {}) {}

  input(race: PilotView): BikeInput {
    const b = race.bike;
    const terrain = race.track.terrain;
    const out: BikeInput = { throttle: 1, brake: 0, lean: 0, nitro: false };
    // En la parrilla: gas justo antes de que caiga, como un piloto de verdad.
    if (race.state === 'countdown') out.throttle = (race.countdown ?? 0) < 0.45 ? 1 : 0;
    if (race.state !== 'racing') return out;

    if (isAirborne(b)) {
      // Predice donde va a caer y apunta el chasis a esa pendiente.
      const fall = predictLanding(race);
      if (this.opts.tricks && !this.flipping && fall.time > 1.25 && race.currentAirTime < 0.35) {
        this.flipping = true;
        this.flipTarget = Math.PI * 2;
      }
      if (this.flipping) {
        const done = race.currentAirRotation;
        const remaining = fall.time - race.currentAirTime;
        if (done < this.flipTarget - 0.9 && remaining > 0.35) {
          out.lean = 1;
          return out;
        }
        this.flipping = false;
      }
      const target = Math.atan(terrain.slopeAt(fall.x)) + (this.opts.sloppiness ?? 0);
      const err = angleDiff(target, b.angle);
      const cmd = err * 2.4 - b.omega * 0.38;
      out.lean = clamp(cmd, -1, 1);
      if (Math.abs(out.lean) < 0.15) out.lean = 0;
    } else {
      this.flipping = false;
      const slope = Math.atan(terrain.slopeAt(b.x));
      const pitch = angleDiff(b.angle, slope);
      // Control de caballito y de morro.
      if (pitch > 0.32) out.lean = -1;
      else if (pitch < -0.25) out.lean = 0.6;
      else out.lean = clamp(-pitch * 2, -0.5, 0.5);
      if (pitch > 0.55) out.throttle = 0.3;
      out.nitro = race.nitro > 50 && Math.abs(terrain.slopeAt(b.x + 6)) < 0.08 && b.vx > 12;
    }
    return out;
  }
}

/** Integracion balistica simple hasta cortar el terreno. */
export function predictLanding(race: PilotView): { x: number; time: number } {
  const b = race.bike;
  const g = 11.5;
  let x = b.x;
  let y = b.y - 0.62;
  let vx = b.vx;
  let vy = b.vy;
  let t = 0;
  const dt = 0.02;
  for (let i = 0; i < 250; i++) {
    vy -= g * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    if (y <= race.track.terrain.heightAt(x)) break;
  }
  return { x, time: race.currentAirTime + t };
}
