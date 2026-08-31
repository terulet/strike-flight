/**
 * Camera.ts
 *
 * Camara 2D con seguimiento suavizado, "look-ahead" en la direccion del
 * movimiento, impulsos de sacudida en aterrizajes/crashes, y un ligero
 * alejamiento (zoom-out) cuando se acumula airtime largo.
 */

import { clamp, lerp } from '../physics/MathUtils';
import { CameraConfig } from '../config/GameConfig';

export interface CameraTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class Camera {
  x = 0;
  y = 0;
  pixelsPerMeter: number = CameraConfig.baseZoomPixelsPerMeter;

  private impulse = 0;
  private initialized = false;

  reset(target: CameraTarget): void {
    this.x = target.x;
    this.y = target.y;
    this.impulse = 0;
    this.initialized = true;
    this.pixelsPerMeter = CameraConfig.baseZoomPixelsPerMeter;
  }

  triggerLandingImpulse(): void {
    this.impulse = Math.max(this.impulse, CameraConfig.landingImpulse);
  }

  triggerCrashImpulse(): void {
    this.impulse = Math.max(this.impulse, CameraConfig.crashImpulse);
  }

  update(dt: number, target: CameraTarget, airTime: number): void {
    if (!this.initialized) {
      this.reset(target);
      return;
    }

    const lookAhead = CameraConfig.lookAheadDistance + Math.abs(target.vx) * CameraConfig.lookAheadSpeedFactor;
    const desiredX = target.x + Math.sign(target.vx || 1) * lookAhead * 0.4;
    const desiredY = target.y + 0.4;

    const t = clamp(CameraConfig.smoothing * dt, 0, 1);
    this.x = lerp(this.x, desiredX, t);
    this.y = lerp(this.y, desiredY, t);

    this.impulse = Math.max(0, this.impulse - CameraConfig.impulseDecay * dt);

    const zoomT = clamp(
      (airTime - CameraConfig.zoomOutAirtimeStart) /
        Math.max(0.001, CameraConfig.zoomOutAirtimeFull - CameraConfig.zoomOutAirtimeStart),
      0,
      1,
    );
    const targetZoomFactor = lerp(1, CameraConfig.maxZoomOutFactor, zoomT);
    this.pixelsPerMeter = lerp(
      this.pixelsPerMeter,
      CameraConfig.baseZoomPixelsPerMeter * targetZoomFactor,
      clamp(4 * dt, 0, 1),
    );
  }

  /** Desplazamiento de sacudida a aplicar al render este frame (en metros). */
  getShakeOffset(): { x: number; y: number } {
    if (this.impulse <= 0) return { x: 0, y: 0 };
    const s = this.impulse;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }
}
