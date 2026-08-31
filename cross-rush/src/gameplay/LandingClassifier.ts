/**
 * LandingClassifier.ts
 *
 * Clasifica la calidad de un aterrizaje segun el angulo respecto a la
 * pendiente del terreno, la velocidad vertical/horizontal de impacto, el
 * desfase temporal entre el contacto de la rueda delantera y la trasera, y la
 * velocidad angular en el momento del impacto. Umbrales centralizados en
 * GameConfig (LandingConfig / CrashConfig) - nada de numeros sueltos aqui.
 */

import { CrashConfig, LandingConfig } from '../config/GameConfig';
import { LandingQuality } from './types';

export interface LandingSample {
  /** Diferencia absoluta entre el angulo de la moto y el de la pendiente (rad). */
  angleDiff: number;
  /** Velocidad vertical absoluta en el momento del contacto (m/s). */
  verticalSpeed: number;
  /** Desfase entre el contacto delantero y trasero, en segundos (absoluto). */
  contactTimingGap: number;
  /** Velocidad angular absoluta en el momento del contacto (rad/s). */
  angularVelocity: number;
}

export function classifyLanding(sample: LandingSample): LandingQuality {
  const { angleDiff, verticalSpeed, contactTimingGap, angularVelocity } = sample;

  if (
    angleDiff >= CrashConfig.crashLandingAngle ||
    verticalSpeed >= CrashConfig.crashImpactSpeed ||
    angularVelocity >= CrashConfig.crashAngularVelocity
  ) {
    return 'CRASH';
  }

  interface LandingThreshold {
    angle: number;
    verticalSpeed: number;
    contactTimingGap: number;
  }
  const levels: Array<{ quality: LandingQuality; cfg: LandingThreshold }> = [
    { quality: 'PERFECT', cfg: LandingConfig.perfect },
    { quality: 'GOOD', cfg: LandingConfig.good },
    { quality: 'ROUGH', cfg: LandingConfig.rough },
    { quality: 'BAD', cfg: LandingConfig.bad },
  ];

  for (const level of levels) {
    if (
      angleDiff <= level.cfg.angle &&
      verticalSpeed <= level.cfg.verticalSpeed &&
      contactTimingGap <= level.cfg.contactTimingGap
    ) {
      return level.quality;
    }
  }

  return 'CRASH';
}
