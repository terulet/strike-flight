/**
 * Terreno como campo de alturas: y(x) muestreado cada STEP metros.
 *
 * Todo lo que se choca sale de aqui, y todo lo que se pinta tambien: el arte
 * del suelo se construye sobre la misma curva, asi que lo que se ve es donde
 * se choca.
 */
export const TERRAIN_STEP = 0.25;

/** Tramo de barro: resbala y frena. */
export interface MudZone {
  x0: number;
  x1: number;
}

export class Terrain {
  readonly startX: number;
  readonly endX: number;
  private readonly heights: Float64Array;
  readonly mud: readonly MudZone[];

  constructor(startX: number, heights: Float64Array, mud: MudZone[] = []) {
    this.startX = startX;
    this.heights = heights;
    this.endX = startX + (heights.length - 1) * TERRAIN_STEP;
    this.mud = mud;
  }

  /** Cantidad de barro en x (0..1), con bordes suaves de medio metro. */
  mudAt(x: number): number {
    for (const z of this.mud) {
      if (x > z.x0 - 0.5 && x < z.x1 + 0.5) {
        const e = Math.min(x - (z.x0 - 0.5), z.x1 + 0.5 - x);
        return Math.min(1, e / 1);
      }
    }
    return 0;
  }

  heightAt(x: number): number {
    const h = this.heights;
    const f = (x - this.startX) / TERRAIN_STEP;
    if (f <= 0) return h[0];
    const n = h.length - 1;
    if (f >= n) return h[n];
    const i = Math.floor(f);
    const t = f - i;
    return h[i] + (h[i + 1] - h[i]) * t;
  }

  slopeAt(x: number): number {
    const d = TERRAIN_STEP;
    return (this.heightAt(x + d) - this.heightAt(x - d)) / (2 * d);
  }

  /** Normal unitaria de la superficie (apunta hacia arriba). */
  normalAt(x: number): { x: number; y: number } {
    const s = this.slopeAt(x);
    const len = Math.hypot(1, s);
    return { x: -s / len, y: 1 / len };
  }
}
