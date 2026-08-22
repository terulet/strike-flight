/**
 * Telemetry — local, session-scoped, and built to answer exactly one question:
 * WHAT MAKES SOMEBODY TAKE ANOTHER SHOT?
 *
 * So a retry is never counted as just "a retry". Every result is classified before
 * the next attempt starts, and the retry is attributed to that classification:
 * losing to a rival, falling by a hair, missing your own best, and so on. The
 * report then reads as a rate per cause, which is the number the tester round is
 * supposed to produce.
 *
 * Everything stays on the device. No network, no analytics SDK, no identifiers
 * beyond a locally generated UUID. `addSink` is the seam where a real transport
 * would attach later.
 */
export const EVENTS = {
  SESSION_START: 'session_start',
  GAME_START: 'game_start',
  NAME_SET: 'name_set',
  MODE_START: 'mode_start',
  CHALLENGE_START: 'challenge_start',
  SHOT_CHARGE_START: 'charge_start',
  SHOT_RELEASE: 'shot_release',
  NEAR_EDGE_ENTER: 'near_edge_enter',
  SHOT_STOP: 'shot_stop',
  SHOT_FALL: 'shot_fall',
  NEAR_MISS: 'near_miss',
  NEW_BEST: 'personal_best',
  RIVAL_BEATEN: 'rival_beaten',
  RIVAL_LOSS: 'rival_loss',
  RESULT_SHOWN: 'result_shown',
  RETRY: 'retry',
  MODE_END: 'mode_end',
  SESSION_END: 'session_end',
  SCREEN: 'screen',
  UNLOCK: 'unlock',
  REPORT_OPENED: 'report_opened',
  REPORT_COPIED: 'report_copied',
};

/** How a shot ended, from the player's point of view. Drives retry attribution. */
export const RESULT_TYPE = {
  FALL: 'fall',
  NEAR_MISS_FALL: 'near_miss_fall',
  RIVAL_LOSS: 'rival_loss',
  RIVAL_WIN: 'rival_win',
  PERSONAL_BEST: 'personal_best',
  PERSONAL_MISS: 'personal_miss',
  NORMAL_STOP: 'normal_stop',
};

export const RESULT_TYPES = Object.values(RESULT_TYPE);

/**
 * One shot, one label. Order matters: the rival context outranks the personal one,
 * because "I lost to Marc" is what the player actually felt.
 */
export function classifyResult(r) {
  if (r.fell) return r.nearMiss ? RESULT_TYPE.NEAR_MISS_FALL : RESULT_TYPE.FALL;
  if (r.hadTarget) return r.beatTarget ? RESULT_TYPE.RIVAL_WIN : RESULT_TYPE.RIVAL_LOSS;
  if (r.isPersonalBest) return RESULT_TYPE.PERSONAL_BEST;
  if (r.hadPreviousBest) return RESULT_TYPE.PERSONAL_MISS;
  return RESULT_TYPE.NORMAL_STOP;
}

export const SCHEMA_VERSION = 1;
const CAPS = { sessions: 25, events: 500, attempts: 250 };
const PERSIST_THROTTLE_MS = 1500;

const emptyCounts = () => RESULT_TYPES.reduce((a, t) => ((a[t] = 0), a), {});

export class Telemetry {
  /**
   * @param {object} o
   * @param {{load:Function, save:Function, clear:Function}} [o.storage] injected persistence
   */
  constructor(o = {}) {
    this.debug = !!o.debug;
    this.caps = { ...CAPS, ...(o.caps || {}) };
    this.storage = o.storage || null;
    this.sinks = [];
    this.now = o.now || (() => Date.now());

    this.sessions = [];
    this.session = null;
    this.pending = null;          // { type, at, meta }
    this._lastPersist = 0;
    this._persistTimer = null;

    if (this.storage) {
      try {
        const loaded = this.storage.load();
        if (Array.isArray(loaded)) this.sessions = loaded.slice(-this.caps.sessions);
      } catch (e) { this.sessions = []; }
    }
  }

  addSink(fn) {
    this.sinks.push(fn);
    return () => this.sinks.splice(this.sinks.indexOf(fn), 1);
  }

