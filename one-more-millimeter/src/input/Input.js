/**
 * Input — one gesture, everywhere: hold to charge, release to throw.
 *
 * Mobile hazards handled here (spec 82):
 *   - only the first pointer counts, a second finger is ignored,
 *   - pointercancel / pointerleave / blur all release safely,
 *   - the browser never gets to scroll, zoom or long-press-select the play area,
 *   - going to background cancels the hold instead of banking a huge charge (spec 84).
 */
export class Input {
  constructor(target, handlers = {}) {
    this.target = target;
    this.h = handlers;
    this.pointerId = null;
    this.keyDown = false;
    this.enabled = true;
    this._bound = [];
    this._attach();
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!on) this._cancel('disabled');
  }

  _on(el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    this._bound.push([el, type, fn, opts]);
  }

  destroy() {
    for (const [el, type, fn, opts] of this._bound) el.removeEventListener(type, fn, opts);
    this._bound.length = 0;
  }

  /** UI chrome must never double as a throw. */
  _blocked(e) {
    const t = e.target;
    if (!t || !t.closest) return false;
    return !!t.closest('button, a, input, select, .modal, .result-card, .debug, .link-btn');
  }

  _attach() {
    const el = this.target;
    this._on(el, 'pointerdown', (e) => {
      if (!this.enabled || this._blocked(e)) return;
      if (this.pointerId !== null) return; // ignore extra fingers
      this.pointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      this.h.onPress && this.h.onPress(e);
    }, { passive: false });

    const up = (e) => {
      if (this.pointerId === null || e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      this.h.onRelease && this.h.onRelease(e);
    };
    this._on(el, 'pointerup', up, { passive: false });

    this._on(el, 'pointercancel', (e) => {
      if (this.pointerId === null || e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this._cancel('pointercancel');
    });

    // Gesture suppression
    this._on(el, 'touchstart', (e) => { if (!this._blocked(e) && e.touches.length > 1) e.preventDefault(); }, { passive: false });
    this._on(el, 'touchmove', (e) => { if (!this._blocked(e)) e.preventDefault(); }, { passive: false });
    this._on(el, 'contextmenu', (e) => e.preventDefault());
    this._on(el, 'dblclick', (e) => e.preventDefault());
    this._on(el, 'gesturestart', (e) => e.preventDefault());

    // Keyboard: space / enter
    this._on(window, 'keydown', (e) => {
      if (!this.enabled) return;
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        const active = document.activeElement;
        if (active && active.tagName === 'BUTTON') return; // let the button take it
        e.preventDefault();
        this.keyDown = true;
        this.h.onPress && this.h.onPress(e);
      }
    });
    this._on(window, 'keyup', (e) => {
      if (!this.keyDown) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        this.keyDown = false;
        this.h.onRelease && this.h.onRelease(e);
      }
    });

    this._on(window, 'blur', () => this._cancel('blur'));
    this._on(document, 'visibilitychange', () => {
      if (document.visibilityState !== 'visible') this._cancel('hidden');
      this.h.onVisibility && this.h.onVisibility(document.visibilityState === 'visible');
    });
  }

  _cancel(reason) {
    const had = this.pointerId !== null || this.keyDown;
    this.pointerId = null;
    this.keyDown = false;
    if (had) this.h.onCancel && this.h.onCancel(reason);
  }
}
