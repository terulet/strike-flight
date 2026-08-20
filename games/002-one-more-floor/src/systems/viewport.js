/**
 * Keeps a fixed logical resolution (360x780 = 9:19.5) regardless of device.
 * The canvas is letterboxed inside the window, backed by a DPR-scaled
 * bitmap, and every draw call works in logical units.
 *
 * Device safe areas are read from a hidden CSS probe and converted to
 * logical units so the HUD can stay out of the notch / home indicator.
 */
import { VIEW } from '../config.js';

export class Viewport {
  constructor(canvas, probe, { maxDpr = 2 } = {}) {
    this.canvas = canvas;
    this.probe = probe;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.maxDpr = maxDpr;
    this.scale = 1;
    this.dpr = 1;
    this.cssW = VIEW.W;
    this.cssH = VIEW.H;
    this.safe = { top: 0, bottom: 0, left: 0, right: 0 };
    this.resize();
  }

  _readSafeArea() {
    if (!this.probe || typeof getComputedStyle !== 'function') return;
    const cs = getComputedStyle(this.probe);
    const px = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    };
    this.safe.top = px(cs.paddingTop);
    this.safe.bottom = px(cs.paddingBottom);
    this.safe.left = px(cs.paddingLeft);
    this.safe.right = px(cs.paddingRight);
  }

  resize() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    // Fit a 9:19.5 box inside the window (letterbox on wide screens).
    let w = winW;
    let h = w / VIEW.ASPECT;
    if (h > winH) {
      h = winH;
      w = h * VIEW.ASPECT;
    }
    this.cssW = w;
    this.cssH = h;
    const stage = this.canvas.parentElement;
    if (stage) {
      stage.style.width = `${w}px`;
      stage.style.height = `${h}px`;
    }
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const bw = Math.round(w * this.dpr);
    const bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.scale = bw / VIEW.W;
    this._readSafeArea();
    // Safe-area insets are in CSS px of the *window*; convert to logical units.
    const cssToLogical = VIEW.W / (w || 1);
    this.safeTop = this.safe.top * cssToLogical;
    this.safeBottom = this.safe.bottom * cssToLogical;
    this.hudTop = VIEW.HUD_TOP + this.safeTop;
    this.hudBottom = VIEW.HUD_BOTTOM + this.safeBottom;
    this.ctx.imageSmoothingEnabled = true;
  }

  /** Applies the logical-units transform for a frame. */
  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    return ctx;
  }

  /** Converts a client (page) coordinate into logical game coordinates. */
  toLogical(clientX, clientY, out = { x: 0, y: 0 }) {
    const rect = this.canvas.getBoundingClientRect();
    out.x = ((clientX - rect.left) / (rect.width || 1)) * VIEW.W;
    out.y = ((clientY - rect.top) / (rect.height || 1)) * VIEW.H;
    return out;
  }
}
