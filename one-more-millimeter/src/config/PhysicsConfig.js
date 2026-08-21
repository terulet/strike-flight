/**
 * PhysicsConfig — every number that governs the simulation.
 *
 * UNITS
 *   Internally the simulation works in SI world units: metres, seconds, kilograms.
 *   The UI translates to millimetres (1 world unit = 1000 mm). See ui/format.js.
 *
 * DETERMINISM
 *   The integrator runs at a fixed timestep. Nothing in this file may be derived
 *   from wall-clock time, Math.random() or the display refresh rate.
 */
export const PhysicsConfig = {
  /** Physics version stamp — stored next to every score for future server validation. */
  version: '1.0.0',

  /** Gravity (m/s^2). */
  gravity: 9.81,

  /** Fixed timestep: 240 Hz. Render is fully decoupled from this. */
  dt: 1 / 240,

  /** Hard cap of physics steps consumed per rendered frame (spiral-of-death guard). */
  maxStepsPerFrame: 24,

  /** Longest frame delta we are willing to integrate (s). Bigger deltas are clamped. */
  maxFrameDelta: 0.25,

  /**
   * Below this speed (m/s) a decelerating object is considered at rest.
   * 0.0006 m/s = 0.6 mm/s: at that speed it would take a full second to move 0.6 mm.
   */
  velocityEpsilon: 0.0006,

  /** The object must stay below velocityEpsilon this long (s) before the score is final. */
  settleTime: 0.09,

  /** Ties closer than this (m) are reported as a dead heat. 1e-7 m = 0.0001 mm. */
  tieEpsilon: 1e-7,

  /** Binary-search tolerance when solving launch speed for a target travel (m). */
  solveTolerance: 5e-8,
  solveMaxIterations: 60,

  /** Safety cap so a pathological solve can never hang the frame (m/s). */
  maxLaunchSpeed: 14,

  /** Tipping / falling drama. */
  fall: {
    /** Extra torque scale once the centre of mass clears the edge. Pure presentation of a real pivot. */
    torqueScale: 1.0,
    /**
     * Nothing balances on a mathematical point: an object whose balance point sits
     * a nanometre past the edge still commits. This floor keeps the teeter dramatic
     * but bounded (and keeps the sim from running for seconds on a knife edge).
     */
    minLever: 0.0025,
    /** Hard cap on the teeter before the object simply lets go (s). */
    maxTipTime: 1.1,
    /** Angle (rad) at which the object loses contact with the edge and free-falls. */
    releaseAngle: 1.15,
    /** Seconds of free fall we play before the result is shown. */
    duration: 0.85,
    /** Rotation kept during free fall (rad/s clamp). */
    maxSpin: 22,
  },
};

/** Convenience: world metres -> millimetres. */
export const MM_PER_UNIT = 1000;
