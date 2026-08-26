import type { Vec2 } from '../core/types';

export type CameraState = 'preparation' | 'shot' | 'impact' | 'chain' | 'collapse' | 'result';

export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Owns the camera's current position/zoom and eases toward a target (section 11).
 * State is informational (drives HUD/debug + which easing speed to use) — the actual
 * target point is always whatever the last `focus*` call set.
 */
export class CameraSystem {
  state: CameraState = 'preparation';
  current: CameraView;
  private target: CameraView;
  private smoothing = 0.08;

  constructor(private overview: CameraView, private minZoom = 0.55, private maxZoom = 1.6) {
    this.current = { ...overview };
    this.target = { ...overview };
  }

  private setTarget(view: Partial<CameraView>, smoothing: number, state: CameraState): void {
    this.state = state;
    this.smoothing = smoothing;
    this.target = {
      x: view.x ?? this.target.x,
      y: view.y ?? this.target.y,
      zoom: clamp(view.zoom ?? this.target.zoom, this.minZoom, this.maxZoom),
    };
  }

  toPreparation(): void {
    this.setTarget(this.overview, 0.05, 'preparation');
  }

  followProjectile(point: Vec2): void {
    this.setTarget({ x: point.x, y: point.y, zoom: 1.05 }, 0.06, 'shot');
  }

  focusImpact(point: Vec2): void {
    this.setTarget({ x: point.x, y: point.y, zoom: 1.15 }, 0.16, 'impact');
  }

  focusChain(point: Vec2): void {
    this.setTarget({ x: point.x, y: point.y, zoom: 1.1 }, 0.09, 'chain');
  }

  focusCollapse(point: Vec2): void {
    this.setTarget({ x: point.x, y: point.y, zoom: 0.95 }, 0.05, 'collapse');
  }

  toResult(): void {
    this.setTarget(this.overview, 0.06, 'result');
  }

  update(): void {
    this.current.x += (this.target.x - this.current.x) * this.smoothing;
    this.current.y += (this.target.y - this.current.y) * this.smoothing;
    this.current.zoom += (this.target.zoom - this.current.zoom) * this.smoothing;
  }

  reset(): void {
    this.current = { ...this.overview };
    this.target = { ...this.overview };
    this.state = 'preparation';
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
