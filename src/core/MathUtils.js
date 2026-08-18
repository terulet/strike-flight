/** Utilidades matemáticas compartidas. Sin dependencias, sin asignaciones ocultas. */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Interpolación independiente del framerate: recupera `rate` por segundo. */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
};

export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

/** Diferencia angular con signo, normalizada a [-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Gira `from` hacia `to` como máximo `maxStep` radianes. */
export function rotateToward(from, to, maxStep) {
  const d = angleDelta(from, to);
  return Math.abs(d) <= maxStep ? to : from + Math.sign(d) * maxStep;
}

/**
 * Intersección rayo-segmento.
 * Rayo: origen (ox,oy) + dirección unitaria (dx,dy).
 * Segmento: (ax,ay) → (bx,by).
 * Devuelve la distancia a lo largo del rayo, o Infinity si no corta.
 */
export function raySegment(ox, oy, dx, dy, ax, ay, bx, by) {
  const sx = bx - ax, sy = by - ay;
  const denom = dx * sy - dy * sx;
  if (denom > -1e-9 && denom < 1e-9) return Infinity; // paralelos
  const qx = ax - ox, qy = ay - oy;
  const t = (qx * sy - qy * sx) / denom;   // distancia sobre el rayo
  if (t < 0) return Infinity;
  const u = (qx * dy - qy * dx) / denom;   // posición sobre el segmento
  if (u < 0 || u > 1) return Infinity;
  return t;
}

/** ¿Se cortan los segmentos P→P2 y Q→Q2? Usado para línea de visión. */
export function segmentsIntersect(px, py, p2x, p2y, qx, qy, q2x, q2y) {
  const rx = p2x - px, ry = p2y - py;
  const sx = q2x - qx, sy = q2y - qy;
  const denom = rx * sy - ry * sx;
  if (denom > -1e-9 && denom < 1e-9) return false;
  const ax = qx - px, ay = qy - py;
  const t = (ax * sy - ay * sx) / denom;
  const u = (ax * ry - ay * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Convierte [r,g,b] en 0..1 a una cadena `rgba()`. */
export function rgba(tint, alpha) {
  const r = Math.round(clamp(tint[0], 0, 1) * 255);
  const g = Math.round(clamp(tint[1], 0, 1) * 255);
  const b = Math.round(clamp(tint[2], 0, 1) * 255);
  return `rgba(${r},${g},${b},${alpha})`;
}
