/**
 * Calibration — the bridge between "what the player does" and "what the physics does".
 *
 * The design curve below describes where a shot SHOULD come to rest as a function of
 * power. We then ask the real simulation, by binary search, which launch speed
 * produces exactly that resting place. The physics stays untouched and honest; only
 * the input mapping is solved for. Consequences:
 *
 *   - every surface/object/mutator combination is automatically playable,
 *   - the difficulty curve is identical everywhere, so surfaces express themselves
 *     through HOW the object travels (creep, duration, sound) instead of through
 *     accidental balance,
 *   - a challenge is defined by pe (the power that lands exactly on the brink),
 *     which is expressed physically as the visible launch distance.
 *
 * margin(p) = W * ((1-p)^gamma - (1-pe)^gamma)
 *   p  = 0 -> a comfortably short, safe shot
 *   p  = pe -> exactly on the brink (0 mm, tips)
 *   p  > pe -> over the edge
 */
import { GameConfig } from '../config/GameConfig.js';
import { PhysicsConfig as P } from '../config/PhysicsConfig.js';
import { simulateShot, deriveSetup } from './Simulation.js';

/** Window width for a surface (m). */
export function windowWidth(surface) {
  return GameConfig.window.width * (surface.windowScale ?? 1);
}

/** Where the design curve says the balance point should stop, relative to launch. */
export function designTravel(p, surface) {
  const g = GameConfig.window.gamma;
  const W = windowWidth(surface);
  const q = 1 - Math.min(Math.max(p, 0), 1);
  return surface.travelBase + W * (1 - Math.pow(q, g));
}

/** Design margin (m) for a power p on a challenge whose brink power is pe. */
export function designMargin(p, pe, surface) {
  return designTravel(pe, surface) - designTravel(p, surface);
}

/**
 * Sensitivity in mm of result per millisecond of hold time, at the brink.
 * This is the number that decides whether the game is hard or unfair.
 */
export function sensitivityMmPerMs(pe, surface) {
  const g = GameConfig.window.gamma;
  const W = windowWidth(surface);
  const dMargin_dp = W * g * Math.pow(1 - pe, g - 1); // m per unit power
  return (dMargin_dp * 1000) / GameConfig.power.chargeMs;
}

/**
 * Solves the launch speed that makes the simulation travel exactly `targetTravel`.
 * Monotonic in v0, so a plain bisection is both exact and predictable.
 */
export function solveLaunchSpeed(setup, targetTravel, opts = {}) {
  const derived = opts.derived || deriveSetup(setup);
  const tol = opts.tolerance ?? P.solveTolerance;
  let lo = 0;
  let hi = opts.hint ? Math.min(opts.hint * 1.6 + 0.4, P.maxLaunchSpeed) : P.maxLaunchSpeed;

  // Make sure hi actually overshoots the target before bisecting.
  let guard = 0;
  while (travelFor(setup, hi, derived) < targetTravel && hi < P.maxLaunchSpeed && guard++ < 12) {
    hi = Math.min(hi * 1.7, P.maxLaunchSpeed);
  }

  let mid = hi;
  for (let i = 0; i < P.solveMaxIterations; i++) {
    mid = (lo + hi) * 0.5;
    const travel = travelFor(setup, mid, derived);
    const err = travel - targetTravel;
    if (Math.abs(err) <= tol) break;
    if (err < 0) lo = mid;
    else hi = mid;
  }
  return mid;
}

function travelFor(setup, v0, derived) {
  return simulateShot(setup, v0, { derived, ignoreEdge: true }).travelM;
}

/**
 * Builds the power -> launch-speed table for a challenge. Sampled and interpolated
 * in v^2 space (where travel is very nearly linear), then refined exactly at the
 * moment of release, so the shot the player takes is always solved to full tolerance.
 */
export function buildPowerTable(setup, samples = 13) {
  const derived = deriveSetup(setup);
  const surface = setup.surface;
  const table = [];
  let hint = 0;
  for (let i = 0; i < samples; i++) {
    const p = i / (samples - 1);
    const target = designTravel(p, surface);
    const v = solveLaunchSpeed(setup, target, { derived, hint, tolerance: 1e-6 });
    hint = v;
    table.push({ p, v, travel: target });
  }
  return { table, derived };
}

/** Fast, monotone lookup used as the bisection hint. */
export function lookupSpeed(table, p) {
  const n = table.length;
  if (p <= table[0].p) return table[0].v;
  if (p >= table[n - 1].p) return table[n - 1].v;
  let i = 1;
  while (i < n - 1 && table[i].p < p) i++;
  const a = table[i - 1];
  const b = table[i];
  const t = (p - a.p) / (b.p - a.p);
  // Interpolate energy, not speed.
  const e = a.v * a.v + (b.v * b.v - a.v * a.v) * t;
  return Math.sqrt(Math.max(e, 0));
}

/** The exact launch speed for a power value — always solved against the real sim. */
export function speedForPower(setup, p, table, derived) {
  const target = designTravel(p, setup.surface);
  const hint = table ? lookupSpeed(table, p) : 0;
  return solveLaunchSpeed(setup, target, { derived, hint });
}
