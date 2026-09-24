/** Utilidades de color para teñir por niebla, noche o profundidad. */
const cache = new Map<string, string>();

function parse(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla `a` hacia `b` (hex) en proporcion t. */
export function mix(a: string, b: string, t: number): string {
  const key = `${a}|${b}|${t.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ca = parse(a);
  const cb = parse(b);
  const r = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  const out = '#' + r.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}

export function rgba(hex: string, a: number): string {
  const c = parse(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function shade(hex: string, k: number): string {
  return k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k);
}
