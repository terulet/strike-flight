/**
 * InputSmoothing.ts
 *
 * Un teclado da 0 o 1. Una moto no.
 *
 * Aqui se convierte el `InputState` binario en un `SmoothedInput` continuo:
 * cada accion sube y baja con su propia rampa (en unidades por segundo), de
 * modo que soltar el gas no corta la traccion en un fotograma y tocar el
 * freno no clava la moto en seco. La rampa de subida y la de bajada son
 * distintas a proposito: el freno muerde antes de lo que suelta, el cuerpo
 * del piloto se mueve mas despacio que el puno del gas.
 *
 * Es un paso deliberado y separado para que la fisica reciba SIEMPRE valores
 * continuos, vengan del teclado, del tactil o de un test.
 */

import { InputSmoothingConfig } from '../config/GameConfig';
import { clamp } from '../physics/MathUtils';
import { InputState } from './InputManager';

export interface SmoothedInput {
  /** 0..1 continuo. */
  throttle: number;
  /** 0..1 continuo. */
  brake: number;
  /** -1..1 continuo. */
  lean: number;
  /** El estado crudo del gas, por si algun sistema necesita el flanco. */
  throttlePressed: boolean;
  brakePressed: boolean;
}

/** Aproxima `value` a `target` con rampas distintas segun se acerque o se aleje de 0. */
function ramp(value: number, target: number, attackPerSecond: number, releasePerSecond: number, dt: number): number {
  const goingUp = Math.abs(target) > Math.abs(value);
  const rate = goingUp ? attackPerSecond : releasePerSecond;
  const step = rate * dt;
  const delta = target - value;
  if (Math.abs(delta) <= step) return target;
  return value + Math.sign(delta) * step;
}

export class InputSmoother {
  private throttle = 0;
  private brake = 0;
  private lean = 0;

  reset(): void {
    this.throttle = 0;
    this.brake = 0;
    this.lean = 0;
  }

  /** Avanza el suavizado un paso fijo y devuelve el estado continuo resultante. */
  update(raw: InputState, dt: number): SmoothedInput {
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const rawLean = Number.isFinite(raw.lean) ? clamp(raw.lean, -1, 1) : 0;

    this.throttle = clamp(
      ramp(this.throttle, raw.throttle ? 1 : 0, InputSmoothingConfig.throttleAttack, InputSmoothingConfig.throttleRelease, safeDt),
      0,
      1,
    );
    this.brake = clamp(
      ramp(this.brake, raw.brake ? 1 : 0, InputSmoothingConfig.brakeAttack, InputSmoothingConfig.brakeRelease, safeDt),
      0,
      1,
    );
    this.lean = clamp(
      ramp(this.lean, rawLean, InputSmoothingConfig.leanAttack, InputSmoothingConfig.leanRelease, safeDt),
      -1,
      1,
    );

    return {
      throttle: this.throttle,
      brake: this.brake,
      lean: this.lean,
      throttlePressed: raw.throttle,
      brakePressed: raw.brake,
    };
  }

  get current(): SmoothedInput {
    return {
      throttle: this.throttle,
      brake: this.brake,
      lean: this.lean,
      throttlePressed: this.throttle > 0.5,
      brakePressed: this.brake > 0.5,
    };
  }
}
