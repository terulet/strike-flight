/**
 * Pool de objetos con array denso.
 *
 * Nada de `new` en el bucle de juego: proyectiles, partículas y luces se
 * reciclan. En un iPhone la diferencia no es la CPU, es el recolector de
 * basura provocando tirones justo al disparar.
 */
export class Pool {
  /**
   * @param {() => object} factory  crea una instancia vacía
   * @param {number} capacity       techo duro de elementos vivos
   */
  constructor(factory, capacity) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory();
    this.active = 0; // los [0, active) están vivos
  }

  /** Coge un elemento libre, o null si el pool está lleno. */
  obtain() {
    if (this.active >= this.capacity) return null;
    return this.items[this.active++];
  }

  /**
   * Libera el elemento del índice i intercambiándolo con el último vivo.
   * Al recorrer el pool hacia atrás, el índice actual sigue siendo válido.
   */
  release(i) {
    this.active--;
    const tmp = this.items[i];
    this.items[i] = this.items[this.active];
    this.items[this.active] = tmp;
  }

  clear() { this.active = 0; }

  /** Recorrido seguro de vivos (hacia atrás, admite liberar dentro). */
  forEach(fn) {
    for (let i = this.active - 1; i >= 0; i--) fn(this.items[i], i);
  }
}
