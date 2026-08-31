/**
 * KeyboardInput.ts
 *
 * Traduce eventos de teclado (flechas/WASD + R/Espacio) a InputState.
 */

import { InputActionKeys } from '../config/GameConfig';
import { InputSource, InputState, neutralInputState } from './InputManager';

export class KeyboardInput implements InputSource {
  private readonly pressed = new Set<string>();
  private restartLatched = false;
  private readonly onKeyDown = (event: Event) => this.pressed.add((event as KeyboardEvent).code);
  private readonly onKeyUp = (event: Event) => this.pressed.delete((event as KeyboardEvent).code);

  constructor(target: EventTarget = typeof window !== 'undefined' ? window : (undefined as unknown as EventTarget)) {
    if (target) {
      target.addEventListener('keydown', this.onKeyDown);
      target.addEventListener('keyup', this.onKeyUp);
    }
    this.target = target;
  }

  private target: EventTarget;

  private anyPressed(codes: readonly string[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }

  getState(): InputState {
    const state: InputState = neutralInputState();
    state.throttle = this.anyPressed(InputActionKeys.throttle);
    state.brake = this.anyPressed(InputActionKeys.brake);
    const forward = this.anyPressed(InputActionKeys.leanForward);
    const back = this.anyPressed(InputActionKeys.leanBack);
    state.lean = forward && !back ? 1 : back && !forward ? -1 : 0;

    const restartHeld = this.anyPressed(InputActionKeys.restart);
    state.restartPressed = restartHeld && !this.restartLatched;
    this.restartLatched = restartHeld;
    return state;
  }

  dispose(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.onKeyDown);
      this.target.removeEventListener('keyup', this.onKeyUp);
    }
    this.pressed.clear();
  }
}
