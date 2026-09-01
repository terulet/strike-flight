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

  // Saltar el hueco entero significa aterrizar pasado el LABIO LEJANO del
  // valle, que esta a 19 m del inicio del tramo (rampa de 6 m + valle de 13,
  // ver CanyonRun). Detras hay 5 m mas de recepcion llana.
  //
  // El umbral estaba en 24 m, o sea al final de esa recepcion, y eso hacia el
  // premio inalcanzable: con la velocidad punta del juego, la moto sale del
  // labio a 13,7 m/s horizontales y 9,5 verticales, y cayendo los 2,6 m de la
  // rampa eso da 16,6 m de vuelo. Aterrizaba en el 22,6 y el premio pedia
  // pasar del 24. Era, como el mortal, contenido que nadie iba a ver.
  //
  // Con el labio real como umbral el premio SI depende de como se juegue:
  // llegar lanzado cruza el hueco, llegar frenado cae dentro.
  const riskGap: RiskGapZone | null = riskLineX !== null ? { startX: riskLineX, endX: riskLineX + 19 } : null;

  const flowRing: FlowRingZone | null =
    megaJumpX !== null
      ? {
          x: megaJumpX + 20, // hacia la mitad del hueco (rampa de 9m + medio valle de 22m)
          // Altura real de la trayectoria en ese punto, no una estimacion a
          // ojo: saliendo del kicker a ~21 m/s con unos 9 m/s de componente
          // vertical, la moto pasa por aqui unos 2,2 m por encima del labio.
          // Con los 4,2 m que habia antes el aro quedaba por encima de la
          // parabola y no se podia atravesar ni haciendolo todo bien.
          y: track.terrain.surfaceY(megaJumpX + 9) + 2.4,
          radius: 2.6,
        }
      : null;

  return { speedPad, riskGap, flowRing, altRamp, bumpGate };
}
