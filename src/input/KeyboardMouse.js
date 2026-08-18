/**
 * Teclado + ratón. Es nuestra herramienta de pruebas, no la plataforma
 * objetivo: aquí no se inventa nada que el táctil no pueda reproducir.
 *
 *   WASD / flechas   moverse
 *   ratón            apuntar
 *   clic             disparar
 *   R                recargar
 *   ESPACIO / ENTER  reiniciar el intento
 *   F1 / º           debug        F2   panel de parámetros
 */

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export class KeyboardMouse {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.input = input;
    this.down = new Set();

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      if (e.code in MOVE_KEYS || e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyR') this.input.reloadQueued = true;
      if (e.code === 'Space' || e.code === 'Enter') this.input.restartQueued = true;
      this.input.tapped = true;
      if (e.code === 'F1' || e.code === 'Backquote' || e.code === 'IntlBackslash') {
        this.input.debugToggled = true;
        e.preventDefault();
      }
      if (e.code === 'F2') { this.input.paramPanelToggled = true; e.preventDefault(); }
      this.#applyMove();
    };

    this._onKeyUp = (e) => { this.down.delete(e.code); this.#applyMove(); };
    this._onBlur = () => { this.down.clear(); this.#applyMove(); this.input.firing = false; };

    this._onMove = (e) => {
      if (this.input.touchActive) return;
      const r = this.canvas.getBoundingClientRect();
      this.input.aimMode = 'point';
      this.input.aimPointX = e.clientX - r.left;
      this.input.aimPointY = e.clientY - r.top;
    };

    this._onDown = (e) => {
      if (e.button !== 0 || this.input.touchActive) return;
      this._onMove(e);
      this.input.tapped = true;
      this.input.firing = true;
      this.input.aimStrength = 1;
    };
    this._onUp = (e) => { if (e.button === 0) this.input.firing = false; };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMove);
    canvas.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  #applyMove() {
    if (this.input.touchActive) return;
    let x = 0, y = 0;
    for (const code of this.down) {
      const v = MOVE_KEYS[code];
      if (v) { x += v[0]; y += v[1]; }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.input.moveX = x;
    this.input.moveY = y;
  }

  endFrame() {}

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mouseup', this._onUp);
  }
}
