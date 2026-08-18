/**
 * Central tunables. Anything that affects game feel lives here so it can be
 * tweaked in one place (and inspected from the debug overlay).
 * Units: logical pixels, seconds. Y grows downwards (canvas convention).
 */

export const VIEW = {
  W: 360,
  H: 780,
  ASPECT: 9 / 19.5,
  /** Reserved logical space for HUD, added on top of device safe areas. */
  HUD_TOP: 18,
  HUD_BOTTOM: 14,
};

export const ROOM = {
  W: 360,
  H: 420,
  /** Side wall thickness. */
  WALL: 14,
  /** Slab that separates one floor from the next (the ceiling you break through). */
  SLAB: 18,
};

export const PLAYER = {
  W: 22,
  H: 30,
  RUN_SPEED: 132,
  ACCEL: 1100,
  /** Deceleration applied while the finger is held down (brake). */
  BRAKE: 1500,
  GRAVITY: 1500,
  /** Extra gravity while falling — snappier arcs than a symmetric parabola. */
  FALL_GRAVITY_MULT: 1.35,
  JUMP_VEL: -470,
  /** Velocity the jump is clamped to when the finger is released early. */
  JUMP_CUT_VEL: -190,
  MAX_FALL: 780,
  DIVE_VEL: 900,
  COYOTE: 0.09,
  JUMP_BUFFER: 0.12,
  /** Hitbox inset — the player's collision box is slightly forgiving. */
  HIT_INSET_X: 3,
  HIT_INSET_Y: 2,
  SPAWN_SAFE_TIME: 0.28,
};

export const FEEL = {
  SHAKE_MAX: 12,
  SHAKE_DECAY: 6.5,
  HITSTOP_LAND: 0.03,
  HITSTOP_DEATH: 0.11,
  HITSTOP_BOSS_HIT: 0.12,
  SQUASH_RECOVER: 12,
  /** Duration of the camera ride up to the next floor. */
  TRANSITION_TIME: 0.42,
  /** How long the death sequence runs before the result panel is interactive. */
  DEATH_PANEL_DELAY: 0.42,
};

export const RULES = {
  AUTHORED_FLOORS: 20,
  /** Floors beyond the authored set are generated deterministically from floor number. */
  ENDLESS_START: 21,
  /** Global speed scale cap for endless floors. */
  ENDLESS_MAX_SCALE: 1.55,
};

export const COLORS = {
  bg0: '#070912',
  bg1: '#0d1222',
  roomFill: '#0b0f1c',
  roomEdge: '#1b2440',
  solid: '#1a2138',
  solidTop: '#38456b',
  solidLine: '#2a3350',
  player: '#6ee7ff',
  playerDark: '#1b7f9c',
  playerEye: '#04121a',
  danger: '#ff3b5c',
  dangerSoft: '#ff8aa2',
  warn: '#ffb03a',
  laser: '#ff2e63',
  fire: '#ff7a1a',
  exit: '#7cff9b',
  text: '#e8eeff',
  textDim: '#7f8bb0',
  boss: '#c46bff',
  gold: '#ffd75e',
};
