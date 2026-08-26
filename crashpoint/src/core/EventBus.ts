export type Unsubscribe = () => void;

/** Minimal typed pub/sub used to decouple systems (physics, damage, chain, score, camera, audio, UI). */
export class EventBus<Events extends object> {
  private listeners = new Map<keyof Events, Set<(payload: any) => void>>();

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): Unsubscribe {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as any);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): void {
    this.listeners.get(event)?.delete(handler as any);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Copy in case a handler subscribes/unsubscribes during emit.
    for (const handler of Array.from(set)) handler(payload);
  }

  /** Removes every listener. Used on level reset to guarantee no leaks between runs. */
  clear(): void {
    this.listeners.clear();
  }
}
