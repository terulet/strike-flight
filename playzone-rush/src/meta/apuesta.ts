/**
 * DOBLE O NADA: la ficha de riesgo del dia.
 *
 * Una por jugador y dia. Se puede gastar al terminar cualquiera de los tres
 * retos, y afecta SOLO a la puntuacion de ese reto: si sale, x2; si no, x0,5.
 * Se consume gane o pierda.
 *
 * UNA SOLA AL DIA, y esto no es una limitacion tecnica sino la decision que
 * hace que el sistema funcione: con tres apuestas el ranking premiaria la
 * varianza por encima de jugar bien, y ganaria quien mas veces tire el dado.
 * Con una sola, elegir EN QUE RETO gastarla es la jugada.
 *
 * EL MICRODESAFIO NO ES UNA RULETA. Un indicador barre a velocidad constante
 * y hay que pararlo dentro de una zona que se ve entera desde el primer
 * instante. No hay nada oculto ni aleatorio en el momento de decidir: si
 * fallas, fallaste tu. Esa diferencia lo es todo — perder por una ruleta
 * cabrea y se abandona; perder por pulso propio da ganas de volver manana.
 */

/** Cuanto dura el microdesafio antes de darse por fallado. */
export const APUESTA_MS = 5000;

/** Tension final audiovisual, compartida por logica, UI y pruebas. */
export const APUESTA_TENSION_CUES = [
  { ms: 1500, intensity: 0, haptic: 'tick' },
  { ms: 1000, intensity: 0.5, haptic: 'light' },
  { ms: 500, intensity: 1, haptic: 'medium' },
] as const;

/** Multiplicadores. Ganar dobla; perder deja la mitad. */
export const FACTOR_GANA = 2;
export const FACTOR_PIERDE = 0.5;

export interface ApuestaEstado {
  /** 0..1, posicion del indicador que barre. */
  posicion: number;
  /** 0..1, donde empieza la zona buena. */
  zonaInicio: number;
  /** Ancho de la zona buena, en fraccion del recorrido. */
  zonaAncho: number;
  /** Barridos completos por segundo. */
  velocidad: number;
}

/**
 * Prepara el microdesafio.
 *
 * La zona SIEMPRE cae en la mitad central del recorrido: pegada a un extremo
 * seria casi imposible de clavar por como frena el ojo, y eso ya empezaria a
 * parecerse a la mala suerte.
 */
export function nuevaApuesta(aleatorio: () => number): ApuestaEstado {
  // Ancho y velocidad estan calibrados juntos para que el indicador tarde unos
  // 200 ms en cruzar la zona. Con los primeros numeros que puse eran 117 ms, y
  // eso ya no es pulso: a esa velocidad se acierta o se falla por casualidad,
  // que es justo lo que este sistema no puede permitirse. 200 ms se puede
  // clavar estando atento y se falla estando nervioso, que es lo que buscamos.
  const zonaAncho = 0.24;
  const zonaInicio = 0.26 + aleatorio() * (0.74 - 0.26 - zonaAncho);
  return {
    posicion: 0,
    zonaInicio,
    zonaAncho,
    // Constante y visible: se puede aprender de un dia para otro.
    velocidad: 0.55,
  };
}

/**
 * Avanza el indicador. Va y vuelve (rebota en los extremos) en vez de
 * reaparecer por el otro lado: asi siempre se ve venir y da varias
 * oportunidades dentro de los cinco segundos.
 */
export function avanzarApuesta(estado: ApuestaEstado, dt: number): ApuestaEstado {
  const recorrido = estado.velocidad * dt * 2;
  let posicion = estado.posicion + recorrido;
  // Rebote en un espacio 0..2 que luego se pliega a 0..1.
  posicion %= 2;
  return { ...estado, posicion };
}

/** Posicion visible 0..1 (el rebote plegado). */
export function posicionVisible(estado: ApuestaEstado): number {
  return estado.posicion <= 1 ? estado.posicion : 2 - estado.posicion;
}

/** Si en este instante el indicador esta dentro de la zona buena. */
export function dentroDeZona(estado: ApuestaEstado): boolean {
  const p = posicionVisible(estado);
  return p >= estado.zonaInicio && p <= estado.zonaInicio + estado.zonaAncho;
}

export interface ResultadoApuesta {
  gana: boolean;
  /** Puntuacion del reto ya con el multiplicador aplicado. */
  puntuacionFinal: number;
  /** Diferencia respecto a lo que habria guardado sin apostar. */
  diferencia: number;
}

/** Aplica el resultado a la puntuacion de ESE reto y de ningun otro. */
export function resolverApuesta(puntuacion: number, gana: boolean): ResultadoApuesta {
  const factor = gana ? FACTOR_GANA : FACTOR_PIERDE;
  const puntuacionFinal = Math.round(puntuacion * factor);
  return { gana, puntuacionFinal, diferencia: puntuacionFinal - puntuacion };
}
