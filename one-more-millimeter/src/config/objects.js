/**
 * Objects — deliberately shallow differentiation (spec 90): mass, friction multiplier,
 * width, centre-of-mass offset. Everything else is silhouette drawing.
 *
 *   mass            kg (matters through the viscous term and the tipping torque)
 *   frictionMul     multiplies the surface's mu
 *   width/height    m (side view)
 *   comOffset       m, positive = balance point sits FORWARD of the geometric centre,
 *                   so the object tips earlier and overhangs less. Negative = back-heavy,
 *                   spectacular overhang.
 *
 * Widths are deliberately modest: an object only starts to hang over the void once the
 * score is genuinely good (halfWidth - comOffset millimetres), so the overhang IS the
 * reward. The phone is the exception and can hang more than 5 cm out.
 *   unlock          null = available from the start
 */
export const OBJECTS = [
  {
    id: 'puck',
    name: 'PUCK',
    mass: 0.165,
    frictionMul: 1.0,
    width: 0.046,
    height: 0.026,
    comOffset: 0,
    shape: 'puck',
    color: '#1b1d22',
    accent: '#ff4d3d',
    unlock: null,
  },
  {
    id: 'can',
    name: 'CAN',
    mass: 0.330,
    frictionMul: 0.94,
    width: 0.040,
    height: 0.075,
    comOffset: 0,
    shape: 'can',
    color: '#c8ccd4',
    accent: '#ff9f1c',
    unlock: { type: 'best', value: 0.010, label: 'UNDER 10 mm' },
  },
  {
    id: 'phone',
    name: 'PHONE',
    mass: 0.192,
    frictionMul: 1.14,
    width: 0.090,
    height: 0.009,
    comOffset: -0.012,
    shape: 'phone',
    color: '#242b36',
    accent: '#3ddc97',
    unlock: { type: 'best', value: 0.005, label: 'UNDER 5 mm' },
  },
  {
    id: 'block',
    name: 'METAL BLOCK',
    mass: 0.640,
    frictionMul: 1.20,
    width: 0.038,
    height: 0.038,
    comOffset: 0,
    shape: 'block',
    color: '#8d949f',
    accent: '#f2f5fa',
    unlock: { type: 'rivals', value: 3, label: 'BEAT 3 RIVALS' },
  },
  {
    id: 'car',
    name: 'TINY CAR',
    mass: 0.115,
    frictionMul: 0.85,
    width: 0.052,
    height: 0.024,
    comOffset: 0.006,
    shape: 'car',
    color: '#e63946',
    accent: '#ffd166',
    unlock: { type: 'best', value: 0.001, label: 'UNDER 1 mm' },
  },
];

export const OBJECT_BY_ID = Object.freeze(
  OBJECTS.reduce((acc, o) => ((acc[o.id] = o), acc), {})
);

export function getObject(id) {
  return OBJECT_BY_ID[id] || OBJECTS[0];
}

/** Half width including the com offset — used constantly by physics and rendering. */
export function halfWidth(obj) {
  return obj.width / 2;
}
