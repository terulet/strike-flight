import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { CausalityEdge, DestructionEventKind } from '../core/types';

const CHAIN_WINDOW_MS = 1800;
const CHAIN_WORTHY: DestructionEventKind[] = ['break', 'explosion', 'collapse', 'mega_collapse'];

/**
 * Groups destructive events into chains using a simple time-window heuristic (section 17):
 * consecutive structural breaks/explosions within CHAIN_WINDOW_MS of each other belong to the
 * same chain. Not a full causal graph, but enough for combos, telemetry and "CHAIN x4" UI.
 */
export class ChainReactionSystem {
  private chainLength = 0;
  private chainStartMs = 0;
  private lastEventMs = -Infinity;
  private active = false;
  bestChain = 0;
  /** Sum over every closed chain of (length - 1) — feeds ScoreSystem's chain bonus. */
  totalChainLinks = 0;
  private edges: CausalityEdge[] = [];

  constructor(private bus: EventBus<GameEvents>, private now: () => number) {
    bus.on('structural_break', (e) => this.registerEvent('break', e.causeId, e.pieceId));
    bus.on('explosion', (e) => this.registerEvent('explosion', e.causeId, e.pieceId));
  }

  private registerEvent(kind: DestructionEventKind, causeId: string, effectId: string): void {
    if (!CHAIN_WORTHY.includes(kind)) return;
    const nowMs = this.now();
    this.edges.push({ causeId, effectId, kind, atMs: nowMs });

    if (!this.active) {
      this.active = true;
      this.chainLength = 1;
      this.chainStartMs = nowMs;
      this.lastEventMs = nowMs;
      this.bus.emit('chain_start', { rootCauseId: causeId });
      return;
    }

    if (nowMs - this.lastEventMs <= CHAIN_WINDOW_MS) {
      this.chainLength += 1;
      this.lastEventMs = nowMs;
      this.bus.emit('chain_event', {
        edge: { causeId, effectId, kind, atMs: nowMs },
        chainLength: this.chainLength,
      });
      if (this.chainLength >= 3) {
        this.bus.emit('slow_motion_trigger', {
          reason: 'chain_reaction',
          strength: 0.45,
          durationMs: 500,
        });
      }
    } else {
      this.closeChain(nowMs);
      this.chainLength = 1;
      this.chainStartMs = nowMs;
      this.lastEventMs = nowMs;
      this.bus.emit('chain_start', { rootCauseId: causeId });
    }
  }

  /** Call every fixed tick so a chain that goes quiet gets closed even without a new event. */
  update(nowMs: number): void {
    if (this.active && nowMs - this.lastEventMs > CHAIN_WINDOW_MS) {
      this.closeChain(nowMs);
    }
  }

  private closeChain(nowMs: number): void {
    if (!this.active) return;
    this.active = false;
    this.bestChain = Math.max(this.bestChain, this.chainLength);
    if (this.chainLength >= 2) this.totalChainLinks += this.chainLength - 1;
    this.bus.emit('chain_end', { chainLength: this.chainLength, durationMs: nowMs - this.chainStartMs });
    this.chainLength = 0;
  }

  getCurrentChainLength(): number {
    return this.active ? this.chainLength : 0;
  }

  getCausalityLog(): readonly CausalityEdge[] {
    return this.edges;
  }

  reset(): void {
    this.chainLength = 0;
    this.chainStartMs = 0;
    this.lastEventMs = -Infinity;
    this.active = false;
    this.bestChain = 0;
    this.totalChainLinks = 0;
    this.edges = [];
  }
}
