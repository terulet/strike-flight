/**
 * INPUT — estado unificado de control.
 *
 * El resto del juego NUNCA pregunta por teclas ni por dedos: lee este objeto.
 * Táctil y escritorio son dos productores del mismo estado, así que añadir un
 * mando o cambiar el esquema no toca ni una línea de gameplay.
 *
 * El apuntado llega de dos formas incompatibles y las dos son legítimas:
 *   'point'     el ratón señala un punto de la pantalla  → escritorio
 *   'direction' el stick da una dirección relativa       → táctil
 * Player resuelve la que venga; ninguna es un parche de la otra.
 */

import { KeyboardMouse } from './KeyboardMouse.js';
import { TouchControls } from './TouchControls.js';

export class Input {
  constructor(canvas) {
    this.moveX = 0;
    this.moveY = 0;

    this.aimMode = 'point';
    this.aimPointX = 0;   // en píxeles de pantalla (CSS)
    this.aimPointY = 0;
    this.aimDirX = 1;     // vector unitario
    this.aimDirY = 0;
    this.aimStrength = 0; // 0..1, cuánto está desviado el stick derecho

    this.firing = false;
    this.reloadQueued = false;
    this.restartQueued = false;
    this.debugToggled = false;
    this.paramPanelToggled = false;
    /** Pulso de "alguien ha tocado algo": lo usa la pantalla de reinicio. */
    this.tapped = false;

    /** true en cuanto el usuario toca la pantalla: cambia el HUD y los tips. */
    this.touchActive = false;

    this.keyboard = new KeyboardMouse(canvas, this);
    this.touch = new TouchControls(canvas, this);
  }

  /** Consume los pulsos de un solo uso. Se llama al final de cada tick. */
  endFrame() {
    this.reloadQueued = false;
    this.restartQueued = false;
    this.debugToggled = false;
    this.paramPanelToggled = false;
    this.tapped = false;
    this.keyboard.endFrame();
  }

  destroy() {
    this.keyboard.destroy();
    this.touch.destroy();
  }
}
