/**
 * Base class for everything that lives inside a floor.
 *
 * Contract:
 *   solids  — AABBs the player can stand on / bump into (world coords).
 *             Moving solids must keep `dx`/`dy` up to date so riders are carried.
 *   hazards — lethal shapes; `active` toggles them without touching the array.
 *   The entity owns these objects for its whole life: no per-frame allocation.
 */

let nextId = 1;
export const newId = (prefix = 'e') => `${prefix}${nextId++}`;

/** Test seam so ids are reproducible across runs. */
export const _resetIds = () => { nextId = 1; };

export class Entity {
  constructor(def, ctx) {
    this.type = def.type;
    this.def = def;
    this.id = newId(def.type);
    this.originY = ctx.originY;
    this.solids = [];
    this.hazards = [];
    this.dead = false;
    /** Higher draws later (in front). Player sits at 50. */
    this.layer = def.layer ?? 40;
  }

  /** Local room Y -> world Y. */
  wy(localY) {
    return localY + this.originY;
  }

  reset() {}
  update(_dt, _ctx) {}
  draw(_gfx, _ctx) {}
  /** Called when the player's forgiving hitbox overlaps one of our hazards. */
  onPlayerHit(_shape, _ctx) {}
}

export const box = (x, y, w, h, cause, extra = {}) => ({
  kind: 'box', x, y, w, h, cause, active: true, ...extra,
});

export const circle = (x, y, r, cause, extra = {}) => ({
  kind: 'circle', x, y, r, cause, active: true, ...extra,
});

export const solid = (x, y, w, h, extra = {}) => ({
  x, y, w, h, dx: 0, dy: 0, id: newId('s'), oneWay: false, ...extra,
});
