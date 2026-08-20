/**
 * Endless floors (21+).
 *
 * Deliberately conservative: it re-times authored layouts rather than
 * inventing geometry, because a generator that invents geometry eventually
 * invents an impossible floor — and an impossible floor is the fastest way to
 * lose a player's trust. Layout choice and timings are seeded from the floor
 * number, so floor 37 is always the same floor 37.
 */
import { RULES } from '../config.js';
import { clamp } from '../core/math.js';
import { makeRng, seedFrom } from '../core/rng.js';
import { FLOORS, FLOOR_BY_ID } from './definitions.js';

/** Timing fields that make a hazard faster when divided by the difficulty scale. */
const FASTER = ['time', 'onTime', 'offTime', 'idleTime', 'burn', 'holdTime', 'retractTime'];
/** Telegraph fields: shortened far less, and never below the readable floor. */
const TELEGRAPH = { charge: 0.26, telegraph: 0.3, warn: 0.26, stuckTime: 0.85, slamTime: 0.12 };

export const difficultyScale = (n) =>
  clamp(1 + (n - RULES.ENDLESS_START + 1) * 0.014, 1, RULES.ENDLESS_MAX_SCALE);

function retimeEntity(def, scale) {
  const out = { ...def };
  for (const key of FASTER) {
    if (typeof out[key] === 'number') out[key] = out[key] / scale;
  }
  for (const [key, min] of Object.entries(TELEGRAPH)) {
    if (typeof out[key] === 'number') out[key] = Math.max(min, out[key] / Math.sqrt(scale));
  }
  if (out.path) {
    out.path = { ...out.path };
    if (typeof out.path.time === 'number') out.path.time = out.path.time / scale;
    if (out.path.to) out.path.to = { ...out.path.to };
  }
  if (out.slots) out.slots = out.slots.map((s) => ({ ...s }));
  if (typeof out.speed === 'number') out.speed = out.speed * scale;
  return out;
}

const ENDLESS_POOL = FLOORS.filter((f) => !f.boss && f.id !== 'f01').map((f) => f.id);

export function generateFloor(n) {
  const scale = difficultyScale(n);
  const rng = makeRng(seedFrom(n, 0x51f7));

  // Every tenth floor is a boss, so the endless climb keeps its punctuation.
  if (n % 10 === 0) {
    const base = FLOOR_BY_ID.f20;
    const hp = Math.min(6, 4 + Math.floor((n - RULES.ENDLESS_START + 1) / 20));
    return {
      ...base,
      id: `gen${n}`,
      name: `WARDEN ${n}`,
      hint: null,
      generated: true,
      entities: base.entities.map((e) =>
        e.type === 'boss' ? { ...retimeEntity(e, scale), hp, hard: true } : retimeEntity(e, scale)),
    };
  }

  const baseId = ENDLESS_POOL[rng.int(0, ENDLESS_POOL.length - 1)];
  const base = FLOOR_BY_ID[baseId];
  return {
    ...base,
    id: `gen${n}`,
    name: base.name,
    hint: null,
    generated: true,
    scale,
    pits: (base.pits || []).map((p) => ({ ...p })),
    entities: base.entities.map((e) => retimeEntity(e, scale)),
  };
}
