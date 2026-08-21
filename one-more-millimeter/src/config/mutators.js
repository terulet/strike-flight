/**
 * Mutators — challenge modifiers. The simulation reads every one of these from the
 * setup object, so adding a new one means adding it here plus one line in the sim.
 * Only the first three are enabled in this build; the rest are declared so the
 * architecture (and the calibration pass) already accounts for them.
 */
export const MUTATORS = [
  {
    id: 'none',
    name: 'STANDARD',
    enabled: true,
    weight: 62,
    apply: (setup) => setup,
  },
  {
    id: 'slope_down',
    name: 'TILTED',
    enabled: true,
    weight: 14,
    /** Platform tilts toward the abyss — everything runs a little further. */
    apply: (setup, rng) => ({ ...setup, slope: 0.016 + rng() * 0.014 }),
  },
  {
    id: 'headwind',
    name: 'HEADWIND',
    enabled: true,
    weight: 12,
    /** Constant force against the travel direction (N). Visible as drifting dust. */
    apply: (setup, rng) => ({ ...setup, wind: -(0.05 + rng() * 0.07) }),
  },
  {
    id: 'narrow',
    name: 'NARROW',
    enabled: true,
    weight: 12,
    /** Cosmetic + tension: a visibly thinner slab. No physics change. */
    apply: (setup) => ({ ...setup, narrow: true }),
  },
  // ---- declared, not enabled in this build -------------------------------
  { id: 'conveyor', name: 'CONVEYOR', enabled: false, weight: 0, apply: (s) => ({ ...s, conveyor: 0.05 }) },
  { id: 'moving_edge', name: 'MOVING EDGE', enabled: false, weight: 0, apply: (s) => s },
  { id: 'hidden_meter', name: 'BLIND', enabled: false, weight: 0, apply: (s) => ({ ...s, hideMeter: true }) },
  { id: 'double_edge', name: 'DOUBLE EDGE', enabled: false, weight: 0, apply: (s) => s },
  { id: 'vibrating', name: 'VIBRATING', enabled: false, weight: 0, apply: (s) => s },
];

export const ENABLED_MUTATORS = MUTATORS.filter((m) => m.enabled);

export function getMutator(id) {
  return MUTATORS.find((m) => m.id === id) || MUTATORS[0];
}

/** Deterministic weighted pick. */
export function pickMutator(rng) {
  const total = ENABLED_MUTATORS.reduce((a, m) => a + m.weight, 0);
  let r = rng() * total;
  for (const m of ENABLED_MUTATORS) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return ENABLED_MUTATORS[0];
}
