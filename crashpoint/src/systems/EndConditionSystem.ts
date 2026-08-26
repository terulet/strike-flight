const STABLE_SPEED_THRESHOLD = 0.6; // Matter velocity units — below this, treat a body as "settled"
const STABLE_HOLD_MS = 700; // must stay settled this long before we call it done
const SAFETY_TIMEOUT_MS = 12000; // hard cap after the last shot, in case something never sleeps

/**
 * Decides when a run is over (section 27): not immediately after the last shot, but once the
 * physics has visibly settled (or a safety timeout fires so a stray wobbling body can't stall
 * the game forever).
 */
export class EndConditionSystem {
  private stableSinceMs: number | null = null;
  private lastShotAtMs: number | null = null;

  notifyShotFired(nowMs: number): void {
    this.lastShotAtMs = nowMs;
    this.stableSinceMs = null;
  }

  /** Call every fixed tick with the current max speed among dynamic bodies + whether any shots remain unfired. */
  update(nowMs: number, maxBodySpeed: number, shotsRemaining: number, activeProjectiles: number): boolean {
    if (this.lastShotAtMs === null) return false; // nothing fired yet — can't be "finished"
    if (shotsRemaining > 0) return false; // player can still act
    if (activeProjectiles > 0) return false;

    if (nowMs - this.lastShotAtMs >= SAFETY_TIMEOUT_MS) return true;

    if (maxBodySpeed < STABLE_SPEED_THRESHOLD) {
      if (this.stableSinceMs === null) this.stableSinceMs = nowMs;
      if (nowMs - this.stableSinceMs >= STABLE_HOLD_MS) return true;
    } else {
      this.stableSinceMs = null;
    }
    return false;
  }

  reset(): void {
    this.stableSinceMs = null;
    this.lastShotAtMs = null;
  }
}
