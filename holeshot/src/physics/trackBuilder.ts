/**
 * Constructor de pistas: un DSL de piezas encadenadas (llano, rampa, hueco,
 * mesa, whoops, troncos...) que produce el campo de alturas y, a la vez, la
 * lista de objetos que se dibujan ENCIMA de ese mismo relieve (troncos,
 * rocas, neumaticos, carteles, checkpoints, placas...).
 *
 * Regla que no se rompe: un obstaculo que se choca es relieve del terreno, y
 * su dibujo se coloca exactamente sobre ese relieve. Nada de decorados que
 * "parecen" suelo y no lo son.
 */
import { hash1 } from '../core/math';
import { MudZone, TERRAIN_STEP, Terrain } from './terrain';

export type ObstacleKind = 'log' | 'rock' | 'tire' | 'barrel';
export type PropKind =
  | 'tires'
  | 'flag'
  | 'banner'
  | 'cactus'
  | 'boulder'
  | 'tree'
  | 'pine'
  | 'fence'
  | 'crowd'
  | 'light'
  | 'crane'
  | 'sign'
  | 'hay';

export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  /** Radio o semialto, en metros. */
  size: number;
  seed: number;
}

export interface Prop {
  kind: PropKind;
  x: number;
  scale: number;
  /** Plano: 0 = junto a la pista, 1 = un poco detras. */
  depth: number;
  seed: number;
}

export interface Pickup {
  kind: 'plate' | 'nitro';
  x: number;
  y: number;
  /** En pleno vuelo: se ajusta a la trazada de referencia (ver racingLine.ts). */
  air: boolean;
}

export interface Pit {
  startX: number;
  endX: number;
  /** Altura por debajo de la cual caer es darse por perdido. */
  killY: number;
}

export interface Section {
  name: string;
  x: number;
}

export interface TrackData {
  terrain: Terrain;
  startX: number;
  finishX: number;
  checkpoints: number[];
  obstacles: Obstacle[];
  props: Prop[];
  pickups: Pickup[];
  pits: Pit[];
  sections: Section[];
  /** Posiciones de labio de rampa (para carteles de salto). */
  kickers: number[];
}

type Shape = (u: number) => number; // u en 0..1, devuelve dy acumulado respecto al inicio de la pieza

interface Piece {
  x0: number;
  len: number;
  y0: number;
  shape: Shape;
}

const ease = (u: number): number => 0.5 - 0.5 * Math.cos(Math.PI * u);

export class TrackBuilder {
  private x = 0;
  private y = 0;
  private readonly pieces: Piece[] = [];
  private readonly bumps: Array<{ x: number; fn: (dx: number) => number; half: number }> = [];
  readonly obstacles: Obstacle[] = [];
  readonly props: Prop[] = [];
  private readonly pendingPickups: Array<{ kind: Pickup['kind']; x: number; h: number }> = [];
  readonly pits: Pit[] = [];
  readonly sections: Section[] = [];
  readonly checkpoints: number[] = [];
  readonly kickers: number[] = [];
  readonly mudZones: MudZone[] = [];
  private seed = 1;

  get cx(): number {
    return this.x;
  }
  get cy(): number {
    return this.y;
  }

  private add(len: number, dyTotal: number, shape: Shape): this {
    this.pieces.push({ x0: this.x, len, y0: this.y, shape });
    this.x += len;
    this.y += dyTotal;
    return this;
  }

  section(name: string): this {
    this.sections.push({ name, x: this.x });
    return this;
  }

  checkpoint(): this {
    this.checkpoints.push(this.x);
    return this;
  }

  flat(len: number): this {
    return this.add(len, 0, () => 0);
  }

  /** Cambio de cota suave (pendiente con entrada y salida redondeadas). */
  slope(len: number, dy: number): this {
    return this.add(len, dy, (u) => dy * ease(u));
  }

  /** Subida con curva de aceleracion: el labio sale con angulo. */
  kicker(len: number, h: number, power = 1.8): this {
    this.kickers.push(this.x + len);
    return this.add(len, h, (u) => h * Math.pow(u, power));
  }

  /** Bajada de recepcion: arranca inclinada y termina tendida. */
  landing(len: number, drop: number): this {
    return this.add(len, -drop, (u) => -drop * (1 - Math.pow(1 - u, 1.7)));
  }

  /**
   * Hueco: cae casi en vertical hasta un foso, fondo, y vuelve a subir a
   * `exitDy` respecto al labio. Caer al fondo es perder: se registra como
   * zona de muerte.
   */
  gap(len: number, depth: number, exitDy = 0): this {
    const wall = Math.min(2.2, len * 0.18);
    const x0 = this.x;
    const y0 = this.y;
    this.pits.push({ startX: x0 + wall * 0.6, endX: x0 + len - wall * 0.6, killY: y0 - depth * 0.55 });
    return this.add(len, exitDy, (u) => {
      const d = u * len;
      if (d < wall) return -depth * ease(d / wall);
      if (d > len - wall) return lerpY(-depth, exitDy, ease((d - (len - wall)) / wall));
      return -depth;
    });
  }

  tabletop(up: number, h: number, top: number, down: number): this {
    this.kicker(up, h, 1.5);
    this.flat(top);
    return this.landing(down, h);
  }

  /** Escalon de subida: cara casi vertical y meseta. */
  stepUp(h: number, face = 3.2): this {
    return this.add(face, h, (u) => h * Math.pow(ease(u), 1.3));
  }

