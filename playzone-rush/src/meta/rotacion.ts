/**
 * QUE JUEGOS TOCAN HOY.
 *
 * El problema que resuelve: antes el dia se montaba barajando el catalogo
 * entero de cero, cada dia, sin memoria. Con 7 juegos eso daba un 87% de dias
 * repitiendo alguno del dia anterior, dias enteros identicos al anterior, y un
 * juego podia desaparecer 13 dias seguidos. La gente lo noto antes que
 * nosotros: "los juegos son siempre los mismos".
 *
 * Barajar mas fuerte no lo arregla, porque el azar sin memoria REPITE: es su
 * naturaleza. Lo que lo arregla es repartir.
 *
 * COMO FUNCIONA: una bolsa, como en el Tetris. Se baraja el catalogo entero y
 * se van sacando 3 por dia hasta vaciarla; solo entonces se baraja otra. Asi
 * cada juego sale exactamente una vez por vuelta, y la espera entre dos
 * apariciones esta acotada en vez de depender de la suerte.
 *
 * LA COSTURA. Si la bolsa nueva empieza por un juego con el que acababa la
 * anterior, se repite igual en la juntura. Por eso la bolsa nueva se repara
 * contra la cola de la vieja antes de usarla.
 *
 * SIGUE SIENDO PURA. juegosDelDia(k) no depende de nada guardado ni de cuando
 * se llame: mismo dia, mismo reparto, en el movil, en el servidor y dentro de
 * un test. Calcular un dia cuesta como mucho barajar dos veces.
 */
import { Rng, seedFrom } from '../core/rng';

/** Retos diarios. Cambiarlo cambia el tamano de la vuelta. */
export const POR_DIA = 3;

/**
 * Cuantos sitios de cabeza se limpian y contra cuanta cola.
 *
 * El dia que cae encima de la juntura coge el final de una bolsa y el
 * principio de la siguiente, y el dia de despues coge tres mas de esa
 * siguiente. Con 6 y 3 quedan cubiertos los dos, para cualquier resto de
 * catalogo entre bolsas.
 */
const CABEZA = POR_DIA * 2;
const COLA = POR_DIA;

/** Dia 0 = 1970-01-01. Solo importa que sea el mismo siempre. */
export function indiceDeDia(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`[rotacion] clave de dia invalida: ${dayKey}`);
  }
  return Math.floor(Date.UTC(y as number, (m as number) - 1, d as number) / 86_400_000);
}

/**
 * Una bolsa: el catalogo entero, barajado, y reparado para que no empiece por
 * donde acababa la anterior.
 *
 * La reparacion no vuelve a barajar -eso desharia el reparto- sino que cambia
 * de sitio a los que chocan, empujandolos mas alla de la cabeza. Es un
 * intercambio, asi que sigue siendo una permutacion: cada juego, una vez.
 *
 * DOS DETALLES QUE PARECEN MANIAS Y NO LO SON:
 *
 * 1. La referencia es la baraja CRUDA de la vuelta anterior, no la reparada.
 *    Si no, para saber la vuelta 900 habria que calcular las 899 de antes.
 * 2. Por eso mismo el intercambio no toca nunca la cola: si la reparacion de
 *    una bolsa pudiera cambiar su propio final, la siguiente estaria mirando
 *    una referencia que ya no existe y la juntura volveria a repetir.
 *
 * Con esas dos reglas el reparto queda garantizado a partir de 12 juegos
 * (CABEZA + 2*COLA + POR_DIA). Por debajo se hace lo que se puede: el catalogo
 * es demasiado corto para que 3 al dia no se pisen, y eso no lo arregla ningun
 * algoritmo.
 */
function bolsa(ids: string[], vuelta: number): string[] {
  const b = new Rng(seedFrom('bolsa', vuelta)).shuffle(ids);
  const n = b.length;
  if (vuelta <= 0 || n <= POR_DIA) return b;

  const anterior = new Rng(seedFrom('bolsa', vuelta - 1)).shuffle(ids);
  const cola = new Set(anterior.slice(-COLA));
  const cabeza = Math.min(CABEZA, n);
  const finDeCanje = n - COLA; // de aqui en adelante no se toca

  for (let i = 0; i < cabeza; i++) {
    if (!cola.has(b[i] as string)) continue;
    let j = -1;
    for (let k = cabeza; k < finDeCanje; k++) {
      if (!cola.has(b[k] as string)) { j = k; break; }
    }
    if (j < 0) break; // catalogo corto: mejor un choque que romper la bolsa
    [b[i], b[j]] = [b[j] as string, b[i] as string];
  }
  return b;
}

/**
 * Los ids de los juegos de un dia, en orden.
 *
 * Se lee del flujo continuo de bolsas: el dia N ocupa los sitios
 * [N*3, N*3+3), crucen o no de bolsa.
 */
export function juegosDelDia(dayKey: string, ids: string[]): string[] {
  if (ids.length === 0) throw new Error('[rotacion] catalogo vacio');
  if (ids.length <= POR_DIA) {
    // Con 3 juegos o menos no hay reparto posible: salen todos, siempre.
    return Array.from({ length: POR_DIA }, (_, i) => ids[i % ids.length] as string);
  }

  const n = ids.length;
  const desde = indiceDeDia(dayKey) * POR_DIA;
  const vuelta = Math.floor(desde / n);
  const dentro = desde - vuelta * n;

  const actual = bolsa(ids, vuelta);
  const siguiente = bolsa(ids, vuelta + 1);

  const salida: string[] = [];
  for (let i = 0; i < POR_DIA; i++) {
    const p = dentro + i;
    salida.push((p < n ? actual[p] : siguiente[p - n]) as string);
  }
  return salida;
}
