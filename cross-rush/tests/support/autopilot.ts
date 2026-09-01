/**
 * autopilot.ts
 *
 * Tres pilotos automaticos para medir la DIFICULTAD de la pista.
 *
 * Por que existe: durante todo el desarrollo la unica forma de decir si el
 * tramo estaba bien de dificultad era la impresion de quien lo miraba, y la
 * impresion se equivoca. Un piloto automatico que mantiene el gas a fondo
 * cincuenta y siete segundos y llega a meta sin un rasguno no es una opinion,
 * es un dato: significa que no hay una sola decision en toda la vuelta cuyo
 * error se pague.
 *
 * Con tres niveles la medida se vuelve util de verdad, porque el criterio deja
 * de ser "que sea dificil" -que no dice nada- y pasa a ser una frase que se
 * puede comprobar:
 *
 *   el DESCUIDADO no llega, el COMPETENTE llega, y el PERFECTO ademas hace
 *   buen tiempo.
 *
 * Si las tres llegan igual de lejos, el juego no pide nada. Si no llega
 * ninguna, es injusto. El hueco entre ellas ES la dificultad.
 */

import { isAirborne } from '../../src/physics/Bike';
import { RaceManager } from '../../src/gameplay/RaceManager';
import { SIM_DT } from '../../src/config/GameConfig';
import { LandingQuality } from '../../src/gameplay/types';
import { TrackDefinition } from '../../src/tracks/CanyonRun';

export type PilotSkill = 'perfecto' | 'competente' | 'descuidado';

export interface PilotRun {
  skill: PilotSkill;
  /** FINISHED o CRASHED. */
  state: string;
  /** Segundos de carrera al terminar. */
  time: number;
  /** x donde acabo (meta o choque). */
  x: number;
  /** Recuento de aterrizajes por calidad. */
  landings: Record<LandingQuality, number>;
  /** Cadena mas larga conseguida. */
  bestCombo: number;
  /** Puntuacion final. */
  score: number;
  /** Velocidad media en el tramo recorrido (m/s). */
  meanSpeed: number;
}

interface PilotProfile {
  /** Segundos entre correcciones de aire. Un humano no corrige cada 8 ms. */
  reactionDelay: number;
  /** Zona muerta del mando: por debajo de esto no toca nada. */
  deadzone: number;
  /** Si es false, no controla el aire en absoluto. */
  airControl: boolean;
  /** Error sistematico de puntería sobre la pendiente objetivo (rad). */
  aimBias: number;
}

/**
 * Los tres perfiles. No son "mas o menos habil" en abstracto: se diferencian
 * en las tres cosas concretas que separan a un jugador bueno de uno malo en un
 * juego de motocross 2D -mirar adelante, reaccionar rapido y apuntar bien-.
 */
const PROFILES: Record<PilotSkill, PilotProfile> = {
  // Reacciona cada tick y apunta exacto: el techo teorico del juego.
  perfecto: { reactionDelay: 0, deadzone: 0.25, airControl: true, aimBias: 0 },
  // Un jugador decente: ~180 ms de reaccion, mando mas grueso y algo de sesgo.
  competente: { reactionDelay: 0.18, deadzone: 0.55, airControl: true, aimBias: 0.1 },
  // Gas a fondo y nada mas. Es el jugador que aun no ha entendido que en el
  // aire hay que hacer algo.
  descuidado: { reactionDelay: 0, deadzone: 0, airControl: false, aimBias: 0 },
};

export function runPilot(track: TrackDefinition, skill: PilotSkill, maxSeconds = 150): PilotRun {
  const profile = PROFILES[skill];
  const landings: Record<LandingQuality, number> = { PERFECT: 0, GOOD: 0, ROUGH: 0, BAD: 0, CRASH: 0 };
  const race = new RaceManager(track, { onLanding: (event) => { landings[event.quality] += 1; } });
  race.begin();
  while (race.state === 'COUNTDOWN') {
    race.step(SIM_DT, { throttle: false, brake: false, lean: 0, restartPressed: false, boostPressed: false });
  }

  let lean = 0;
  let sinceDecision = 0;
  let distance = 0;
  let lastX = race.bike.x;
  const startX = race.bike.x;

  while (race.state === 'RACING' && race.raceTime < maxSeconds && race.bike.x < track.finishX) {
    sinceDecision += SIM_DT;
    if (profile.airControl && sinceDecision >= profile.reactionDelay) {
      sinceDecision = 0;
      lean = 0;
      if (isAirborne(race.bike)) {
        const bike = race.bike;
        const ahead = Math.max(2, Math.abs(bike.vx) * 0.32);
        const target = Math.atan(track.terrain.surfaceSlope(bike.x + ahead)) + profile.aimBias;
        let delta = target - bike.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta <= -Math.PI) delta += Math.PI * 2;
        const want = delta * 2.2 - bike.angularVelocity * 0.42;
        lean = want > profile.deadzone ? 1 : want < -profile.deadzone ? -1 : 0;
      }
    }
    // El turbo se gasta en cuanto esta listo salvo el descuidado, que ni lo mira.
    const boostPressed = profile.airControl && race.flow.isBoostReady;
    race.step(SIM_DT, { throttle: true, brake: false, lean, restartPressed: false, boostPressed });
    distance += Math.abs(race.bike.x - lastX);
    lastX = race.bike.x;
  }

  return {
    skill,
    state: race.state,
    time: race.raceTime,
    x: race.bike.x,
    landings,
    bestCombo: race.combo.bestLinks,
    score: race.styleScore.score,
    meanSpeed: race.raceTime > 0 ? (race.bike.x - startX) / race.raceTime : 0,
  };
}
