/**
 * Simulation — the deterministic core of ONE MORE MILLIMETER.
 *
 * Rules this file lives by:
 *   1. Fixed timestep. Nothing here ever reads wall-clock time or frame deltas.
 *   2. No randomness. Same setup + same launch speed => bit-identical result.
 *   3. The score is measured, never authored.
 *
 * GEOMETRY
 *   The travel axis is +x, the edge of the platform is at setup.edgeX.
 *   state.x is the object's GEOMETRIC centre; the balance point (centre of mass)
 *   sits at x + object.comOffset.
 *
 * THE MEASUREMENT (the single most important decision in the game)
 *   The reported distance is the gap between the balance point and the edge:
 *       margin = edgeX - comX
 *   That is exactly "how much further could it have gone before falling", which is
 *   what a human means by "how close was it". It also means the object can hang
 *   dramatically over the void while still scoring a real, positive number, and it
 *   makes 0.000 mm mathematically unreachable — at zero it tips. See docs/PHYSICS.md.
 */
import { PhysicsConfig as P } from '../config/PhysicsConfig.js';

export const PHASE = {
  READY: 'ready',
  SLIDE: 'slide',
  TIPPING: 'tipping',
  FALLING: 'falling',
  STOPPED: 'stopped',
  FALLEN: 'fallen',
};

/**
 * Pre-computes the constants a setup implies, so the hot loop only does arithmetic.
 * @param {object} setup {surface, object, startX, edgeX, slope?, wind?, conveyor?}
 */
export function deriveSetup(setup) {
  const { surface, object } = setup;
  const slope = setup.slope || 0;
  const muEff = surface.mu * object.frictionMul;
  return {
    ...setup,
    slope,
    wind: setup.wind || 0,
    conveyor: setup.conveyor || 0,
    muEff,
    /** Coulomb deceleration magnitude (m/s^2) — independent of mass by design. */
    aFriction: muEff * P.gravity * Math.cos(slope),
    /** Downhill component pulling toward the abyss. */
    aSlope: P.gravity * Math.sin(slope),
    /** Viscous term is a force, so heavier objects shrug it off. */
    dragPerMass: surface.drag / object.mass,
    /** Constant external force (wind/mutators), also mass dependent. */
    aWind: (setup.wind || 0) / object.mass,
    halfWidth: object.width / 2,
    comOffset: object.comOffset,
  };
}

export function createState(d) {
  return {
    x: d.startX,
    v: 0,
    t: 0,
    steps: 0,
    phase: PHASE.READY,
    angle: 0,
    angVel: 0,
    y: 0,
    vy: 0,
    restTime: 0,
    tipTime: 0,
    fallTime: 0,
    peakSpeed: 0,
    launchSpeed: 0,
    crossedEdge: false,
    crossSpeed: 0,
    startX: d.startX,
  };
}

export function launch(state, v0) {
  state.v = v0;
  state.launchSpeed = v0;
  state.peakSpeed = v0;
  state.phase = PHASE.SLIDE;
  return state;
}

/** Balance point. */
export const comX = (state, d) => state.x + d.comOffset;
/** Leading face. */
export const frontX = (state, d) => state.x + d.halfWidth;
/** Distance from the balance point to the edge (positive = still safe). */
export const marginOf = (state, d) => d.edgeX - (state.x + d.comOffset);

/**
 * Advances the simulation by exactly one fixed timestep.
 * `ignoreEdge` runs the shot on a hypothetical infinite platform, which is how we
 * measure "how far past the edge did you actually go" honestly, from the same sim.
 */
