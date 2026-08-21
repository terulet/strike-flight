/**
 * Telemetry — a decoupled event log. Today it writes to memory (and the debug
 * console); tomorrow `addSink` takes an analytics transport. Nothing in the game
 * ever calls an analytics SDK directly.
 */
export const EVENTS = {
  GAME_START: 'game_start',
  MODE_START: 'mode_start',
  CHALLENGE_START: 'challenge_start',
  SHOT_CHARGE_START: 'shot_charge_start',
  SHOT_RELEASE: 'shot_release',
  NEAR_EDGE_ENTER: 'near_edge_enter',
  SHOT_STOP: 'shot_stop',
  SHOT_FALL: 'shot_fall',
  NEW_BEST: 'new_best',
  RIVAL_BEATEN: 'rival_beaten',
  RETRY: 'retry',
  MODE_END: 'mode_end',
  SESSION_END: 'session_end',
  SCREEN: 'screen',
  UNLOCK: 'unlock',
};

export class Telemetry {
  constructor({ max = 400, debug = false } = {}) {
    this.buffer = [];
    this.max = max;
    this.debug = debug;
    this.sinks = [];
    this.sessionId = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    this.startedAt = Date.now();
    this.counts = Object.create(null);
  }

  addSink(fn) { this.sinks.push(fn); return () => this.sinks.splice(this.sinks.indexOf(fn), 1); }

  log(type, props = {}) {
    const ev = { type, t: Date.now() - this.startedAt, session: this.sessionId, ...props };
    this.buffer.push(ev);
    if (this.buffer.length > this.max) this.buffer.shift();
    this.counts[type] = (this.counts[type] || 0) + 1;
    if (this.debug && typeof console !== 'undefined') console.debug('[tel]', type, props);
    for (const s of this.sinks) { try { s(ev); } catch (e) { /* a sink must never break the game */ } }
    return ev;
  }

  /** Retention-shaped rollups (spec 57) computed from the raw buffer. */
  summary() {
    const c = this.counts;
    const shots = c[EVENTS.SHOT_RELEASE] || 0;
    const falls = c[EVENTS.SHOT_FALL] || 0;
    return {
      sessionId: this.sessionId,
      durationMs: Date.now() - this.startedAt,
      shots,
      falls,
      fallRate: shots ? falls / shots : 0,
      retries: c[EVENTS.RETRY] || 0,
      retryRate: shots ? (c[EVENTS.RETRY] || 0) / shots : 0,
      records: c[EVENTS.NEW_BEST] || 0,
      rivalsBeaten: c[EVENTS.RIVAL_BEATEN] || 0,
      nearEdge: c[EVENTS.NEAR_EDGE_ENTER] || 0,
    };
  }

  export() { return this.buffer.slice(); }
  clear() { this.buffer.length = 0; }
}
