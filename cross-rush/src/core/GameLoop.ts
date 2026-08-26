/**
 * GameLoop.ts
 *
 * Bucle de simulacion a paso fijo (SIM_HZ), desacoplado del refresco de
 * pantalla. Acumula tiempo real transcurrido y ejecuta tantos pasos de `dt`
 * fijo como haga falta para "ponerse al dia", con un tope de pasos por frame
 * (MAX_CATCHUP_STEPS) para evitar la espiral de la muerte si el dispositivo
 * se queda momentaneamente colgado (pestana en segundo plano, GC largo...).
 *
 * El renderer puede pedir un `alpha` (0..1) para interpolar visualmente entre
 * el estado anterior y el actual y así no notar el paso discreto de la sim.
 */

import { MAX_CATCHUP_STEPS, SIM_DT } from '../config/GameConfig';

export interface GameLoopCallbacks {
  /** Ejecuta un tick de simulacion de duracion fija `dt` (segundos). */
  step: (dt: number) => void;
  /** Se llama una vez por frame de render, con alpha de interpolacion 0..1. */
  render: (alpha: number) => void;
}

export class GameLoop {
  private accumulator = 0;
  private lastTime: number | null = null;
  private rafHandle: number | null = null;
  private running = false;

  constructor(private readonly callbacks: GameLoopCallbacks, private readonly dt: number = SIM_DT) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    const loop = (time: number) => {
      if (!this.running) return;
      this.tick(time);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  /** Avanza el bucle manualmente con un `frameTimeMs` dado (util para tests). */
  advance(frameTimeMs: number): void {
    if (this.lastTime === null) {
      this.lastTime = 0;
    }
    this.tickWithDelta(frameTimeMs / 1000);
  }

  private tick(nowMs: number): void {
    if (this.lastTime === null) {
      this.lastTime = nowMs;
      return;
    }
    const frameSeconds = (nowMs - this.lastTime) / 1000;
    this.lastTime = nowMs;
    this.tickWithDelta(frameSeconds);
  }

  private tickWithDelta(frameSeconds: number): void {
    // Clamp defensivo: un frame absurdamente largo (pestana en background)
    // no debe generar miles de pasos de simulacion.
    const clampedFrame = Math.min(frameSeconds, this.dt * MAX_CATCHUP_STEPS * 4);
    this.accumulator += Math.max(0, clampedFrame);

    let steps = 0;
    while (this.accumulator >= this.dt && steps < MAX_CATCHUP_STEPS) {
      this.callbacks.step(this.dt);
      this.accumulator -= this.dt;
      steps += 1;
    }
    // Si seguimos por encima del acumulador tras el tope de pasos, lo
    // descartamos: preferimos ir "a camara lenta" un instante antes que
    // entrar en espiral de la muerte intentando recuperar el tiempo perdido.
    if (steps >= MAX_CATCHUP_STEPS) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / this.dt;
    this.callbacks.render(alpha);
  }
}
