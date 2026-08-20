/**
 * Tiny synchronous event bus. Doubles as the analytics seam: nothing is sent
 * anywhere yet, but every meaningful moment is emitted through here so a
 * provider can be attached later without touching gameplay code.
 *
 * Emitted today:
 *   game_start, floor_start, floor_complete, death, retry, new_record,
 *   boss_hit, session_end
 */

export class EventBus {
  constructor({ historyLimit = 60 } = {}) {
    this.handlers = new Map();
    this.history = [];
    this.historyLimit = historyLimit;
  }

  on(name, fn) {
    let set = this.handlers.get(name);
    if (!set) this.handlers.set(name, (set = new Set()));
    set.add(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    this.handlers.get(name)?.delete(fn);
  }

  emit(name, payload) {
    const record = { name, payload };
    this.history.push(record);
    if (this.history.length > this.historyLimit) this.history.shift();
    this.handlers.get(name)?.forEach((fn) => fn(payload, name));
    this.handlers.get('*')?.forEach((fn) => fn(payload, name));
  }

  clearHistory() {
    this.history.length = 0;
  }
}
