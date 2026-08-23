/**
 * Que se cuenta cuando pasa algo digno de contarse.
 *
 * Aqui no hay DOM ni navigator: son funciones puras que deciden SI un momento
 * merece compartirse y COMO se cuenta. Separado asi porque el texto es lo unico
 * que de verdad viaja fuera de la app -al chat del grupo, a donde sea- y
 * conviene poder probarlo sin abrir un navegador.
 *
 * Regla de lo que se ofrece: solo se propone compartir cuando ha pasado algo
 * que a otra persona le cambia el dia. Ponerse primero, robarle el puesto a
 * alguien, un record, o jugarsela y doblar. Un "he sacado 340 puntos" no le
 * importa a nadie, y ofrecer compartir cada partida convierte el boton en
 * ruido: si sale siempre, no significa nada.
 */

import { formatScore } from './ranking';

export type MomentoTipo = 'lider' | 'adelanta' | 'record' | 'doblo' | 'cayo';

export interface Momento {
  tipo: MomentoTipo;
  /** Lo que se copia o se manda al menu de compartir. */
  texto: string;
  /** Lo que pone el boton. */
  boton: string;
}

export interface DatosMomento {
  /** Nombre del jugador. */
  yo: string;
  reto: string;
  juego: string;
  puntuacion: number;
  /** A quien se ha adelantado, si a alguien. */
  adelantados: string[];
  /** Si se ha puesto primero del dia. */
  lider: boolean;
  /** Si es su mejor marca personal en ese juego. */
  record: boolean;
  /** Como acabo la apuesta, si la gasto aqui. */
  apuesta?: 'doblo' | 'cayo' | null;
}

// Se reutiliza el formateador de la app y no toLocaleString: la app lo escribe
// a mano justamente porque toLocaleString depende de los datos de idioma que
// traiga el entorno, y donde vengan recortados devuelve "2750" en vez de
// "2.750". El texto que sale de aqui tiene que decir el mismo numero que se ve
// en pantalla.

/** "MARC", "MARC Y KALI", "MARC, KALI Y 2 MAS". */
export function unirNombres(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0] as string;
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  if (nombres.length === 3) return `${nombres[0]}, ${nombres[1]} y ${nombres[2]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} mas`;
}

/**
 * El momento compartible de esta partida, si lo hay.
 *
 * El orden importa: se devuelve el mas fuerte. Ponerse primero gana a adelantar
 * a uno, y jugarsela gana a todo porque es lo que mas se cuenta.
 */
export function momentoDe(datos: DatosMomento): Momento | null {
  const donde = `${datos.reto} · ${datos.juego}`;

  if (datos.apuesta === 'doblo') {
    return {
      tipo: 'doblo',
      boton: 'CONTARLO',
      texto: `🔥 Me la he jugado en ${donde} y he doblado: ${formatScore(datos.puntuacion)}. PLAYZONE RUSH.`,
    };
  }
  // Caer tambien se cuenta. Perder la apuesta y contarlo es de las cosas que
  // mas conversacion generan en un grupo, y esconderlo seria perder eso.
  if (datos.apuesta === 'cayo') {
    return {
      tipo: 'cayo',
      boton: 'CONTARLO IGUAL',
      texto: `💀 Me la he jugado en ${donde} y me he quedado en ${formatScore(datos.puntuacion)}. A ver quien lo hace peor.`,
    };
  }
  if (datos.lider) {
    return {
      tipo: 'lider',
      boton: 'RESTREGARLO',
      texto: `👑 Voy primero del dia en PLAYZONE RUSH con ${formatScore(datos.puntuacion)} en ${donde}. A ver quien me pasa.`,
    };
  }
  if (datos.adelantados.length > 0) {
    return {
      tipo: 'adelanta',
      boton: 'RESTREGARLO',
      texto: `He pasado a ${unirNombres(datos.adelantados)} en ${donde} con ${formatScore(datos.puntuacion)}. PLAYZONE RUSH.`,
    };
  }
  if (datos.record) {
    return {
      tipo: 'record',
      boton: 'CONTARLO',
      texto: `Mi mejor marca en ${datos.juego}: ${formatScore(datos.puntuacion)}. A ver si alguien la baja.`,
    };
  }
  return null;
}

/** La invitacion al grupo. Lo unico que hace crecer el grupo. */
export function textoInvitacion(codigo: string): string {
  return `Entra en mi grupo de PLAYZONE RUSH con el codigo ${codigo}. Tres retos al dia, tres intentos.`;
}
