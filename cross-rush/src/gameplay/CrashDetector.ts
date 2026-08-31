/**
 * CrashDetector.ts
 *
 * Ademas del crash derivado de un mal aterrizaje (ver LandingClassifier),
 * la moto puede estrellarse si el chasis (no las ruedas) llega a tocar el
 * terreno -por ejemplo, cayendo de morro o de espaldas- o si gira demasiado
 * rapido estando en contacto con el suelo.
 */

import { BikeState } from '../physics/Bike';
import { Terrain } from '../physics/Terrain';
import { CrashConfig } from '../config/GameConfig';

export function isChassisTouchingGround(state: BikeState, terrain: Terrain): boolean {
  const groundY = terrain.surfaceY(state.x);
  const clearance = state.y - groundY;
  return clearance < CrashConfig.chassisGroundMargin;
}

export function isSpinningOutOnGround(state: BikeState): boolean {
  const grounded = state.front.inContact || state.rear.inContact;
  return grounded && Math.abs(state.angularVelocity) >= CrashConfig.crashAngularVelocity;
}
