/**
 * One-finger input.
 *
 * Verbs the game understands:
 *   PRESS        -> jump (fires on pointer DOWN: zero added latency)
 *   HOLD         -> keep braking once grounded (stand still and wait)
 *   RELEASE      -> resume running
 *   SWIPE DOWN   -> dive / slam
 *   SWIPE L / R  -> face that way (the bot runs on its own; this overrides it)
 *
 * Keyboard mirrors the same verbs so the prototype is testable on a desktop.
 * Events are queued as counters and consumed by the fixed-step update, so a
 * tap that happens between two simulation steps is never dropped.
 */
import { VIEW } from '../config.js';

const SWIPE_DIST = 26; // logical px
const SWIPE_TIME = 0.3; // seconds

export class Input {
  constructor(viewport, target = window) {
    this.viewport = viewport;
    this.target = target;
    this.held = false;
    this.holdTime = 0;
    this.pressCount = 0;
    this.releaseCount = 0;
    this.swipeDownCount = 0;
    this.swipeDirCount = 0;
    this.swipeDir = 0;
    this.x = VIEW.W / 2;
    this.y = VIEW.H / 2;
    this.downX = 0;
    this.downY = 0;
    this.downTime = 0;
    this.swipeArmed = false;
    this.lastPointerType = 'mouse';
    this._tmp = { x: 0, y: 0 };
    this._keysDown = new Set();
    this._bind();
  }

  _now() {
    return performance.now() / 1000;
  }

  _bind() {
    const canvas = this.viewport.canvas;
    const opts = { passive: false };

    const onDown = (e) => {
      if (e.pointerType) this.lastPointerType = e.pointerType;
      if (e.isPrimary === false) return;
      e.preventDefault();
      this.viewport.toLogical(e.clientX, e.clientY, this._tmp);
      this.x = this._tmp.x;
      this.y = this._tmp.y;
      this._press();
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!this.held) return;
      this.viewport.toLogical(e.clientX, e.clientY, this._tmp);
      this.x = this._tmp.x;
      this.y = this._tmp.y;
      if (this.swipeArmed && this._now() - this.downTime < SWIPE_TIME) {
        const dy = this.y - this.downY;
        const dx = this.x - this.downX;
        if (dy > SWIPE_DIST && dy > Math.abs(dx)) {
          this.swipeDownCount++;
          this.swipeArmed = false;
        } else if (Math.abs(dx) > SWIPE_DIST && Math.abs(dx) > Math.abs(dy)) {
          this.swipeDir = dx > 0 ? 1 : -1;
          this.swipeDirCount++;
          this.swipeArmed = false;
        }
      }
    };
    const onUp = (e) => {
      if (e && e.isPrimary === false) return;
      this._release();
    };

    canvas.addEventListener('pointerdown', onDown, opts);
    canvas.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onUp, opts);
    window.addEventListener('blur', () => this._release());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._release();
    });
    // Kill iOS double-tap zoom / long-press callouts inside the play area.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dblclick', (e) => e.preventDefault());

    this.target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') {
        e.preventDefault();
        this._keysDown.add('jump');
        this._press();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault();
        this.swipeDownCount++;
      } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        e.preventDefault();
        this.swipeDir = -1;
        this.swipeDirCount++;
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        e.preventDefault();
        this.swipeDir = 1;
        this.swipeDirCount++;
      }
    });
    this.target.addEventListener('keyup', (e) => {
      const k = e.key;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') {
        this._keysDown.delete('jump');
        this._release();
      }
    });
  }

  _press() {
    if (this.held) return;
    this.held = true;
    this.holdTime = 0;
    this.pressCount++;
    this.downX = this.x;
    this.downY = this.y;
    this.downTime = this._now();
    this.swipeArmed = true;
  }

  _release() {
    if (!this.held) return;
    this.held = false;
    this.releaseCount++;
    this.swipeArmed = false;
  }

  update(dt) {
    if (this.held) this.holdTime += dt;
    else this.holdTime = 0;
  }

  /** True once per press. */
  consumePress() {
    if (this.pressCount > 0) {
      this.pressCount--;
      return true;
    }
    return false;
  }

  consumeRelease() {
    if (this.releaseCount > 0) {
      this.releaseCount--;
      return true;
    }
    return false;
  }

  consumeSwipeDown() {
    if (this.swipeDownCount > 0) {
      this.swipeDownCount--;
      return true;
    }
    return false;
  }

  /** Returns -1, 1 or 0 — the direction the player asked to face. */
  consumeSwipeDir() {
    if (this.swipeDirCount > 0) {
      this.swipeDirCount--;
      return this.swipeDir;
    }
    return 0;
  }

  /** Drops anything buffered — used on state changes so a tap never double-fires. */
  flush() {
    this.pressCount = 0;
    this.releaseCount = 0;
    this.swipeDownCount = 0;
    this.swipeDirCount = 0;
  }
}
