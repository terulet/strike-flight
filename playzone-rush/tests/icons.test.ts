/**
 * Los iconos son de las cosas que las pruebas nunca miran y que se ven en la
 * primera pantalla. Aqui se guardan las dos cosas que si se pueden comprobar
 * sin abrir un navegador: que todos los juegos tienen marca dibujada, y que
 * las marcas se pintan con el color de quien las contiene.
 */
import { describe, expect, it } from 'vitest';
import { hayMarca, trazoDeIcono, trazoDeMarca, type MarcaName } from '../src/ui/icons';
import { listGames } from '../src/game/registry';
import { registerAllGames } from '../src/games';

// Sin esto el registro esta vacio y la primera prueba compara [] con [], que
// pasa siempre y no vigila nada.
registerAllGames();

const MARCAS_SUELTAS: MarcaName[] = ['secreto', 'llave', 'chaos'];

describe('marcas de juego', () => {
  it('todos los juegos del registro tienen marca propia', () => {
    // Si esta prueba falla es que se ha anadido un juego y se ha olvidado su
    // simbolo: la tarjeta caeria al glifo de respaldo y desentonaria con el
    // resto de la fila.
    const sinMarca = listGames()
      .map((game) => game.meta.id)
      .filter((id) => !hayMarca(id));
    expect(sinMarca).toEqual([]);
  });

  it('las marcas heredan el color en vez de traerlo puesto', () => {
    // `.card__icon` pinta con el acento del juego. Si una marca trae un color
    // fijo, ese juego se saldria de su propia paleta.
    const ids = [...listGames().map((g) => g.meta.id as MarcaName), ...MARCAS_SUELTAS];
    for (const id of ids) {
      const trazo = trazoDeMarca(id);
      expect(trazo, id).toContain('currentColor');
      expect(trazo, id).not.toMatch(/(fill|stroke)="#/);
    }
  });

  it('los iconos de control son dibujo, no caracteres', () => {
    // El altavoz y la pausa eran emoji y cada sistema los pintaba a su manera.
    // Vectoriales no: son iguales en todas partes.
    for (const nombre of ['sonido', 'silencio', 'pausa'] as const) {
      const trazo = trazoDeIcono(nombre);
      expect(trazo, nombre).toContain('<path');
      expect(trazo, nombre).toContain('currentColor');
      // Sin texto dentro: si hubiera un <text> volveriamos a depender de la
      // fuente del sistema, que es justo lo que se queria quitar.
      expect(trazo, nombre).not.toContain('<text');
    }
  });
});
