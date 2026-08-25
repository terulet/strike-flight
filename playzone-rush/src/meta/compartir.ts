/**
 * Que se cuenta cuando pasa algo digno de contarse.
 *
 * Aqui no hay DOM, ni canvas, ni navigator: son funciones puras que deciden SI
 * un momento merece compartirse y QUE datos lo describen. El dibujo vive en
 * ui/poster.ts y el envio en ui/compartir.ts. Separado asi porque esto es lo
 * unico que de verdad viaja fuera de la app, y conviene poder probar la
 * decision y el texto sin abrir un navegador.
 *
 * REGLA DE LO QUE SE OFRECE: solo se propone compartir cuando ha pasado algo
 * que a otra persona le cambia el dia. Un "he sacado 340 puntos" no le importa
 * a nadie, y un boton que sale siempre deja de significar algo. Si sale
 * siempre, no significa nada.
 *
 * REGLA DEL CONTENIDO: quien recibe la imagen puede no haber jugado nunca.
 * Tiene que entender en dos segundos quien gano, por cuanto, y que puede
 * responder. Si hace falta explicarlo, el poster ha fallado.
 */

import { formatScore } from './ranking';

export type MomentoTipo =
  | 'robo'      // le has quitado el #1 a alguien
  | 'porPoco'   // has ganado por muy poco
  | 'record'    // nueva mejor marca personal
  | 'racha'     // dias seguidos mandando
  | 'doblo'     // DOBLE O NADA ganado
  | 'cayo'      // DOBLE O NADA perdido
  | 'ghost'     // has superado el fantasma del rival
  | 'secreto';  // el grupo ha abierto el reto secreto

/**
 * Todo lo que necesita saber el dibujante.
 *
 * Es una estructura plana a proposito: el renderer no consulta el estado del
 * juego ni pregunta nada, solo dibuja lo que recibe. Asi se puede pintar un
 * poster de prueba con datos inventados y sale identico al de verdad, que es
 * lo que permite comprobar los casos raros (nombres largos, empates, sin
 * rival) sin tener que provocarlos jugando.
 */
export interface Momento {
  tipo: MomentoTipo;
  /** El titular. Corto y en mayusculas. */
  titulo: string;
  /** El dato dominante del poster. Una sola cosa manda. */
  cifra: string;
  /** Que es esa cifra. */
  cifraPie: string;
  /** Emoji del momento, o null si no lleva. */
  emoji: string | null;
  /** Quien lo ha hecho. */
  jugador: string;
  /**
   * Las dos filas del medio: yo arriba, con quien me comparo debajo.
   *
   * Es generica a proposito. Para un adelantamiento son las dos personas; para
   * una apuesta son el antes y el despues. La misma pieza cuenta las dos
   * historias, asi que todos los posters se reconocen como de la misma familia
   * y ninguno se queda con un hueco vacio en medio.
   */
  comparativa: {
    etiquetaA: string;
    cifraA: string;
    etiquetaB: string;
    cifraB: string;
    /** La diferencia, ya con signo. El numero que escuece. */
    diferencia: string | null;
  } | null;
  /** La frase de abajo: la que provoca respuesta. */
  remate: string;
  /** Donde ha pasado ("RETO 2 · PULSE"). */
  donde: string;
  /** Color dominante, en hexadecimal. Lo pone el juego o el tipo de momento. */
  color: string;
  /** Lo que acompana a la imagen al compartir. */
  texto: string;
  /** Lo que pone el boton en el resultado. */
  boton: string;
}

export interface DatosMomento {
  yo: string;
  reto: string;
  juego: string;
  /** Color del juego, para que el poster sea de ese reto y no generico. */
  color: string;
  puntuacion: number;
  /** A quien se ha adelantado. */
  adelantados: { nombre: string; total: number }[];
  lider: boolean;
  /** Si se ha puesto primero QUITANDOSELO a alguien. */
  robaLiderato: boolean;
  record: boolean;
  /** Cuanto ha mejorado su marca anterior. */
  mejora: number;
  /** Dias seguidos mandando, si la racha es suya. */
  racha: number;
  apuesta?: 'doblo' | 'cayo' | null;
  /** Puntuacion antes de aplicar la apuesta. */
  apuestaAntes?: number | null;
  ghostSuperado?: boolean;
  ghostRival?: string | null;
  /** El grupo acaba de abrir el reto secreto. */
  secretoAbierto?: boolean;
  /** Codigo del grupo, para la puerta de entrada del poster. */
  codigoGrupo?: string | null;
}

/** Cuando una victoria cuenta como "por los pelos". */
export const MARGEN_POR_POCO = 60;

