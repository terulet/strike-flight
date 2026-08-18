/**
 * Registro de minijuegos. El shell solo conoce ids; los juegos se registran a
 * si mismos. Anadir un juego externo (por ejemplo un PLAYZONE 00X adaptado) es
 * llamar a registerGame() con su definicion.
 */
import type { GameDefinition } from './contract';

const registry = new Map<string, GameDefinition>();

export function registerGame(definition: GameDefinition): void {
  if (registry.has(definition.meta.id)) {
    console.warn(`[registry] el juego "${definition.meta.id}" ya estaba registrado; se sustituye`);
  }
  registry.set(definition.meta.id, definition);
}

export function getGame(id: string): GameDefinition | null {
  return registry.get(id) ?? null;
}

export function requireGame(id: string): GameDefinition {
  const def = registry.get(id);
  if (!def) throw new Error(`[registry] juego desconocido: "${id}"`);
  return def;
}

export function listGames(): GameDefinition[] {
  return Array.from(registry.values());
}

export function gameIds(): string[] {
  return Array.from(registry.keys());
}

export function clearRegistry(): void {
  registry.clear();
}
