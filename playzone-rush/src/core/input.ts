/**
 * Entrada unificada: puntero (raton/dedo/lapiz via Pointer Events) + teclado.
 *
 * Los minijuegos no escuchan eventos del DOM: leen este estado en su update().
 * Asi el host controla cuando se limpia, se puede pausar sin fugas y nada se
 * queda enganchado al destruir un juego.
 */
export interface Tap {
  x: number;
  y: number;
  time: number;
}

export class InputManager {
  /** Coordenadas en pixeles CSS relativas al canvas. */
  x = 0;
  y = 0;
  down = false;
  /** Se ha pulsado en este frame. */
  pressed = false;
  /** Se ha soltado en este frame. */
  released = false;
  /** Toques ocurridos en este frame (posicion exacta del contacto). */
  taps: Tap[] = [];
  /** Teclas pulsadas en este frame. */
  keyTaps: string[] = [];

  private keys = new Set<string>();
  private detachers: (() => void)[] = [];

  attach(el: HTMLElement): void {
    this.detach();

    const toLocal = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      this.x = ev.clientX - rect.left;
      this.y = ev.clientY - rect.top;
    };

    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      toLocal(ev);
      this.down = true;
      this.pressed = true;
      this.taps.push({ x: this.x, y: this.y, time: performance.now() });
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {
        /* algunos navegadores lo rechazan con multitouch */
      }
    };
    const onMove = (ev: PointerEvent) => {
      toLocal(ev);
      if (this.down) ev.preventDefault();
    };
    const onUp = (ev: PointerEvent) => {
      toLocal(ev);
      this.down = false;
      this.released = true;
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* idem */
      }
    };
    const onCancel = () => {
      this.down = false;
      this.released = true;
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      this.keys.add(ev.code);
      this.keyTaps.push(ev.code);
      if (MOVEMENT_KEYS.has(ev.code)) ev.preventDefault();
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      this.keys.delete(ev.code);
    };
    const onBlur = () => {
      this.keys.clear();
      this.down = false;
    };

    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
    globalThis.addEventListener('pointerup', onUp);
    globalThis.addEventListener('pointercancel', onCancel);
    globalThis.addEventListener('keydown', onKeyDown);
    globalThis.addEventListener('keyup', onKeyUp);
    globalThis.addEventListener('blur', onBlur);

    this.detachers = [
      () => el.removeEventListener('pointerdown', onDown),
      () => el.removeEventListener('pointermove', onMove),
      () => globalThis.removeEventListener('pointerup', onUp),
      () => globalThis.removeEventListener('pointercancel', onCancel),
      () => globalThis.removeEventListener('keydown', onKeyDown),
      () => globalThis.removeEventListener('keyup', onKeyUp),
      () => globalThis.removeEventListener('blur', onBlur),
    ];
  }

  detach(): void {
    for (const fn of this.detachers) fn();
    this.detachers = [];
    this.reset();
  }

  reset(): void {
    this.down = false;
    this.pressed = false;
    this.released = false;
    this.taps.length = 0;
    this.keyTaps.length = 0;
    this.keys.clear();
  }

  isKeyDown(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  /** -1 / 0 / +1 en horizontal a partir del teclado. */
  get keyboardAxisX(): number {
    let axis = 0;
    if (this.isKeyDown('ArrowLeft', 'KeyA')) axis -= 1;
    if (this.isKeyDown('ArrowRight', 'KeyD')) axis += 1;
    return axis;
  }

  get keyboardAxisY(): number {
    let axis = 0;
    if (this.isKeyDown('ArrowUp', 'KeyW')) axis -= 1;
    if (this.isKeyDown('ArrowDown', 'KeyS')) axis += 1;
    return axis;
  }

  /** El host lo llama al final de cada frame. */
  endFrame(): void {
    this.pressed = false;
    this.released = false;
    this.taps.length = 0;
    this.keyTaps.length = 0;
  }
}

const MOVEMENT_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
]);
