/**
 * Capa de almacenamiento tolerante a fallos.
 *
 * localStorage puede no existir (WKWebView en modo privado, iframes con
 * cookies bloqueadas, file:// en algunos navegadores). En vez de reventar,
 * caemos a memoria y el juego sigue funcionando durante la sesion.
 */

export interface KeyValueStore {
  readonly kind: 'local' | 'memory';
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

class MemoryStore implements KeyValueStore {
  readonly kind = 'memory' as const;
  private map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): boolean {
    this.map.set(key, value);
    return true;
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

class LocalStore implements KeyValueStore {
  readonly kind = 'local' as const;
  constructor(private backing: Storage) {}
  get(key: string): string | null {
    try {
      return this.backing.getItem(key);
    } catch {
      return null;
    }
  }
  set(key: string, value: string): boolean {
    try {
      this.backing.setItem(key, value);
      return true;
    } catch {
      // Cuota llena o escritura denegada: no es motivo para tirar la partida.
      return false;
    }
  }
  remove(key: string): void {
    try {
      this.backing.removeItem(key);
    } catch {
      /* nada que hacer */
    }
  }
}

function probe(storage: Storage): boolean {
  const probeKey = '__pz_probe__';
  try {
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function createStore(): KeyValueStore {
  try {
    const ls = globalThis.localStorage;
    if (ls && probe(ls)) return new LocalStore(ls);
  } catch {
    /* sin acceso: memoria */
  }
  return new MemoryStore();
}

export function createMemoryStore(): KeyValueStore {
  return new MemoryStore();
}
