/**
 * Bus de eventos mínimo.
 *
 * Existe para desacoplar sistemas que no deben conocerse: el arma no sabe
 * qué es un enemigo, solo publica `sound`. La IA escucha `sound` y no sabe
 * quién lo produjo. Esa es exactamente la relación que queremos poder
 * reajustar sin reescribir nada.
 */
export class EventBus {
  constructor() { this.handlers = new Map(); }

  on(type, fn) {
    let list = this.handlers.get(type);
    if (!list) this.handlers.set(type, (list = []));
    list.push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const list = this.handlers.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  emit(type, payload) {
    const list = this.handlers.get(type);
    if (!list) return;
    for (let i = 0; i < list.length; i++) list[i](payload);
  }

  clear() { this.handlers.clear(); }
}
