/**
 * Fantasmas: la carrera grabada a 10 muestras por segundo (posicion y giro
 * de la moto) y empaquetada en un texto corto que cabe en un enlace.
 *
 * Formato binario (luego base64url, sin relleno):
 *   version, tipo de pista (0 diario / 1 prueba), dia o numero de prueba,
 *   tiempo final (ms), colores, dorsal, nombre (UTF-8, max 12 letras),
 *   muestras por segundo, numero de muestras, y las muestras como
 *   diferencias enteras (x e y en pasos de 5 cm, angulo en centesimas de
 *   radian) codificadas en varint zigzag: una vuelta de 40 s ocupa ~1,5 KB.
 *
 * Se guardan POSICIONES y no mandos: reproducir mandos exigiria que la
 * fisica diera los mismos decimales en todos los navegadores, y no lo da.
 */
import { lerp, lerpAngle } from '../core/math';

export const GHOST_RATE = 10;
// El orden es parte del formato de los enlaces: solo se añade al final.
const COLORS = ['orange', 'blue', 'green', 'yellow', 'purple', 'gold', 'neon', 'carbon'];
const DAY0 = Date.UTC(2020, 0, 1);

export interface GhostData {
  /** 'd:AAAA-MM-DD' (Barro del Dia) o 'm:N' (prueba N). */
  track: string;
  time: number;
  colors: string;
  number: string;
  name: string;
  /** x, y, angulo intercalados, uno cada 1/GHOST_RATE s desde la salida. */
  samples: number[];
}

export class GhostRecorder {
  readonly samples: number[] = [];
  private next = 0;

  /** Llamar en cada paso de fisica con el reloj de carrera. */
  record(time: number, x: number, y: number, angle: number): void {
    while (time >= this.next) {
      this.samples.push(x, y, angle);
      this.next += 1 / GHOST_RATE;
    }
  }
}

// ---------------------------------------------------------------- codec
class Writer {
  bytes: number[] = [];
  u8(v: number): void {
    this.bytes.push(v & 255);
  }
  varint(v: number): void {
    let n = Math.max(0, Math.floor(v));
    while (n >= 128) {
      this.bytes.push((n % 128) | 128);
      n = Math.floor(n / 128);
    }
    this.bytes.push(n);
  }
  zigzag(v: number): void {
    this.varint(v >= 0 ? v * 2 : -v * 2 - 1);
  }
}

class Reader {
  i = 0;
  constructor(private readonly b: Uint8Array) {}
  u8(): number {
    if (this.i >= this.b.length) throw new Error('fin');
    return this.b[this.i++];
  }
  varint(): number {
    let n = 0;
    let mul = 1;
    for (let k = 0; k < 8; k++) {
      const c = this.u8();
      n += (c & 127) * mul;
      if (c < 128) return n;
      mul *= 128;
    }
    throw new Error('varint');
  }
  zigzag(): number {
    const v = this.varint();
    return v % 2 ? -(v + 1) / 2 : v / 2;
  }
}

function toBase64Url(bytes: number[]): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeGhost(g: GhostData): string {
  const w = new Writer();
  w.u8(1);
  if (g.track.startsWith('d:')) {
    const [y, m, d] = g.track.slice(2).split('-').map(Number);
    w.u8(0);
    w.varint(Math.round((Date.UTC(y, m - 1, d) - DAY0) / 86400000));
  } else {
    w.u8(1);
    w.varint(Number(g.track.slice(2)));
  }
  w.varint(Math.round(g.time * 1000));
  w.u8(Math.max(0, COLORS.indexOf(g.colors)));
  w.varint(Number(g.number) || 0);
  // Hasta 12 letras (acentos y ñ ocupan dos bytes): nunca se corta una letra.
  let chars = Array.from(g.name).slice(0, 12);
  let name = new TextEncoder().encode(chars.join(''));
  while (name.length > 40) {
    chars = chars.slice(0, -1);
    name = new TextEncoder().encode(chars.join(''));
  }
  w.u8(name.length);
  name.forEach((b) => w.u8(b));
  w.u8(GHOST_RATE);
  const n = Math.floor(g.samples.length / 3);
  w.varint(n);
  let px = 0;
  let py = 0;
  let pa = 0;
  for (let i = 0; i < n; i++) {
    const qx = Math.round(g.samples[i * 3] * 20);
    const qy = Math.round(g.samples[i * 3 + 1] * 20);
    const qa = Math.round(g.samples[i * 3 + 2] * 100);
    w.zigzag(qx - px);
    w.zigzag(qy - py);
    w.zigzag(qa - pa);
    px = qx;
    py = qy;
    pa = qa;
  }
  return toBase64Url(w.bytes);
}

export function decodeGhost(token: string): GhostData | null {
  try {
    const r = new Reader(fromBase64Url(token));
    if (r.u8() !== 1) return null;
    const kind = r.u8();
    const v = r.varint();
    let track: string;
    if (kind === 0) {
      const d = new Date(DAY0 + v * 86400000);
      track = `d:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    } else track = `m:${v}`;
    const time = r.varint() / 1000;
    const colors = COLORS[r.u8()] ?? 'orange';
    const number = String(r.varint());
    const len = r.u8();
    const nameBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) nameBytes[i] = r.u8();
    const name = new TextDecoder().decode(nameBytes).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 12);
    if (r.u8() !== GHOST_RATE) return null;
    const n = r.varint();
    if (n > 20000) return null;
    const samples: number[] = [];
    let px = 0;
    let py = 0;
    let pa = 0;
    for (let i = 0; i < n; i++) {
      px += r.zigzag();
      py += r.zigzag();
      pa += r.zigzag();
      samples.push(px / 20, py / 20, pa / 100);
    }
    return { track, time, colors, number, name, samples };
  } catch {
    return null;
  }
}

/** Reproduce un fantasma: posicion interpolada en el instante t. */
export class GhostPlayer {
  private readonly bestX: number[] = [];

  constructor(readonly data: GhostData) {
    let m = -Infinity;
    for (let i = 0; i < this.count; i++) {
      m = Math.max(m, data.samples[i * 3]);
      this.bestX.push(m);
    }
  }

  get count(): number {
    return Math.floor(this.data.samples.length / 3);
  }

  at(t: number): { x: number; y: number; angle: number; done: boolean } {
    const s = this.data.samples;
    const f = Math.max(0, t * GHOST_RATE);
    const i = Math.min(this.count - 1, Math.floor(f));
    const j = Math.min(this.count - 1, i + 1);
    const u = Math.min(1, f - i);
    return {
      x: lerp(s[i * 3], s[j * 3], u),
      y: lerp(s[i * 3 + 1], s[j * 3 + 1], u),
      angle: lerpAngle(s[i * 3 + 2], s[j * 3 + 2], u),
      done: f >= this.count - 1,
    };
  }

  /** Cuando paso el fantasma por x (para la diferencia de tiempo en directo). */
  timeAtX(x: number): number | null {
    const b = this.bestX;
    if (!b.length || x > b[b.length - 1]) return null;
    let lo = 0;
    let hi = b.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (b[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return 0;
    const x0 = b[lo - 1];
    const x1 = b[lo];
    const u = x1 > x0 ? (x - x0) / (x1 - x0) : 0;
    return (lo - 1 + u) / GHOST_RATE;
  }
}
