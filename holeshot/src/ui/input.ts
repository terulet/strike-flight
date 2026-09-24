/**
 * Mandos: teclado y controles tactiles. Todo acaba en un BikeInput.
 *
 *   Gas: Flecha arriba / W          Freno: Flecha abajo / S
 *   Cuerpo atras: Flecha izq / A     Cuerpo adelante: Flecha der / D
 *   Nitro: Espacio / Shift           Tear-off: T    Reiniciar: R   Pausa: Esc / P
 */
import { BikeInput } from '../physics/bike';

export type Action = 'confirm' | 'back' | 'restart' | 'pause' | 'left' | 'right' | 'up' | 'down' | 'mute' | 'tearoff';

export class Input {
  private readonly keys = new Set<string>();
  private readonly touch = { gas: false, brake: false, back: false, fwd: false, nitro: false };
  private listeners: Array<(a: Action) => void> = [];
  touchUsed = false;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      // Escribiendo en un campo (garaje): las teclas son texto, no mandos.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        if (e.code === 'Enter' || e.code === 'NumpadEnter') this.listeners.forEach((l) => l('confirm'));
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        const a = this.actionFor(e.code);
        if (a) this.listeners.forEach((l) => l(a));
      }
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
    target.addEventListener('touchstart', () => (this.touchUsed = true), { passive: true });
  }

  private actionFor(code: string): Action | null {
    switch (code) {
      case 'Enter':
      case 'NumpadEnter':
        return 'confirm';
      case 'Escape':
      case 'KeyP':
        return code === 'Escape' ? 'back' : 'pause';
      case 'KeyR':
        return 'restart';
      case 'ArrowLeft':
      case 'KeyA':
        return 'left';
      case 'ArrowRight':
      case 'KeyD':
        return 'right';
      case 'ArrowUp':
      case 'KeyW':
        return 'up';
      case 'ArrowDown':
      case 'KeyS':
        return 'down';
      case 'KeyM':
        return 'mute';
      case 'KeyT':
      case 'KeyE':
        return 'tearoff';
      default:
        return null;
    }
  }

  onAction(fn: (a: Action) => void): void {
    this.listeners.push(fn);
  }

  /** Enlaza un boton tactil a un mando. */
  bindTouch(el: HTMLElement, key: keyof Input['touch']): void {
    const set = (v: boolean) => (e: Event): void => {
      e.preventDefault();
      this.touch[key] = v;
      el.classList.toggle('on', v);
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.((e as PointerEvent).pointerId);
      set(true)(e);
    });
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointercancel', set(false));
    el.addEventListener('lostpointercapture', () => {
      this.touch[key] = false;
      el.classList.remove('on');
    });
  }

  /** Boton tactil de una sola pulsacion que dispara una accion. */
  bindTap(el: HTMLElement, action: Action): void {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.listeners.forEach((l) => l(action));
    });
  }

  read(): BikeInput {
    const k = this.keys;
    const gas = k.has('ArrowUp') || k.has('KeyW') || this.touch.gas;
    const brake = k.has('ArrowDown') || k.has('KeyS') || this.touch.brake;
    const back = k.has('ArrowLeft') || k.has('KeyA') || this.touch.back;
    const fwd = k.has('ArrowRight') || k.has('KeyD') || this.touch.fwd;
    const nitro = k.has('Space') || k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.nitro;
    return { throttle: gas ? 1 : 0, brake: brake ? 1 : 0, lean: (back ? 1 : 0) - (fwd ? 1 : 0), nitro };
  }

  reset(): void {
    this.keys.clear();
    for (const k of Object.keys(this.touch) as Array<keyof Input['touch']>) this.touch[k] = false;
  }
}
