/** Utilidades matematicas pequenas y sin estado, compartidas por toda la fisica. */

export interface Vec2 {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Normaliza un angulo al rango (-PI, PI]. */
export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Diferencia angular mas corta de "a" a "b", en (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  return normalizeAngle(b - a);
}

export function rotateVec(v: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function vecLength(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function isFiniteVec(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}