/** "MARC", "MARC Y KALI", "MARC, KALI Y 2 MAS". */
export function unirNombres(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0] as string;
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  if (nombres.length === 3) return `${nombres[0]}, ${nombres[1]} y ${nombres[2]}`;
  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} mas`;
}

/**
 * El momento de esta partida, si lo hay.
 *
 * El orden es el de fuerza social, no el de importancia deportiva: jugarsela y
 * doblar se cuenta antes que un record, porque es lo que mas conversacion
 * genera. Y ganar por 18 puntos se cuenta antes que ganar por 900, porque el
 * margen es la historia.
 */
export function momentoDe(datos: DatosMomento): Momento | null {
  const donde = `${datos.reto} · ${datos.juego}`;
  const yo = datos.yo.toUpperCase();

  // --- DOBLE O NADA. Lo que mas se cuenta, gane o pierda. ---
  if (datos.apuesta === 'doblo') {
    const antes = datos.apuestaAntes ?? Math.round(datos.puntuacion / 2);
    return {
      tipo: 'doblo',
      titulo: 'SE LA JUGÓ',
      cifra: formatScore(datos.puntuacion),
      cifraPie: 'PUNTOS',
      emoji: '🔥',
      jugador: yo,
      comparativa: {
        etiquetaA: 'DESPUÉS', cifraA: formatScore(datos.puntuacion),
        etiquetaB: 'ANTES', cifraB: formatScore(antes),
        diferencia: 'x2',
      },
      remate: 'NO HA SIDO SUERTE.',
      donde,
      color: '#ffd23f',
      texto: `🔥 Me la he jugado en ${donde} y he doblado: ${formatScore(datos.puntuacion)}. ¿Tú te atreves?`,
      boton: 'CONTARLO',
    };
  }
  if (datos.apuesta === 'cayo') {
    const antes = datos.apuestaAntes ?? datos.puntuacion * 2;
    return {
      tipo: 'cayo',
      titulo: 'SE LA JUGÓ',
      cifra: formatScore(datos.puntuacion),
      cifraPie: 'PUNTOS',
      emoji: '💀',
      jugador: yo,
      comparativa: {
        etiquetaA: 'DESPUÉS', cifraA: formatScore(datos.puntuacion),
        etiquetaB: 'ANTES', cifraB: formatScore(antes),
        diferencia: 'x0,5',
      },
      remate: 'DOLIÓ.',
      donde,
      // Coral, no rojo: dentro de DOBLE O NADA todo se cuenta como riesgo que
      // no ha salido, con el mismo color de principio a fin en toda la app
      // (panel, desenlace... y ahora tambien el poster).
      color: '#ff6a3d',
      texto: `💀 Me la he jugado en ${donde} y me he quedado en ${formatScore(datos.puntuacion)}. A ver quién lo hace peor.`,
      boton: 'CONTARLO IGUAL',
    };
  }

  const masCercano = [...datos.adelantados].sort((a, b) => b.total - a.total)[0];
  const margen = masCercano ? datos.puntuacion - masCercano.total : 0;

  // --- Robar el #1. El momento con mas carga social del juego. ---
  if (datos.robaLiderato && masCercano) {
    return {
      tipo: 'robo',
      titulo: 'HA ROBADO EL #1',
      cifra: formatScore(datos.puntuacion),
      cifraPie: 'PUNTOS',
      emoji: '🔥',
      jugador: yo,
      comparativa: {
        etiquetaA: yo, cifraA: formatScore(datos.puntuacion),
        etiquetaB: masCercano.nombre.toUpperCase(), cifraB: formatScore(masCercano.total),
        diferencia: `+${formatScore(margen)}`,
      },
      remate: '¿ME LO QUITAS?',
      donde,
      color: datos.color,
      texto: `🔥 Le he quitado el #1 a ${masCercano.nombre} por ${formatScore(margen)} en ${donde}. ¿Me lo quitas?`,
      boton: 'RESTREGARLO',
    };
  }

  // --- Ganar por los pelos. El margen ES la historia. ---
  if (masCercano && margen > 0 && margen <= MARGEN_POR_POCO) {
    return {
      tipo: 'porPoco',
      titulo: `POR ${formatScore(margen)} PUNTOS.`,
      cifra: formatScore(datos.puntuacion),
      cifraPie: 'PUNTOS',
      emoji: null,
      jugador: yo,
      comparativa: {
        etiquetaA: yo, cifraA: formatScore(datos.puntuacion),
        etiquetaB: masCercano.nombre.toUpperCase(), cifraB: formatScore(masCercano.total),
        diferencia: `+${formatScore(margen)}`,
      },
      remate: 'ESO HA DOLIDO.',
      donde,
      color: datos.color,
      texto: `He pasado a ${masCercano.nombre} por ${formatScore(margen)} puntos en ${donde}. Te toca.`,
      boton: 'RESTREGARLO',
    };
  }

  // --- Racha. Se cuenta sola. ---
  if (datos.racha >= 3) {
    return {
      tipo: 'racha',
      titulo: `${datos.racha} DÍAS MANDANDO`,
      cifra: String(datos.racha),
      cifraPie: datos.racha === 1 ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS',
      emoji: '👑',
      jugador: yo,
      comparativa: null,
      remate: 'HOY MANDO YO.',
      donde: 'PLAYZONE RUSH',
      color: '#ffd23f',
      texto: `👑 Llevo ${datos.racha} días mandando en PLAYZONE RUSH. A ver quién me baja.`,
      boton: 'RESTREGARLO',
    };
  }

  // --- Adelantar a alguien sin robar el liderato. ---
  if (masCercano) {
    return {
      tipo: 'porPoco',
      titulo: 'TE HE PASADO',
      cifra: formatScore(datos.puntuacion),
      cifraPie: 'PUNTOS',
      emoji: null,
      jugador: yo,
      comparativa: {
        etiquetaA: yo, cifraA: formatScore(datos.puntuacion),
        etiquetaB: masCercano.nombre.toUpperCase(), cifraB: formatScore(masCercano.total),
        diferencia: margen > 0 ? `+${formatScore(margen)}` : null,
      },
      remate: 'TE TOCA.',
      donde,
      color: datos.color,
      texto: `He pasado a ${unirNombres(datos.adelantados.map((a) => a.nombre))} en ${donde} con ${formatScore(datos.puntuacion)}. Te toca.`,
      boton: 'RESTREGARLO',
    };
  }

  // --- Fantasma superado. Vale tambien jugando solo. ---
  if (datos.ghostSuperado) {
    return {
      tipo: 'ghost',
      titulo: 'GHOST DESTROZADO',
      cifra: formatScore(datos.puntuacion),
      cifraPie: 'PUNTOS',
      emoji: '👻',
      jugador: yo,
      comparativa: datos.ghostRival
        ? {
            etiquetaA: yo, cifraA: formatScore(datos.puntuacion),
            etiquetaB: `FANTASMA DE ${datos.ghostRival.toUpperCase()}`, cifraB: 'SUPERADO',
            diferencia: null,
          }
        : null,
      remate: 'A VER SI PUEDES.',
      donde,
      color: datos.color,
      texto: `👻 He superado la marca de ${datos.ghostRival ?? 'la máquina'} en ${donde}. A ver si puedes.`,
      boton: 'CONTARLO',
    };
  }

  // --- Reto secreto abierto. Es del grupo entero, no de uno. ---
  if (datos.secretoAbierto) {
    return {
      tipo: 'secreto',
      titulo: 'RETO SECRETO',
      cifra: 'ABIERTO',
      cifraPie: 'EL GRUPO LO HA DESBLOQUEADO',
      emoji: '🔓',
      jugador: yo,
      comparativa: null,
      remate: 'UN INTENTO. A OSCURAS.',
      donde: 'PLAYZONE RUSH',
      color: '#8b5cf6',
      texto: '🔓 Hemos desbloqueado el reto secreto de hoy. Un intento y a oscuras.',
      boton: 'AVISAR AL GRUPO',
    };
  }

  // --- Record personal. Lo mas flojo socialmente, va al final. ---
  if (datos.record) {
    return {
      tipo: 'record',
      titulo: 'NUEVO RÉCORD',
      cifra: formatScore(datos.puntuacion),
      cifraPie: datos.juego.toUpperCase(),
      emoji: null,
      jugador: yo,
      comparativa:
        datos.mejora > 0
          ? {
              etiquetaA: 'HOY', cifraA: formatScore(datos.puntuacion),
              etiquetaB: 'MI MARCA ANTERIOR', cifraB: formatScore(datos.puntuacion - datos.mejora),
              diferencia: `+${formatScore(datos.mejora)}`,
            }
          : null,
      remate: datos.mejora > 0 ? `+${formatScore(datos.mejora)} SOBRE MI MARCA` : 'A VER SI PUEDES.',
      donde,
      color: datos.color,
      texto: `Nuevo récord mío en ${datos.juego}: ${formatScore(datos.puntuacion)}. A ver si puedes.`,
      boton: 'CONTARLO',
    };
  }

  return null;
}

/** La invitacion al grupo. Lo unico que hace crecer el grupo. */
export function textoInvitacion(codigo: string): string {
  return `Entra en mi grupo de PLAYZONE RUSH con el código ${codigo}. Tres retos al día, tres intentos.`;
}
