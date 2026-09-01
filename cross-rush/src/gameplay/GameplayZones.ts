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
 * El bache y el kicker no aparecen aqui. Son cambios reales del heightfield
 * (ver TrackBuilder/CanyonRun) y su mecanica la resuelve la fisica de la moto
 * sola: no hay nada que detectar. Solo tenian coordenadas para poder pegarles
 * encima un sprite decorativo, y esos sprites se fueron por traer su propio
 * terreno dibujado (ver Renderer.drawGameplayFeatures).
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

export interface SpeedPadZone {
  x: number;
}

export interface GameplayZones {
  /**
   * Pads de turbo, en orden de pista. Son varios porque el mega salto NO se
   * puede montar sin uno propio: sin empujon la moto llega al kicker a 21 m/s
   * y salen 1,1 s de aire, que no dan para una vuelta completa; con el pad
   * entra a 27 y pasa de 1,6 s, que es donde el mortal deja de ser un truco
   * de precision milimetrica y se convierte en algo que se puede buscar.
   */
  speedPads: SpeedPadZone[];
  riskGap: RiskGapZone | null;
  flowRing: FlowRingZone | null;
}

function findLabelX(track: TrackDefinition, name: string): number | null {
  return track.labels.find((l) => l.name === name)?.x ?? null;
}

export function computeGameplayZones(track: TrackDefinition): GameplayZones {
  const uphillX = findLabelX(track, 'UPHILL');
  const riskLineX = findLabelX(track, 'RISK_LINE_JUMP');
  const megaJumpX = findLabelX(track, 'MEGA_JUMP');

  const speedPads: SpeedPadZone[] = [];
  if (uphillX !== null) speedPads.push({ x: uphillX + 2 });
  // El segundo pad va justo ANTES del kicker del mega salto (la rampa empieza
  // en la etiqueta), para que el empujon se convierta integro en altura.
  if (megaJumpX !== null) speedPads.push({ x: megaJumpX - 6 });

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

  // Aro del mega salto. Va donde de verdad pasa la moto, y esa trayectoria
  // hay que recalcularla cada vez que cambia el kicker: con la rampa de 11 m
  // y el pad de turbo delante, la moto sale del labio a unos 17,8 m/s
  // horizontales y 14,2 verticales, o sea que corona a 5,2 m por encima del
  // labio y a unos 13 m de el. Con la trayectoria vieja -2,4 m- el aro se
  // quedaba enterrado bajo el vuelo y la moto le pasaba por encima sin
  // rozarlo, que es el mismo fallo que tenia al reves cuando estaba a 4,2.
  const megaLipX = megaJumpX === null ? null : megaJumpX + 11;
  const flowRing: FlowRingZone | null =
    megaJumpX !== null && megaLipX !== null
      ? {
          x: megaLipX + 13,
          y: track.terrain.surfaceY(megaLipX) + 5.2,
          radius: 2.8,
        }
      : null;

  return { speedPads, riskGap, flowRing };
}
