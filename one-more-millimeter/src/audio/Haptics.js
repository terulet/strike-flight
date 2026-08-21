/** Haptics — navigator.vibrate with a silent fallback everywhere else. */
export class Haptics {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this.last = 0;
  }
  setEnabled(on) { this.enabled = !!on; }
  buzz(pattern) {
    if (!this.enabled || !this.supported || pattern == null) return false;
    const now = Date.now();
    if (now - this.last < 40) return false; // never machine-gun the motor
    this.last = now;
    try { return navigator.vibrate(pattern); } catch (e) { return false; }
  }
  stop() { if (this.supported) { try { navigator.vibrate(0); } catch (e) {} } }
}