  // ------------------------------------------------------------------ SESSION
  beginSession(meta = {}) {
    const startedAt = this.now();
    this.session = {
      sessionId: `s${startedAt.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      playerId: meta.playerId || null,
      playerName: meta.playerName || null,
      startedAt,
      lastEventAt: startedAt,
      endedAt: null,
      appVersion: meta.appVersion || null,
      physicsVersion: meta.physicsVersion || null,
      build: meta.build || null,
      language: meta.language || null,
      viewport: meta.viewport || null,
      dpr: meta.dpr || null,
      device: meta.device || null,
      challengeId: meta.challengeId || null,
      mode: meta.mode || null,
      /** 'solo' | 'rival' — the whole point of the A/B in the tester round. */
      arm: meta.arm || 'solo',
      rivals: meta.rivals || [],
      results: emptyCounts(),
      retries: emptyCounts(),
      retryDelays: [],
      attempts: [],
      events: [],
      droppedEvents: 0,
      droppedAttempts: 0,
      counts: Object.create(null),
    };
    this.sessions.push(this.session);
    while (this.sessions.length > this.caps.sessions) this.sessions.shift();
    this.log(EVENTS.SESSION_START, {
      arm: this.session.arm, challenge: this.session.challengeId, mode: this.session.mode,
    });
    this._persist(true);
    return this.session;
  }

  /** Late-arriving identity (the player typed their name after boot). */
  setPlayer(playerId, playerName) {
    if (!this.session) return;
    this.session.playerId = playerId || this.session.playerId;
    this.session.playerName = playerName || this.session.playerName;
    this._persist(true);
  }

  /** Context that only becomes known once a mode starts. */
  setContext(ctx = {}) {
    if (!this.session) return;
    if (ctx.challengeId) this.session.challengeId = ctx.challengeId;
    if (ctx.mode) this.session.mode = ctx.mode;
    if (ctx.arm) this.session.arm = ctx.arm;
    if (ctx.rivals) this.session.rivals = ctx.rivals;
  }

  endSession(reason = 'hidden') {
    if (!this.session) return;
    this.session.endedAt = this.now();
    this.log(EVENTS.SESSION_END, { reason, ...this.summary() });
    this._persist(true);
  }

  // -------------------------------------------------------------------- LOG
  log(type, props = {}) {
    const at = this.now();
    const s = this.session;
    const ev = { type, at, ...props };
    if (s) {
      s.lastEventAt = at;
      s.counts[type] = (s.counts[type] || 0) + 1;
      s.events.push({ t: at - s.startedAt, type, ...props });
      if (s.events.length > this.caps.events) { s.events.shift(); s.droppedEvents++; }
    }
    if (this.debug && typeof console !== 'undefined') console.debug('[tel]', type, props);
    for (const sink of this.sinks) { try { sink(ev); } catch (e) { /* a sink never breaks the game */ } }
    return ev;
  }

  /** One shot's full record (spec 18). Reuses the replay fields, does not duplicate them. */
  recordAttempt(rec) {
    const s = this.session;
    if (!s) return;
    s.attempts.push(rec);
    if (s.attempts.length > this.caps.attempts) { s.attempts.shift(); s.droppedAttempts++; }
    this._persist();
  }

  // ------------------------------------------------------------ RETRY ENGINE
  /**
   * Called once per finished shot, when the result is put in front of the player.
   * Opens the window that the next attempt will be attributed to.
   */
  noteResult(type, meta = {}) {
    const s = this.session;
    if (!s) return type;
    if (!(type in s.results)) s.results[type] = 0;
    s.results[type] += 1;
    this.pending = { type, at: this.now(), shownAt: null, meta };
    this._persist();
    return type;
  }

  /**
   * The result panel actually reached the player's eyes. The retry clock starts
   * here, not when the physics settled, so the presentation delay is not counted
   * as hesitation.
   */
  markResultShown() {
    if (!this.pending) return;
    this.pending.shownAt = this.now();
    this.log(EVENTS.RESULT_SHOWN, { result: this.pending.type, ...this.pending.meta });
  }

  /**
   * Called when the player commits to another shot. Attributes the retry to
   * whatever the previous result was, with the delay it took them to decide.
   */
  noteRetry() {
    const s = this.session;
    if (!s || !this.pending) return null;
    const { type } = this.pending;
    const from = this.pending.shownAt || this.pending.at;
    const delayMs = Math.max(0, this.now() - from);
    if (!(type in s.retries)) s.retries[type] = 0;
    s.retries[type] += 1;
    s.retryDelays.push({ after: type, delayMs });
    if (s.retryDelays.length > this.caps.attempts) s.retryDelays.shift();
    this.pending = null;
    this.log(EVENTS.RETRY, { after: type, delayMs });
    this._persist();
    return { after: type, delayMs };
  }

  /** The player walked away instead of retrying; the pending result stays uncounted. */
  abandonPending(reason = 'quit') {
    if (!this.pending) return;
    this.log(EVENTS.MODE_END, { after: this.pending.type, reason });
    this.pending = null;
  }

  // ---------------------------------------------------------------- SUMMARY
  summary(session = this.session) {
    const s = session;
    if (!s) return null;
    const results = s.results;
    const retries = s.retries;
    const total = (o) => RESULT_TYPES.reduce((a, t) => a + (o[t] || 0), 0);
    const rate = (t) => (results[t] ? retries[t] / results[t] : null);
    const attempts = s.attempts.length + s.droppedAttempts;
    const scores = s.attempts.filter((a) => !a.fell && Number.isFinite(a.scoreMm)).map((a) => a.scoreMm);
    const delays = s.retryDelays.map((d) => d.delayMs).sort((a, b) => a - b);

    return {
      sessionId: s.sessionId,
      arm: s.arm,
      durationMs: (s.endedAt || s.lastEventAt) - s.startedAt,
      attempts,
      successfulStops: scores.length,
      falls: (results[RESULT_TYPE.FALL] || 0) + (results[RESULT_TYPE.NEAR_MISS_FALL] || 0),
      nearMissFalls: results[RESULT_TYPE.NEAR_MISS_FALL] || 0,
      personalBests: results[RESULT_TYPE.PERSONAL_BEST] || 0,
      rivalsBeaten: results[RESULT_TYPE.RIVAL_WIN] || 0,
      rivalLosses: results[RESULT_TYPE.RIVAL_LOSS] || 0,
      bestMm: scores.length ? Math.min(...scores) : null,
      results: { ...results },
      retries: { ...retries },
      /** The headline numbers. null means "it never happened", never 0. */
      retryAfterFall: ratePair(results, retries, [RESULT_TYPE.FALL, RESULT_TYPE.NEAR_MISS_FALL]),
      retryAfterNearMissFall: rate(RESULT_TYPE.NEAR_MISS_FALL),
      retryAfterRivalLoss: rate(RESULT_TYPE.RIVAL_LOSS),
      retryAfterRivalWin: rate(RESULT_TYPE.RIVAL_WIN),
      retryAfterPersonalMiss: rate(RESULT_TYPE.PERSONAL_MISS),
      retryAfterPersonalBest: rate(RESULT_TYPE.PERSONAL_BEST),
      retryAfterNormalStop: rate(RESULT_TYPE.NORMAL_STOP),
      retryRateOverall: total(results) ? total(retries) / total(results) : null,
      medianRetryDelayMs: delays.length ? delays[Math.floor(delays.length / 2)] : null,
      truncated: s.droppedEvents > 0 || s.droppedAttempts > 0,
    };
  }

  /** Rollup across every stored session, split by solo vs rival. */
  aggregate() {
    const arms = { solo: [], rival: [] };
    for (const s of this.sessions) (arms[s.arm] || arms.solo).push(this.summary(s));
    const roll = (list) => {
      if (!list.length) return null;
      const sum = (k) => list.reduce((a, x) => a + (x[k] || 0), 0);
      const attempts = sum('attempts');
      return {
        sessions: list.length,
        attempts,
        attemptsPerSession: attempts / list.length,
        falls: sum('falls'),
        rivalsBeaten: sum('rivalsBeaten'),
        personalBests: sum('personalBests'),
        medianDurationMs: median(list.map((x) => x.durationMs)),
      };
    };
    return { solo: roll(arms.solo), rival: roll(arms.rival), sessions: this.sessions.length };
  }

  // ----------------------------------------------------------------- REPORT
  buildReport(meta = {}) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: this.now(),
      appVersion: meta.appVersion || null,
      physicsVersion: meta.physicsVersion || null,
      build: meta.build || null,
      player: meta.player || null,
      currentSummary: this.summary(),
      aggregate: this.aggregate(),
      sessions: this.sessions.map((s) => ({
        ...s,
        summary: this.summary(s),
      })),
    };
  }

  export() { return this.session ? this.session.events.slice() : []; }

  clear() {
    this.sessions = [];
    this.session = null;
    this.pending = null;
    if (this.storage) { try { this.storage.clear(); } catch (e) { /* ignore */ } }
  }

  // ------------------------------------------------------------- PERSISTENCE
  /** Throttled: telemetry must never show up in a frame profile. */
  _persist(immediate = false) {
    if (!this.storage) return;
    const now = this.now();
    if (!immediate && now - this._lastPersist < PERSIST_THROTTLE_MS) {
      if (!this._persistTimer && typeof setTimeout === 'function') {
        this._persistTimer = setTimeout(() => {
          this._persistTimer = null;
          this._persist(true);
        }, PERSIST_THROTTLE_MS);
      }
      return;
    }
    this._lastPersist = now;
    try { this.storage.save(this.sessions); } catch (e) { /* quota: keep playing */ }
  }

  flush() { this._persist(true); }
}

function ratePair(results, retries, types) {
  const r = types.reduce((a, t) => a + (results[t] || 0), 0);
  if (!r) return null;
  return types.reduce((a, t) => a + (retries[t] || 0), 0) / r;
}

function median(nums) {
  const v = nums.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

/** localStorage-backed persistence, kept separate from the game save on purpose:
 *  CLEAR TEST DATA must never wipe somebody's record. */
export function telemetryStorage(backend, key = 'omm.telemetry.v1') {
  return {
    load() {
      if (!backend) return [];
      try {
        const raw = backend.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    },
    save(sessions) {
      if (!backend) return false;
      try { backend.setItem(key, JSON.stringify(sessions)); return true; }
      catch (e) { return false; }
    },
    clear() {
      if (!backend) return;
      try { backend.removeItem(key); } catch (e) { /* ignore */ }
    },
  };
}