export function step(state, d, ignoreEdge = false) {
  const dt = P.dt;
  state.steps++;
  state.t += dt;

  switch (state.phase) {
    case PHASE.SLIDE: {
      const v = state.v;
      if (v > 0) {
        // a = -Coulomb - viscous + slope + wind
        const a = -d.aFriction - d.dragPerMass * v + d.aSlope + d.aWind;
        if (a < 0) {
          const tStop = v / -a;
          if (tStop <= dt) {
            // Analytic stop inside the step: the last fraction of a millimetre is
            // where this game is decided, so we do not let it fall on a step boundary.
            state.x += v * tStop + 0.5 * a * tStop * tStop;
            state.v = 0;
          } else {
            state.x += v * dt + 0.5 * a * dt * dt;
            state.v = v + a * dt;
            if (state.v < P.velocityEpsilon) {
              // Creep tail below the epsilon adds less than 1e-6 m: settle exactly.
              state.x += (state.v * state.v) / (2 * -a);
              state.v = 0;
            }
          }
        } else {
          // Net accelerating (steep slope / tailwind): keep integrating.
          state.x += v * dt + 0.5 * a * dt * dt;
          state.v = v + a * dt;
        }
      }

      if (!ignoreEdge && state.x + d.comOffset >= d.edgeX) {
        beginTip(state, d);
        break;
      }

      if (state.v === 0) {
        state.restTime += dt;
        if (state.restTime >= P.settleTime) state.phase = PHASE.STOPPED;
      } else {
        state.restTime = 0;
      }
      break;
    }

    case PHASE.TIPPING: {
      // Rigid pivot about the platform edge. Torque per unit mass = g * horizontal
      // offset of the balance point from the pivot, projected through the rotation.
      state.tipTime += P.dt;
      const d0 = state.x + d.comOffset - d.edgeX;
      const r = Math.hypot(Math.max(d0, P.fall.minLever), d.object.height * 0.5);
      const iOverM =
        (d.object.width * d.object.width + d.object.height * d.object.height) / 12 + r * r;
      const lever = Math.max(d0, P.fall.minLever) * Math.cos(state.angle);
      const angAcc = (P.gravity * lever * P.fall.torqueScale) / iOverM;
      state.angVel = Math.min(state.angVel + angAcc * dt, P.fall.maxSpin);
      state.angle += state.angVel * dt;
      state.x += state.v * dt * 0.35;
      state.v *= 1 - 2.2 * dt;
      state.y = (1 - Math.cos(state.angle)) * r;
      if (state.angle >= P.fall.releaseAngle || state.tipTime >= P.fall.maxTipTime) {
        state.phase = PHASE.FALLING;
        state.vy = state.angVel * r;
      }
      break;
    }

    case PHASE.FALLING: {
      state.vy += P.gravity * dt;
      state.y += state.vy * dt;
      state.x += state.v * dt;
      state.angle += state.angVel * dt;
      state.fallTime += dt;
      if (state.fallTime >= P.fall.duration) state.phase = PHASE.FALLEN;
      break;
    }

    default:
      break;
  }
  return state;
}

function beginTip(state, d) {
  state.phase = PHASE.TIPPING;
  state.crossedEdge = true;
  state.crossSpeed = state.v;
  const r = Math.max(d.halfWidth, 0.01);
  // Forward momentum converts into rotation about the edge.
  state.angVel = Math.min(state.v / r, 9);
}

/** True once the shot can no longer change its score. */
export const isSettled = (state) =>
  state.phase === PHASE.STOPPED || state.phase === PHASE.FALLEN;

/**
 * Runs a whole shot headlessly. Used by the calibrator, the tests and the harness,
 * and by the game itself to measure the honest overshoot of a fall.
 */
export function simulateShot(setup, v0, opts = {}) {
  const d = opts.derived || deriveSetup(setup);
  const state = createState(d);
  launch(state, v0);
  const ignoreEdge = !!opts.ignoreEdge;
  const maxSteps = opts.maxSteps || 240 * 25;
  const samples = opts.sampleEvery ? [] : null;
  while (!isSettled(state) && state.steps < maxSteps) {
    step(state, d, ignoreEdge);
    if (state.peakSpeed < state.v) state.peakSpeed = state.v;
    if (samples && state.steps % opts.sampleEvery === 0) {
      samples.push({ t: state.t, x: state.x, v: state.v, phase: state.phase });
    }
  }
  return buildResult(state, d, samples);
}

export function buildResult(state, d, samples = null) {
  const com = state.x + d.comOffset;
  const fell = state.phase === PHASE.FALLEN || state.phase === PHASE.FALLING || state.phase === PHASE.TIPPING;
  const margin = d.edgeX - com;
  const overhang = Math.max(0, state.x + d.halfWidth - d.edgeX);
  return {
    fell,
    /** Distance from the balance point to the edge (m). Only meaningful when !fell. */
    marginM: fell ? 0 : margin,
    /** How much of the object physically hangs over the void (m). */
    overhangM: fell ? 0 : overhang,
    hanging: !fell && overhang > 0,
    /** Distance the balance point travelled (m). */
    travelM: state.x + d.comOffset - (state.startX + d.comOffset),
    timeS: state.t,
    steps: state.steps,
    peakSpeed: state.peakSpeed,
    launchSpeed: state.launchSpeed,
    crossSpeed: state.crossSpeed,
    samples,
  };
}

/**
 * Predicted resting margin from the current state, for presentation only
 * (camera, slow motion, audio tension). Never feeds back into the physics.
 */
export function predictMargin(state, d) {
  if (state.v <= 0) return d.edgeX - (state.x + d.comOffset);
  const a = d.aFriction + d.dragPerMass * state.v * 0.5 - d.aSlope - d.aWind;
  if (a <= 0) return -Infinity;
  const remaining = (state.v * state.v) / (2 * a);
  return d.edgeX - (state.x + d.comOffset + remaining);
}
