/**
 * Challenge — a fully deterministic setup. Given the same id, every device on the
 * planet builds byte-identical physics, which is what makes comparing scores fair
 * and what will let a server re-simulate a submitted shot later (see docs/ANTICHEAT.md).
 */
import { GameConfig } from '../config/GameConfig.js';
import { getSurface, SURFACES } from '../config/surfaces.js';
import { getObject, OBJECTS } from '../config/objects.js';
import { pickMutator, getMutator } from '../config/mutators.js';
import { rngFromString, range } from '../core/rng.js';
import { buildPowerTable, designTravel, designMargin, sensitivityMmPerMs, windowWidth, speedForPower } from '../physics/calibration.js';
import { deriveSetup } from '../physics/Simulation.js';
import { utcDayKey } from '../ui/format.js';

/** World coordinate of the edge. Everything else is placed relative to it. */
const EDGE_X = 1.2;
/** Visible runway behind the object at launch (m). */
const RUNWAY = 0.05;

/**
 * @param {string} id     stable identifier; also the seed
 * @param {object} force  optional overrides {objectId, surfaceId, mutatorId, pe}
 */
export function createChallenge(id, force = {}) {
  const rng = rngFromString(id);

  const surfacePool = SURFACES;
  const objectPool = force.objectPool || OBJECTS;

  const surface = getSurface(force.surfaceId || surfacePool[Math.floor(rng() * surfacePool.length)].id);
  const object = getObject(force.objectId || objectPool[Math.floor(rng() * objectPool.length)].id);
  const mutator = force.mutatorId ? getMutator(force.mutatorId) : pickMutator(rng);

  const pe = force.pe ?? range(rng, GameConfig.window.edgePowerMin, GameConfig.window.edgePowerMax);

  // Distance the balance point must cover to arrive exactly on the brink.
  const travelToEdge = designTravel(pe, surface);
  const comStart = EDGE_X - travelToEdge;

  let setup = {
    surface,
    object,
    startX: comStart - object.comOffset,
    edgeX: EDGE_X,
    slope: 0,
    wind: 0,
  };
  setup = mutator.apply(setup, rng);

  // A mutator can change the physics, so the calibration runs AFTER it: the design
  // curve is always realised, whatever the mutator did.
  const { table, derived } = buildPowerTable(setup);

  const platform = {
    startX: setup.startX - object.width / 2 - RUNWAY,
    edgeX: EDGE_X,
    thickness: setup.narrow ? 0.028 : 0.052,
    narrow: !!setup.narrow,
  };

  return {
    id,
    seed: id,
    objectId: object.id,
    surfaceId: surface.id,
    mutatorId: mutator.id,
    mutatorName: mutator.name,
    pe,
    setup,
    derived,
    table,
    platform,
    travelToEdge,
    surface,
    object,
    /** Metadata for debug / balance tooling. */
    meta: {
      sensitivityMmPerMs: sensitivityMmPerMs(pe, surface),
      windowMm: windowWidth(surface) * 1000,
      marginAtZeroMm: designMargin(0, pe, surface) * 1000,
      overshootAtFullMm: -designMargin(1, pe, surface) * 1000,
    },
  };
}

/** Exact launch speed for a power value on this challenge. */
export function launchSpeedFor(challenge, power) {
  return speedForPower(challenge.setup, power, challenge.table, challenge.derived);
}

/** Design margin (m) a given power would produce — used by ghosts and the harness. */
export function marginForPower(challenge, power) {
  return designMargin(power, challenge.pe, challenge.surface);
}

/** Inverse: the power that would produce a given margin. Used to fake rival inputs. */
export function powerForMargin(challenge, marginM) {
  const g = GameConfig.window.gamma;
  const W = windowWidth(challenge.surface);
  const base = Math.pow(1 - challenge.pe, g) + marginM / W;
  if (base <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - Math.pow(base, 1 / g)));
}

/** The daily challenge id for a date (UTC, explicitly). */
export function dailyId(date = new Date()) {
  return `daily-${utcDayKey(date)}`;
}

export function createDailyChallenge(date = new Date()) {
  return createChallenge(dailyId(date));
}

/** Practice challenges rotate through a stable, numbered pool. */
export function practiceId(index) {
  return `practice-${((index % 1000) + 1000) % 1000}`;
}

export function createPracticeChallenge(index, force) {
  return createChallenge(practiceId(index), force);
}

export { deriveSetup, EDGE_X };
