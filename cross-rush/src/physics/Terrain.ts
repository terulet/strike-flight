/**
 * Terrain.ts
 *
 * Representa el terreno como una polilinea de puntos de control (x creciente,
 * y = altura en metros, eje Y hacia arriba). Para evitar "costuras" o rebotes
 * en los limites de cada segmento se interpola con Hermite cubico (splines
 * Catmull-Rom con tangentes por diferencias finitas), que garantiza
 * continuidad C1: la altura Y su pendiente son continuas en cada union.
 */

import { clamp } from './MathUtils';

export interface TerrainPoint {
  x: number;
  y: number;
}

export interface TerrainSample {
  y: number;
  /** Pendiente dy/dx en ese punto. */
  slope: number;
  /** Normal unitaria hacia "arriba" del terreno. */
  normal: { x: number; y: number };
}

export class Terrain {
  private readonly points: TerrainPoint[];
  private readonly tangents: number[];

  constructor(points: TerrainPoint[]) {
    if (points.length < 2) {
      throw new Error('Terrain necesita al menos 2 puntos de control');
    }
    // Aseguramos x estrictamente creciente (requisito de la busqueda de segmento).
    const sorted = [...points].sort((a, b) => a.x - b.x);
    this.points = sorted;
    this.tangents = Terrain.computeTangents(sorted);
  }

  get startX(): number {
    return this.points[0].x;
  }

  get endX(): number {
    return this.points[this.points.length - 1].x;
  }

  /** Tangentes por diferencias finitas centradas (Catmull-Rom simplificado). */
  private static computeTangents(points: TerrainPoint[]): number[] {
    const n = points.length;
    const tangents = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        const dx = points[1].x - points[0].x;
        tangents[i] = dx !== 0 ? (points[1].y - points[0].y) / dx : 0;
      } else if (i === n - 1) {
        const dx = points[i].x - points[i - 1].x;
        tangents[i] = dx !== 0 ? (points[i].y - points[i - 1].y) / dx : 0;
      } else {
        const slopePrev = (points[i].y - points[i - 1].y) / (points[i].x - points[i - 1].x);
        const slopeNext = (points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x);
        tangents[i] = (slopePrev + slopeNext) / 2;
      }
    }
    return tangents;
  }

  /** Localiza el indice i tal que points[i].x <= x <= points[i+1].x. */
  private findSegment(x: number): number {
    const pts = this.points;
    const clampedX = clamp(x, pts[0].x, pts[pts.length - 1].x);
    let lo = 0;
    let hi = pts.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pts[mid].x <= clampedX) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private hermiteBasis(t: number): { h00: number; h10: number; h01: number; h11: number } {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      h00: 2 * t3 - 3 * t2 + 1,
      h10: t3 - 2 * t2 + t,
      h01: -2 * t3 + 3 * t2,
      h11: t3 - t2,
    };
  }

  /** Derivadas de la base de Hermite respecto a t. */
  private hermiteBasisDerivative(t: number): { dh00: number; dh10: number; dh01: number; dh11: number } {
    const t2 = t * t;
    return {
      dh00: 6 * t2 - 6 * t,
      dh10: 3 * t2 - 4 * t + 1,
      dh01: -6 * t2 + 6 * t,
      dh11: 3 * t2 - 2 * t,
    };
  }

  surfaceY(x: number): number {
    const pts = this.points;
    const clampedX = clamp(x, pts[0].x, pts[pts.length - 1].x);
    const i = this.findSegment(clampedX);
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    if (dx <= 1e-9) return p0.y;
    const t = (clampedX - p0.x) / dx;
    const { h00, h10, h01, h11 } = this.hermiteBasis(t);
    const m0 = this.tangents[i];
    const m1 = this.tangents[i + 1];
    return h00 * p0.y + h10 * dx * m0 + h01 * p1.y + h11 * dx * m1;
  }

  surfaceSlope(x: number): number {
    const pts = this.points;
    const clampedX = clamp(x, pts[0].x, pts[pts.length - 1].x);
    const i = this.findSegment(clampedX);
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const dx = p1.x - p0.x;
    if (dx <= 1e-9) return 0;
    const t = (clampedX - p0.x) / dx;
    const { dh00, dh10, dh01, dh11 } = this.hermiteBasisDerivative(t);
    const m0 = this.tangents[i];
    const m1 = this.tangents[i + 1];
    // dy/dt = dh00*y0 + dh10*dx*m0 + dh01*y1 + dh11*dx*m1 ; dy/dx = (dy/dt) / dx * dx ... ver nota abajo
    const dydt = dh00 * p0.y + dh10 * dx * m0 + dh01 * p1.y + dh11 * dx * m1;
    return dydt / dx;
  }

  surfaceNormal(x: number): { x: number; y: number } {
    const slope = this.surfaceSlope(x);
    const len = Math.hypot(1, slope);
    // Normal perpendicular a la tangente (1, slope), orientada hacia arriba.
    return { x: -slope / len, y: 1 / len };
  }

  sample(x: number): TerrainSample {
    return { y: this.surfaceY(x), slope: this.surfaceSlope(x), normal: this.surfaceNormal(x) };
  }
}
