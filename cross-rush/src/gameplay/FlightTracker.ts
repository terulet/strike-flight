/**
 * FlightTracker.ts
 *
 * Observa el estado de la moto tick a tick y detecta transiciones
 * suelo <-> aire. Mientras esta en el aire acumula rotacion (para detectar
 * trucos) y registra el momento exacto en el que cada rueda vuelve a tocar
 * el suelo (para el "contactTimingGap" que usa el LandingClassifier).
 */

import { BikeState } from '../physics/Bike';
import { Terrain } from '../physics/Terrain';
import { angleDelta } from '../physics/MathUtils';
import { classifyLanding } from './LandingClassifier';
import { LandingQuality, TrickResult } from './types';
import { TrickConfig } from '../config/GameConfig';

export interface LandingEvent {
  quality: LandingQuality;
  trick: TrickResult | null;
  airTime: number;
}

export class FlightTracker {
  private wasAirborne = false;
  private airTime = 0;
  private accumulatedRotation = 0;
  private prevAngle = 0;
  private frontContactAt: number | null = null;
  private rearContactAt: number | null = null;
  private hadAirControlInput = false;

  reset(): void {
    this.wasAirborne = false;
    this.airTime = 0;
    this.accumulatedRotation = 0;
    this.frontContactAt = null;
    this.rearContactAt = null;
    this.hadAirControlInput = false;
  }

  /** Si el jugador uso el control aereo durante el ultimo/actual vuelo. */
  get usedAirControlThisFlight(): boolean {
    return this.hadAirControlInput;
  }

  get currentAirTime(): number {
    return this.airTime;
  }

  get isTrackingFlight(): boolean {
    return this.wasAirborne;
  }

  /** Llamar una vez por tick de simulacion, con dt en segundos. */
  update(state: BikeState, terrain: Terrain, leanInput: number, dt: number): LandingEvent | null {
    const airborne = !state.front.inContact && !state.rear.inContact;

    if (airborne) {
      if (!this.wasAirborne) {
        // Empieza un nuevo vuelo.
        this.airTime = 0;
        this.accumulatedRotation = 0;
        this.prevAngle = state.angle;
        this.frontContactAt = null;
        this.rearContactAt = null;
        this.hadAirControlInput = false;
      } else {
        this.accumulatedRotation += angleDelta(this.prevAngle, state.angle);
        this.prevAngle = state.angle;
      }
      this.airTime += dt;
      if (leanInput !== 0) this.hadAirControlInput = true;
      this.wasAirborne = true;
      return null;
    }

    // Grounded este tick.
    if (state.front.inContact && this.frontContactAt === null) this.frontContactAt = this.airTime;
    if (state.rear.inContact && this.rearContactAt === null) this.rearContactAt = this.airTime;

    if (!this.wasAirborne) {
      // Ya estaba en el suelo, nada que reportar.
      return null;
    }

    // Transicion aire -> suelo: calcular el aterrizaje.
    this.wasAirborne = false;
    const frontAt = this.frontContactAt ?? this.airTime;
    const rearAt = this.rearContactAt ?? this.airTime;
    const contactTimingGap = Math.abs(frontAt - rearAt);

    const groundSlope = terrain.surfaceSlope((state.front.contactX + state.rear.contactX) / 2);
    const slopeAngle = Math.atan(groundSlope);
    const angleDiff = Math.abs(angleDelta(slopeAngle, state.angle));

    const quality = classifyLanding({
      angleDiff,
      verticalSpeed: Math.abs(state.vy),
      contactTimingGap,
      angularVelocity: Math.abs(state.angularVelocity),
    });

    let trick: TrickResult | null = null;
    if (quality !== 'CRASH' && Math.abs(this.accumulatedRotation) >= TrickConfig.minRotationForTrick) {
      const rotations = Math.abs(this.accumulatedRotation) / TrickConfig.fullRotation;
      // El signo: en mundo, Y va hacia arriba y los angulos positivos son
      // antihorarios. Avanzando hacia +x, girar en sentido antihorario es
      // levantar el morro, o sea un BACKFLIP. Estaba al reves, y aunque hoy
      // el HUD solo dice "mortal", el nombre viajaba mal a los resultados.
      trick = { type: this.accumulatedRotation > 0 ? 'BACKFLIP' : 'FRONTFLIP', rotations };
    }

    const airTime = this.airTime;
    this.airTime = 0;
    this.accumulatedRotation = 0;

    return { quality, trick, airTime };
  }
}
