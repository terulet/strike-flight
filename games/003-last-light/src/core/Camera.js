/**
 * CÁMARA — seguimiento suave, adelanto por apuntado y sacudida.
 *
 * La sacudida se aplica DESPLAZANDO la cámara, no rotando el lienzo final.
 * Así todas las capas (escena, máscara de luz, memoria) se generan con la
 * misma matriz y no hay desalineación de un fotograma entre la geometría y
 * su iluminación. El giro sí es un efecto de composición y va aparte.
 */

import { Config } from '../config/Config.js';
import { clamp, damp } from './MathUtils.js';
import { rng } from './Rng.js';

export class Camera {
  constructor(level) {
    this.level = level;
    this.x = 0; this.y = 0;      // esquina superior izquierda, en mundo
    this.cx = 0; this.cy = 0;    // centro deseado
    this.viewW = 0; this.viewH = 0;
    this.trauma = 0;
    this.shakeX = 0; this.shakeY = 0; this.roll = 0;
    this.seed = rng.next() * 1000;
  }

  resize(w, h) { this.viewW = w; this.viewH = h; }

  /** El trauma se acumula y se amortigua; nunca se asigna directamente. */
  shake(amount) { this.trauma = clamp(this.trauma + amount, 0, 1); }

  snapTo(x, y) { this.cx = x; this.cy = y; this.#clampAndApply(0, 0); }

  update(dt, targetX, targetY, aimX, aimY) {
    const c = Config.camera;
    const lead = clamp(c.lookAhead, 0, 1) * c.lookMax;
    const wantX = targetX + aimX * lead;
    const wantY = targetY + aimY * lead;

    this.cx = damp(this.cx, wantX, c.follow, dt);
    this.cy = damp(this.cy, wantY, c.follow, dt);

    this.trauma = Math.max(0, this.trauma - c.shakeDecay * dt * Math.max(0.25, this.trauma));
    // Al cuadrado: los golpes pequeños casi no se notan y los fuertes duelen.
    const s = this.trauma * this.trauma;
    this.seed += dt * 47;
    const n1 = Math.sin(this.seed * 12.9898) * 43758.5453;
    const n2 = Math.sin(this.seed * 78.233) * 43758.5453;
    const n3 = Math.sin(this.seed * 39.425) * 43758.5453;
    this.shakeX = (n1 - Math.floor(n1) - 0.5) * 2 * s * c.shakeMaxOffset;
    this.shakeY = (n2 - Math.floor(n2) - 0.5) * 2 * s * c.shakeMaxOffset;
    this.roll = (n3 - Math.floor(n3) - 0.5) * 2 * s * c.shakeMaxRoll;

    this.#clampAndApply(this.shakeX, this.shakeY);
  }

  #clampAndApply(sx, sy) {
    let x = this.cx - this.viewW / 2 + sx;
    let y = this.cy - this.viewH / 2 + sy;
    // Sin bordes negros: si la arena es menor que la vista, se centra.
    x = this.level.width <= this.viewW
      ? (this.level.width - this.viewW) / 2
      : clamp(x, 0, this.level.width - this.viewW);
    y = this.level.height <= this.viewH
      ? (this.level.height - this.viewH) / 2
      : clamp(y, 0, this.level.height - this.viewH);
    // Redondeo a píxel entero: mata el hormigueo de los bordes al desplazarse.
    this.x = Math.round(x);
    this.y = Math.round(y);
  }

  toWorldX(screenX) { return screenX + this.x; }
  toWorldY(screenY) { return screenY + this.y; }
}
