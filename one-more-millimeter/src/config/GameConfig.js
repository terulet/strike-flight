/**
 * GameConfig — the single place where balance, pacing and feedback thresholds live.
 * If a number matters to how the game FEELS, it belongs here.
 */
export const GameConfig = {
  version: '1.0.0',
  buildName: 'ONE MORE MILLIMETER',
  internalId: 'PLAYZONE-008',

  /** Reference design resolution (iPhone portrait). Everything scales from here. */
  reference: { width: 393, height: 852 },

  /** ------------------------------------------------------------------ POWER */
  power: {
    /** Full charge time (ms). Hold longer and power stays pinned at 1 (guaranteed fall). */
    chargeMs: 1450,
    /**
     * Power curve. Linear in time keeps the meter honest and readable; ALL of the
     * difficulty shaping lives in the landing window curve below (see docs/PHYSICS.md).
     */
    curve: 'linear',
    /** Ignore absurdly short taps (ms) — protects against accidental touches. */
    minHoldMs: 40,
  },

  /** --------------------------------------------------------- LANDING WINDOW
   * The power meter does not control the whole slide, only the last stretch of it.
   * margin(p) = W * ((1-p)^gamma - (1-pe)^gamma)
   *   W     window width in metres (scaled by the surface)
   *   gamma > 1 flattens the curve near the edge => precision lives where it matters
   *   pe    the power that lands exactly on the brink, jittered per challenge and
   *         revealed by the visible launch distance
   */
  window: {
    width: 0.45,
    gamma: 1.6,
    /** Per-challenge power-at-the-edge range. */
    edgePowerMin: 0.55,
    edgePowerMax: 0.82,
  },

  /** -------------------------------------------------------------- RESULT ZONES
   * Millimetres. Ordered best -> worst. Tuned against tools/harness.mjs. */
  zones: [
    { id: 'legendary', name: 'LEGENDARY', max: 0.25, color: '#ff2fd0' },
    { id: 'elite', name: 'ELITE', max: 1, color: '#c56bff' },
    { id: 'insane', name: 'INSANE', max: 3, color: '#3ddc97' },
    { id: 'great', name: 'GREAT', max: 10, color: '#59c2ff' },
    { id: 'good', name: 'GOOD', max: 25, color: '#ffd166' },
    { id: 'safe', name: 'SAFE', max: Infinity, color: '#8b95a7' },
  ],

  /** Anything at or under this (mm) gets the macro magnifier overlay. */
  magnifierMm: 1.2,
  /** Anything at or under this (mm) is celebrated as an absurd result. */
  absurdMm: 0.1,

  /** --------------------------------------------------------------- TENSION */
  tension: {
    /** Predicted final margin (m) under which the camera starts closing in. */
    approachMargin: 0.045,
    /** Predicted final margin (m) under which we go into slow motion. */
    slowMoMargin: 0.010,
    /** Time scale used while in slow motion. */
    slowMoScale: 0.20,
    /** How fast the time scale eases (per second). */
    slowMoLerp: 7,
    /** Predicted overshoot (m) under which a fall counts as a NEAR MISS. */
    nearMissMargin: 0.004,
  },

  /** ---------------------------------------------------------------- CAMERA */
  camera: {
    /** Metres visible across the screen width at the start of a shot. */
    wideSpan: 0.62,
    /** Metres visible when the object is settling on the brink. */
    tightSpan: 0.075,
    /** Metres visible for the macro reveal of a sub-millimetre result. */
    macroSpan: 0.010,
    /** Smoothing per second. */
    lerp: 5.2,
    macroLerp: 3.0,
    /** Fraction of the screen width where the action is kept. */
    anchorX: 0.55,
    anchorY: 0.56,
  },

  /** ------------------------------------------------------------------ FLOW */
  flow: {
    /** Delay (ms) between the object settling and the result appearing. */
    settlePauseMs: 260,
    /** Delay (ms) after a fall before the result appears. */
    fallPauseMs: 220,
    /** Macro magnifier hold (ms). */
    magnifierMs: 620,
    /** Minimum time (ms) the result panel stays before a tap can retry. */
    resultLockMs: 140,
  },

  /** ------------------------------------------------------------------ MODES */
  modes: {
    quick: { id: 'quick', attempts: Infinity, name: 'QUICK PLAY' },
    three: { id: 'three', attempts: 3, name: 'THREE SHOTS' },
    beat: { id: 'beat', attempts: Infinity, name: 'BEAT THE SCORE' },
    daily: { id: 'daily', attempts: 3, name: 'DAILY' },
  },

  /** ----------------------------------------------------------------- JUICE */
  feedback: {
    shakeScale: 1.0,
    particleScale: 1.0,
    hitStopMs: 90,
    haptics: {
      release: 12,
      critical: [6, 40, 6],
      stop: 18,
      fall: [24, 60, 24],
      record: [10, 40, 10, 40, 24],
      beaten: [14, 50, 30],
    },
  },

  /** ------------------------------------------------------------ PROGRESSION */
  unlocks: {
    /** Best-ever margins (m) and rival counts that hand out objects. */
    check: true,
  },

  /** Local ranking size. */
  rankingSize: 8,
};

/** Zone lookup for a distance in millimetres. */
export function zoneForMm(mm) {
  for (const z of GameConfig.zones) if (mm <= z.max) return z;
  return GameConfig.zones[GameConfig.zones.length - 1];
}
