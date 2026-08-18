/**
 * Owns "which floor is next and what does it look like".
 *
 * Every floor is authored left-to-right; odd floors play as authored and even
 * floors play mirrored, so the player exits on one side and enters the next
 * room on the same side. That is what makes the tower read as one continuous
 * shaft instead of a series of disconnected screens.
 */
import { makeRng, seedFrom } from '../core/rng.js';
import { FLOORS, AUTHORED_COUNT } from './definitions.js';
import { generateFloor } from './generator.js';
import { Room } from './floorRuntime.js';

export class FloorManager {
  constructor() {
    this.cache = new Map();
  }

  static isMirrored(n) {
    return n % 2 === 0;
  }

  definitionFor(n) {
    if (n <= AUTHORED_COUNT) return FLOORS[n - 1];
    let def = this.cache.get(n);
    if (!def) {
      def = generateFloor(n);
      this.cache.set(n, def);
      // Bound the cache: a very long run should not grow memory forever.
      if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value);
    }
    return def;
  }

  build(n) {
    const def = this.definitionFor(n);
    return new Room(def, n, {
      mirrored: FloorManager.isMirrored(n),
      rng: makeRng(seedFrom(n, 0xd0075)),
    });
  }

  nameFor(n) {
    return this.definitionFor(n).name || `FLOOR ${n}`;
  }
}

export { AUTHORED_COUNT };
