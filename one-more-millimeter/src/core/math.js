export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t) => Math.pow(clamp01(t), 3);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; const x = clamp01(t); return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Frame-rate independent exponential smoothing. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Interpolate on a logarithmic scale — the only sane way to blend camera zoom. */
export function dampLog(current, target, lambda, dt) {
  const c = Math.log(Math.max(current, 1e-6));
  const t = Math.log(Math.max(target, 1e-6));
  return Math.exp(damp(c, t, lambda, dt));
}
