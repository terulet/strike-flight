/**
 * La pista se ve como una franja con profundidad: el borde de delante es la
 * linea fisica del terreno y la superficie se ve hasta TRACK_BAND metros por
 * encima (el borde del fondo). El jugador va por el carril 0 (delante); los
 * rivales por carriles mas al fondo, algo mas pequeños y velados.
 */
export const TRACK_BAND = 0.55;

export function laneOffset(lane: number): number {
  return lane * 0.13;
}

export function laneScale(lane: number): number {
  return 1 - lane * 0.045;
}

export function laneFog(lane: number): number {
  return lane * 0.1;
}
