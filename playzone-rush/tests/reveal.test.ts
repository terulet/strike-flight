/**
 * El reel de "los juegos de hoy": que los senuelos que pasan de largo salgan
 * del registro de verdad, no de una lista escrita a mano.
 *
 * Antes la lista vivia copiada en este fichero: ['pulse', 'drift', ...]. Cada
 * juego nuevo necesitaba que alguien se acordara de venir aqui a anadirlo, y
 * el dia que no se acordo (CAZA, CUENTA, TORRE, TRILE, CARGA no estaban)
 * esos cinco simplemente no podian salir como senuelo -no habria hecho saltar
 * ningun test, porque un senuelo de menos no rompe nada, solo empobrece el
 * giro sin que se note-. Con la lista saliendo de listGames(), un juego nuevo
 * entra el mismo dia que se registra.
 */
import { describe, expect, it } from 'vitest';
import { simbolosSenuelo } from '../src/ui/reveal';
import { listGames } from '../src/game/registry';
import { registerAllGames } from '../src/games';

registerAllGames();

describe('simbolosSenuelo', () => {
  it('puede devolver cualquier juego del registro, no solo los de una lista vieja', () => {
    // Se pide una tira tan larga como el catalogo entero menos el ganador:
    // si sale de una lista vieja mas corta, aqui se veria por repeticion.
    const ids = listGames().map((g) => g.meta.id);
    const ganador = ids[0] as string;
    const tira = simbolosSenuelo(ganador, ids.length - 1);
    for (const id of ids) {
      if (id === ganador) continue;
      expect(tira, `falta ${id} entre los senuelos`).toContain(id);
    }
  });

  it('nunca incluye al propio ganador', () => {
    const ids = listGames().map((g) => g.meta.id);
    const ganador = ids[3] as string;
    const tira = simbolosSenuelo(ganador, 30); // de sobra para dar varias vueltas
    expect(tira).not.toContain(ganador);
  });

  it('devuelve exactamente los que se piden', () => {
    const ganador = listGames()[0]!.meta.id;
    expect(simbolosSenuelo(ganador, 8)).toHaveLength(8);
  });
});
