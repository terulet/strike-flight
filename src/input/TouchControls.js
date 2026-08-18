/**
 * TOUCH — el esquema de control PRINCIPAL, no un puerto del de escritorio.
 *
 *   mitad izquierda   joystick flotante de movimiento
 *   mitad derecha     joystick flotante de apuntado
 *
 * Flotante quiere decir que el stick nace donde pones el dedo. En una pantalla
 * sin bordes táctiles no puedes exigir precisión para "encontrar" el mando: el
 * mando va a buscar al dedo.
 *
 * Disparo — tres modos, conmutables en Config.touch.fireMode:
 *   'auto'    dispara mientras el stick derecho pasa del umbral. Una sola mano
 *             por stick, cero botones. Es el valor por defecto.
 *   'button'  botón dedicado abajo a la derecha; el stick solo apunta.
 *   'release' apuntas, sueltas, dispara. Un tiro por gesto: mucha tensión,
 *             encaja con munición escasa.
 */

import { Config } from '../config/Config.js';
import { clamp } from '../core/MathUtils.js';

export class TouchControls {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.input = input;

    this.move = { id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, mag: 0 };
    this.aim = { id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0, mag: 0 };
    this.fireBtn = { id: null, down: false, x: 0, y: 0 };
    this.viewW = 0;
    this.viewH = 0;

    this._onStart = (e) => { this.#markTouch(); this.input.tapped = true; for (const t of e.changedTouches) this.#start(t); e.preventDefault(); };
    this._onMove = (e) => { for (const t of e.changedTouches) this.#moveTouch(t); e.preventDefault(); };
    this._onEnd = (e) => { for (const t of e.changedTouches) this.#end(t); e.preventDefault(); };

    canvas.addEventListener('touchstart', this._onStart, { passive: false });
    canvas.addEventListener('touchmove', this._onMove, { passive: false });
    canvas.addEventListener('touchend', this._onEnd, { passive: false });
    canvas.addEventListener('touchcancel', this._onEnd, { passive: false });
  }

  setViewport(w, h) {
    this.viewW = w;
    this.viewH = h;
    this.fireBtn.x = w - Config.touch.buttonRadius - 34;
    this.fireBtn.y = h - Config.touch.buttonRadius - 34;
  }

  #markTouch() {
    if (this.input.touchActive) return;
    this.input.touchActive = true;
    this.input.aimMode = 'direction';
  }

  #local(t) {
    const r = this.canvas.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  #start(t) {
    const p = this.#local(t);
    const R = Config.touch.buttonRadius;

    if (Config.touch.fireMode === 'button' && this.fireBtn.id === null) {
      const d = Math.hypot(p.x - this.fireBtn.x, p.y - this.fireBtn.y);
      if (d < R * 1.6) {
        this.fireBtn.id = t.identifier;
        this.fireBtn.down = true;
        return;
      }
    }

    const stick = p.x < this.viewW * 0.5 ? this.move : this.aim;
    if (stick.id !== null) return; // ese pulgar ya está ocupado
    stick.id = t.identifier;
    stick.ox = stick.x = p.x;
    stick.oy = stick.y = p.y;
    stick.dx = stick.dy = stick.mag = 0;
  }

  #moveTouch(t) {
    const p = this.#local(t);
    for (const stick of [this.move, this.aim]) {
      if (stick.id !== t.identifier) continue;
      stick.x = p.x;
      stick.y = p.y;
      let dx = p.x - stick.ox, dy = p.y - stick.oy;
      const len = Math.hypot(dx, dy);
      const R = Config.touch.stickRadius;
      if (len > 1e-4) {
        stick.dx = dx / len;
        stick.dy = dy / len;
        stick.mag = clamp(len / R, 0, 1);
      }
      // Si el dedo se va más allá del radio, el origen le sigue. Evita el
      // clásico "he perdido el stick" al deslizar de más en una persecución.
      if (len > R) {
        stick.ox = p.x - stick.dx * R;
        stick.oy = p.y - stick.dy * R;
      }
      return;
    }
  }

  #end(t) {
    if (this.fireBtn.id === t.identifier) {
      this.fireBtn.id = null;
      this.fireBtn.down = false;
      return;
    }
    for (const stick of [this.move, this.aim]) {
      if (stick.id !== t.identifier) continue;
      // 'release': soltar es disparar. Se marca aquí y Game lo consume.
      if (stick === this.aim && Config.touch.fireMode === 'release' && stick.mag > Config.touch.deadzone) {
        this.releaseFire = true;
      }
      stick.id = null;
      stick.dx = stick.dy = stick.mag = 0;
      return;
    }
  }

  /** Vuelca el estado de los dedos en el Input unificado. */
  update() {
    if (!this.input.touchActive) return;
    const dz = Config.touch.deadzone;

    const m = this.move.mag > dz ? (this.move.mag - dz) / (1 - dz) : 0;
    this.input.moveX = this.move.dx * m;
    this.input.moveY = this.move.dy * m;

    if (this.aim.mag > dz) {
      this.input.aimMode = 'direction';
      this.input.aimDirX = this.aim.dx;
      this.input.aimDirY = this.aim.dy;
      this.input.aimStrength = (this.aim.mag - dz) / (1 - dz);
    } else {
      this.input.aimStrength = 0;
    }

    switch (Config.touch.fireMode) {
      case 'auto':
        this.input.firing = this.aim.mag > Config.touch.fireThreshold;
        break;
      case 'button':
        this.input.firing = this.fireBtn.down;
        break;
      case 'release':
        this.input.firing = !!this.releaseFire;
        this.releaseFire = false;
        break;
    }
  }

  /** Dibuja los sticks. Discreto: la pantalla es del juego, no del HUD. */
  render(ctx) {
    if (!this.input.touchActive) return;
    const a = Config.touch.hudAlpha;
    const R = Config.touch.stickRadius;

    for (const stick of [this.move, this.aim]) {
      if (stick.id === null) continue;
      ctx.strokeStyle = `rgba(150,200,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(stick.ox, stick.oy, R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(190,225,255,${a * 2.2})`;
      ctx.beginPath();
      ctx.arc(stick.ox + stick.dx * stick.mag * R, stick.oy + stick.dy * stick.mag * R, R * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    if (Config.touch.fireMode === 'button') {
      const br = Config.touch.buttonRadius;
      ctx.strokeStyle = `rgba(255,140,110,${this.fireBtn.down ? a * 4 : a * 2})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.fireBtn.x, this.fireBtn.y, br, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  destroy() {
    this.canvas.removeEventListener('touchstart', this._onStart);
    this.canvas.removeEventListener('touchmove', this._onMove);
    this.canvas.removeEventListener('touchend', this._onEnd);
    this.canvas.removeEventListener('touchcancel', this._onEnd);
  }
}
