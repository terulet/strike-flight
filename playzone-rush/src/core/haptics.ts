/**
 * Vibracion. En iOS/WKWebView navigator.vibrate no existe todavia, pero el
 * punto de llamada queda listo: cuando empaquetemos con Capacitor solo hay que
 * cambiar la implementacion de esta clase por el plugin nativo de haptics.
 */
export type HapticPattern = 'tick' | 'light' | 'medium' | 'heavy' | 'success' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tick: 8,
  light: 12,
  medium: 24,
  heavy: 40,
  success: [18, 40, 26],
  error: [40, 60, 40],
};

export class Haptics {
  private enabled: boolean;
  constructor(enabled = true) {
    this.enabled = enabled;
  }
  setEnabled(value: boolean): void {
    this.enabled = value;
  }
  fire(pattern: HapticPattern): void {
    if (!this.enabled) return;
    const nav = globalThis.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    if (typeof nav?.vibrate !== 'function') return;
    try {
      nav.vibrate(PATTERNS[pattern]);
    } catch {
      /* da igual */
    }
  }
}
