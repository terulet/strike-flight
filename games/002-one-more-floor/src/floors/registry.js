/**
 * Entity registry. Floors are data; every element in a floor definition is
 * looked up here by `type`. Adding FloorLaser/FloorSaw/FloorWhatever later is
 * a new module that calls registerEntity() — never a switch statement to edit.
 */

const registry = new Map();

export function registerEntity(type, factory, meta = {}) {
  if (registry.has(type)) throw new Error(`Entity type already registered: ${type}`);
  registry.set(type, { factory, meta });
}

export function hasEntity(type) {
  return registry.has(type);
}

export function entityTypes() {
  return [...registry.keys()].sort();
}

export function entityMeta(type) {
  return registry.get(type)?.meta ?? null;
}

export function createEntity(def, ctx) {
  const entry = registry.get(def.type);
  if (!entry) throw new Error(`Unknown entity type: "${def.type}"`);
  return entry.factory(def, ctx);
}

/** Test seam. */
export function _clearRegistry() {
  registry.clear();
}