  /** Cortado: cae de golpe. */
  dropOff(h: number, face = 3): this {
    return this.add(face, -h, (u) => -h * ease(u));
  }

  whoops(n: number, amp: number, wl: number): this {
    return this.add(n * wl, 0, (u) => amp * 0.5 * (1 - Math.cos(u * n * Math.PI * 2)));
  }

  /** Subida larga con rampa sostenida. */
  hill(len: number, h: number): this {
    return this.slope(len, h);
  }

  // --- obstaculos (relieve + arte) -------------------------------------------

  /** Tronco medio enterrado. Se choca con su propia curva. */
  log(r = 0.32, gapAfter = 5): this {
    const x = this.x + r + 0.3;
    this.flat(r * 2 + 0.6);
    const sink = r * 0.35;
    this.bumps.push({ x, half: r, fn: (dx) => Math.max(0, Math.sqrt(Math.max(0, r * r - dx * dx)) - sink) });
    this.obstacles.push({ kind: 'log', x, size: r, seed: this.nextSeed() });
    return this.flat(gapAfter);
  }

  logs(n: number, spacing = 5.5, r = 0.3): this {
    for (let i = 0; i < n; i++) this.log(r, spacing);
    return this;
  }

  /** Pedregal: rocas irregulares de distintos tamanos. */
  rocks(len: number, count: number, maxH = 0.42): this {
    const x0 = this.x;
    this.flat(len);
    for (let i = 0; i < count; i++) {
      const s = this.nextSeed();
      const x = x0 + ((i + 0.5 + (hash1(s) - 0.5) * 0.6) / count) * len;
      const h = maxH * (0.45 + hash1(s * 1.7) * 0.55);
      const half = h * (1.3 + hash1(s * 2.3) * 0.6);
      this.bumps.push({ x, half, fn: (dx) => h * Math.pow(Math.max(0, 1 - (dx / half) ** 2), 0.7) });
      this.obstacles.push({ kind: 'rock', x, size: h, seed: s });
    }
    return this;
  }

  /** Fila de neumaticos tumbados. */
  tires(n: number, gapAfter = 6): this {
    const r = 0.3;
    const x0 = this.x + 0.4;
    this.flat(n * r * 2 + 0.8);
    for (let i = 0; i < n; i++) {
      const x = x0 + r + i * r * 2;
      this.bumps.push({ x, half: r, fn: (dx) => Math.max(0, Math.sqrt(Math.max(0, r * r - dx * dx)) * 0.8) });
      this.obstacles.push({ kind: 'tire', x, size: r, seed: this.nextSeed() });
    }
    return this.flat(gapAfter);
  }

  /** Charco de barro: un poco hundido, resbala y frena. */
  mud(len: number): this {
    this.mudZones.push({ x0: this.x, x1: this.x + len });
    return this.add(len, 0, (u) => -0.1 * Math.sin(Math.PI * u));
  }

  // --- decorado y recogibles --------------------------------------------------

  prop(kind: PropKind, dx = 0, scale = 1, depth = 0): this {
    this.props.push({ kind, x: this.x + dx, scale, depth, seed: this.nextSeed() });
    return this;
  }

  /** Recogible a `h` metros sobre el suelo en el punto actual + dx. */
  pickup(kind: 'plate' | 'nitro', dx: number, h: number): this {
    this.pendingPickups.push({ kind, x: this.x + dx, h });
    return this;
  }

  private nextSeed(): number {
    this.seed += 1;
    return this.seed * 7.31;
  }

  build(startX: number, finishOffset: number): TrackData {
    const end = this.x;
    const n = Math.ceil(end / TERRAIN_STEP) + 1;
    const heights = new Float64Array(n);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const x = i * TERRAIN_STEP;
      while (p < this.pieces.length - 1 && x > this.pieces[p].x0 + this.pieces[p].len) p++;
      const piece = this.pieces[p];
      const u = piece.len > 0 ? Math.min(1, Math.max(0, (x - piece.x0) / piece.len)) : 1;
      heights[i] = piece.y0 + piece.shape(u);
    }
    // Suavizado ligero: redondea las aristas sin comerse los labios.
    const smooth = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = heights[Math.max(0, i - 1)];
      const b = heights[i];
      const c = heights[Math.min(n - 1, i + 1)];
      smooth[i] = (a + 2 * b + c) / 4;
    }
    for (const bump of this.bumps) {
      const i0 = Math.max(0, Math.floor((bump.x - bump.half) / TERRAIN_STEP));
      const i1 = Math.min(n - 1, Math.ceil((bump.x + bump.half) / TERRAIN_STEP));
      for (let i = i0; i <= i1; i++) smooth[i] += bump.fn(i * TERRAIN_STEP - bump.x);
    }
    const terrain = new Terrain(0, smooth, this.mudZones);
    const pickups: Pickup[] = this.pendingPickups.map((pk) => ({
      kind: pk.kind,
      x: pk.x,
      y: terrain.heightAt(pk.x) + pk.h,
      air: pk.h >= 3,
    }));
    return {
      terrain,
      startX,
      finishX: end - finishOffset,
      checkpoints: [startX, ...this.checkpoints],
      obstacles: this.obstacles,
      props: this.props,
      pickups,
      pits: this.pits,
      sections: this.sections,
      kickers: this.kickers,
    };
  }
}

function lerpY(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
