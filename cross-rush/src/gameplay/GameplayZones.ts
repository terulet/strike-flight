/**
 * GameplayZones.ts
 *
 * Traduce las piezas de riesgo/recompensa (pad de velocidad, hueco de
 * riesgo, aro de flow) a coordenadas de mundo concretas, a partir de los
 * mismos labels de sector que ya usa Renderer.drawAtmosphere/drawTrackGates.
 * Una unica fuente de verdad: RaceManager (deteccion/fisica) y Renderer
 * (dibujo) leen de aqui, asi que no se pueden desincronizar entre el sitio
 * donde se ve la pieza y el sitio donde realmente actua.
 *
 * bump_gate y alt_ramp son cambios reales del heightfield (ver
 * TrackBuilder/CanyonRun): su mecanica ya la resuelve la fisica de la moto
 * (compresion de suspension / salto real), no hace falta detectar nada
 * aparte para que "funcionen". Sus coordenadas SI viven aqui para que
 * Renderer (donde se dibuja el obstaculo) y RaceManager (donde se dispara
 * el chispazo visual al cruzarlas) usen exactamente el mismo punto.
 */

import { TrackDefinition } from '../tracks/CanyonRun';

export interface RiskGapZone {
  /** x donde empieza la rampa de despegue de la linea de riesgo. */
  startX: number;
  /** x mas alla de la cual se considera que se ha saltado el hueco entero (no la linea segura corta). */
  endX: number;
}

export interface FlowRingZone {
  x: number;
  y: number;
  /** Tolerancia vertical (metros) para considerar que se ha atravesado el aro, no solo pasado por debajo/encima. */
  radius: number;
}

export interface GameplayZones {
  speedPad: { x: number } | null;
  riskGap: RiskGapZone | null;
  flowRing: FlowRingZone | null;
  altRamp: { x: number } | null;
  bumpGate: { x: number } | null;
}

function findLabelX(track: TrackDefinition, name: string): number | null {
  return track.labels.find((l) => l.name === name)?.x ?? null;
}

export function computeGameplayZones(track: TrackDefinition): GameplayZones {
  const technicalX = findLabelX(track, 'TECHNICAL');
  const uphillX = findLabelX(track, 'UPHILL');
  const riskLineX = findLabelX(track, 'RISK_LINE_JUMP');
  const megaJumpX = findLabelX(track, 'MEGA_JUMP');

  const speedPad = uphillX !== null ? { x: uphillX + 2 } : null;

  // Mismos offsets que el bache/kicker reales insertados en CanyonRun.ts.
  const bumpGate = technicalX !== null ? { x: technicalX + 2 } : null;
  const altRamp = uphillX !== null ? { x: uphillX + 10 } : null;

  // La linea segura (rampa 6m + valle 13m + aterrizaje 5m, ver CanyonRun)
  // toca tierra otra vez a los 24m del borde de salida; saltarla entera
  // (linea de riesgo) significa aterrizar mas alla de ese punto.
  const riskGap: RiskGapZone | null = riskLineX !== null ? { startX: riskLineX, endX: riskLineX + 24 } : null;

  const flowRing: FlowRingZone | null =
    megaJumpX !== null
      ? {
          x: megaJumpX + 20, // hacia la mitad del hueco (rampa de 9m + medio valle de 22m)
          y: track.terrain.surfaceY(megaJumpX + 9) + 4.2, // altura aprox. de la trayectoria en un salto bien dado
          radius: 2.6,
        }
      : null;

  return { speedPad, riskGap, flowRing, altRamp, bumpGate };
}
