/**
 * InputManager.ts
 *
 * Contrato comun para cualquier fuente de entrada (teclado, tactil, mando...).
 * El resto del juego solo conoce esta interfaz, nunca las teclas concretas.
 */

export interface InputState {
  throttle: boolean;
  brake: boolean;
  /** +1 = levantar el morro (flecha arriba / W), 0 = neutro, -1 = hundirlo. */
  lean: number;
  /** Flanco de subida: true solo el frame en que se pulsa restart. */
  restartPressed: boolean;
}

export interface InputSource {
  /** Lee el estado actual. Debe poder llamarse cada tick sin efectos secundarios raros. */
  getState(): InputState;
  /** Libera listeners. */
  dispose(): void;
}

export function neutralInputState(): InputState {
  return { throttle: false, brake: false, lean: 0, restartPressed: false };
}

/**
 * Combina varias fuentes de entrada (p.ej. teclado + tactil a la vez en un
 * hibrido de escritorio/tablet) en un unico estado.
 */
export class InputManager implements InputSource {
  constructor(private readonly sources: InputSource[]) {}

  getState(): InputState {
    const combined = neutralInputState();
    for (const source of this.sources) {
      const s = source.getState();
      combined.throttle = combined.throttle || s.throttle;
      combined.brake = combined.brake || s.brake;
      if (s.lean !== 0) combined.lean = s.lean;
      combined.restartPressed = combined.restartPressed || s.restartPressed;
    }
    return combined;
  }

  dispose(): void {
    for (const source of this.sources) source.dispose();
  }
}
