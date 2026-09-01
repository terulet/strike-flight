/**
 * LandingClassifier.ts
 *
 * Clasifica la calidad de un aterrizaje segun el angulo respecto a la
 * pendiente del terreno, la velocidad de impacto CONTRA EL SUELO, el desfase
 * temporal entre el contacto de la rueda delantera y la trasera, y la
 * velocidad angular en el momento del impacto. Umbrales centralizados en
 * GameConfig (LandingConfig / CrashConfig) - nada de numeros sueltos aqui.
 */

import { CrashConfig, LandingConfig } from '../config/GameConfig';
import { LandingQuality } from './types';

export interface LandingSample {
  /** Diferencia absoluta entre el angulo de la moto y el de la pendiente (rad). */
  angleDiff: number;
  /**
   * Velocidad de impacto CONTRA EL PLANO DEL SUELO (m/s): la componente de la
   * velocidad perpendicular a la superficie, no la vertical del mundo.
   *
   * La diferencia decide si un salto grande es posible. Cayendo a 25 m/s en
   * una trayectoria de 45 grados, la velocidad vertical del mundo son 17,7
   * m/s: por encima del umbral de choque, o sea crash garantizado por muy
   * bien que se caiga. Pero si el terreno tambien BAJA, el suelo se aparta
   * mientras la moto cae y el golpe real es mucho menor: sobre una rampa de
   * recepcion de 25 grados esos mismos 25 m/s son 8,7 m/s contra el suelo.
   *
   * Es justo para lo que existe una rampa de aterrizaje en una pista de
   * motocross de verdad, y es lo que permite que la moto se pose despues de
   * un vuelo de segundo y medio en vez de estamparse siempre. En llano la
   * normal es vertical y este numero vuelve a ser exactamente |vy|, asi que
   * nada de lo que ya funcionaba cambia.
   */
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
