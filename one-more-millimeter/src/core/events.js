/** Minimal event bus. No allocations per emit beyond the listener array walk. */
export class EventBus {
  constructor() { this._map = new Map(); }
  on(type, fn) {
    let l = this._map.get(type);
    if (!l) { l = []; this._map.set(type, l); }
    l.push(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) {
    const l = this._map.get(type);
    if (!l) return;
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  }
  emit(type, payload) {
    const l = this._map.get(type);
    if (l) for (let i = 0; i < l.length; i++) l[i](payload, type);
    const any = this._map.get('*');
    if (any) for (let i = 0; i < any.length; i++) any[i](payload, type);
  }
  clear() { this._map.clear(); }
}
