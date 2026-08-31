/**
 * Camera.ts
 *
 * Camara 2D con seguimiento suavizado, "look-ahead" en la direccion del
 * movimiento, sacudida amortiguada en aterrizajes/crashes, y un ligero
 * alejamiento (zoom-out) cuando se acumula airtime largo.
 *
 * Tres cosas que ya no hace, y por las que se notaba:
 *
 * 1. El shake ya no es `Math.random()` por frame. Eso no es un golpe, es
 *    ruido blanco: la imagen vibra igual de fuerte todo el rato y cambia por
 *    completo entre fotogramas. Ahora es una onda amortiguada, con dos
 *    frecuencias y una envolvente exponencial, y su fase depende del tiempo
 *    de SIMULACION, no del frame. Es determinista: el mismo instante da
 *    siempre la misma sacudida, asi que se puede interpolar y no parpadea.
 * 2. Se actualiza en el paso fijo de fisica, no en el de render, y guarda su
 *    estado anterior para que el render la interpole igual que a la moto.
 *    Antes se movia una vez por frame con un dt fijo que no era el real.
 * 3. Tiene zona muerta vertical: los baches pequenos ya no mueven la camara.
 */

import { clamp, lerp } from '../physics/MathUtils';
import { CameraConfig } from '../config/GameConfig';

export interface CameraTarget {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Pose de camara lista para dibujar: ya interpolada y con la sacudida aplicada. */
export interface CameraPose {
  x: number;
  y: number;
  pixelsPerMeter: number;
}

export class Camera {
  x = 0;
  y = 0;
  pixelsPerMeter: number = CameraConfig.baseZoomPixelsPerMeter;

  private previousX = 0;
  private previousY = 0;
  private previousPixelsPerMeter: number = CameraConfig.baseZoomPixelsPerMeter;

  private impulse = 0;
  private previousImpulse = 0;
  /** Reloj de simulacion propio: la fase de la sacudida sale de aqui, no del frame. */
  private shakeClock = 0;
  private previousShakeClock = 0;
  /** Sentido de avance suavizado, para que el look-ahead no salte al rebotar. */
  private facing = 1;
  private initialized = false;

  reset(target: CameraTarget): void {
    this.x = target.x;
    this.y = target.y;
    this.previousX = this.x;
    this.previousY = this.y;
    this.impulse = 0;
    this.previousImpulse = 0;
    this.shakeClock = 0;
    this.previousShakeClock = 0;
    this.facing = target.vx >= 0 ? 1 : -1;
    this.initialized = true;
    this.pixelsPerMeter = CameraConfig.baseZoomPixelsPerMeter;
    this.previousPixelsPerMeter = this.pixelsPerMeter;
  }

  triggerLandingImpulse(): void {
    this.impulse = Math.max(this.impulse, CameraConfig.landingImpulse);
  }

  triggerCrashImpulse(): void {
    this.impulse = Math.max(this.impulse, CameraConfig.crashImpulse);
  }

  /** Se llama una vez por TICK de simulacion, con el dt fijo. */
  update(dt: number, target: CameraTarget, airTime: number): void {
    if (!this.initialized) {
      this.reset(target);
      return;
    }

    this.previousX = this.x;
    this.previousY = this.y;
    this.previousPixelsPerMeter = this.pixelsPerMeter;
    this.previousImpulse = this.impulse;
    this.previousShakeClock = this.shakeClock;
    this.shakeClock += dt;

    // Sentido de avance suavizado: con vx cerca de 0 (rebotes, aterrizajes
    // duros) el signo instantaneo cambia varias veces por segundo y la camara
    // daba bandazos de un lado a otro.
    const desiredFacing = Math.abs(target.vx) < 0.6 ? this.facing : Math.sign(target.vx);
    this.facing = lerp(this.facing, desiredFacing, clamp(CameraConfig.facingSmoothing * dt, 0, 1));

    const lookAhead = CameraConfig.lookAheadDistance + Math.abs(target.vx) * CameraConfig.lookAheadSpeedFactor;
    const desiredX = target.x + clamp(this.facing, -1, 1) * lookAhead * 0.4;

    // Zona muerta vertical: mientras la moto se mueva dentro de la banda, el
    // objetivo vertical no se mueve. Es lo que evita que whoops y rockgarden
    // conviertan la pantalla en una coctelera.
    const rawDesiredY = target.y + 0.4;
    const verticalError = rawDesiredY - this.y;
    const deadZone = CameraConfig.verticalDeadZone;
    const desiredY =
      Math.abs(verticalError) <= deadZone ? this.y : rawDesiredY - Math.sign(verticalError) * deadZone;

    this.x = lerp(this.x, desiredX, clamp(CameraConfig.smoothing * dt, 0, 1));
    this.y = lerp(this.y, desiredY, clamp(CameraConfig.verticalSmoothing * dt, 0, 1));

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

  /** Pose interpolada entre el tick anterior y el actual, para dibujar. */
  getPose(alpha: number): CameraPose {
    const t = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
    return {
      x: lerp(this.previousX, this.x, t),
      y: lerp(this.previousY, this.y, t),
      pixelsPerMeter: lerp(this.previousPixelsPerMeter, this.pixelsPerMeter, t),
    };
  }

  /**
   * Desplazamiento de sacudida a aplicar al render (en metros), para un alpha
   * de interpolacion dado.
   *
   * Dos senos de frecuencias no armonicas (17 y 26.5 Hz) con la vertical
   * desfasada un cuarto de ciclo respecto a la horizontal: el resultado es una
   * elipse que se va cerrando, que es como se ve un golpe de verdad. La
   * envolvente es el propio `impulse`, que decae linealmente.
   */
  getShakeOffset(alpha = 1): { x: number; y: number } {
    const t = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);
    const impulse = lerp(this.previousImpulse, this.impulse, t);
    if (impulse <= 1e-4) return { x: 0, y: 0 };

    const clock = lerp(this.previousShakeClock, this.shakeClock, t);
    const { primaryHz, secondaryHz, secondaryWeight, verticalRatio, amplitudeMeters } = CameraConfig.shake;

    const primaryPhase = clock * primaryHz * Math.PI * 2;
    const secondaryPhase = clock * secondaryHz * Math.PI * 2;

    const wobbleX = Math.sin(primaryPhase) + secondaryWeight * Math.sin(secondaryPhase * 1.37 + 1.1);
    const wobbleY = Math.cos(primaryPhase * 0.93) + secondaryWeight * Math.sin(secondaryPhase + 0.6);

    const envelope = impulse * amplitudeMeters;
    const normalize = 1 / (1 + secondaryWeight);
    return {
      x: wobbleX * envelope * normalize,
      y: wobbleY * envelope * normalize * verticalRatio,
    };
  }
}
