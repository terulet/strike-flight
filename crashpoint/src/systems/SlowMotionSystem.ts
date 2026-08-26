import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { GameLoop } from '../core/GameLoop';

/**
 * Contextual slow motion (section 22). Never runs continuously — only for a bounded window
 * after a system emits `slow_motion_trigger` (critical break, chain>=3, near-total collapse).
 */
export class SlowMotionSystem {
  private remainingMs = 0;
  private strength = 1;

  constructor(private loop: GameLoop, bus: EventBus<GameEvents>) {
    bus.on('slow_motion_trigger', (e) => this.trigger(e.strength, e.durationMs));
  }

  trigger(strength: number, durationMs: number): void {
    // A stronger/longer request overrides a weaker one already running; a weaker one never cuts a stronger one short.
    if (strength <= this.strength && this.remainingMs > 0) return;
    this.strength = strength;
    this.remainingMs = durationMs;
    this.loop.timeScale = strength;
  }

  /** Advance by real (unscaled) time so the slow-mo window itself doesn't get slowed down. */
  update(realDtMs: number): void {
    if (this.remainingMs <= 0) return;
    this.remainingMs -= realDtMs;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.strength = 1;
      this.loop.timeScale = 1;
    }
  }

  reset(): void {
    this.remainingMs = 0;
    this.strength = 1;
    this.loop.timeScale = 1;
  }
}
