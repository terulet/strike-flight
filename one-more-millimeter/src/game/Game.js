/**
 * Game — the orchestrator. Owns the shot state machine, the physics accumulator,
 * the camera direction and every piece of feedback that fires around a shot.
 *
 * SHOT STATES:  idle -> charging -> live -> result -> idle
 */
import { GameConfig } from '../config/GameConfig.js';
import { PhysicsConfig as P } from '../config/PhysicsConfig.js';
import { OBJECTS, getObject } from '../config/objects.js';
import { createState, launch, step, buildResult, deriveSetup, isSettled, PHASE } from '../physics/Simulation.js';
import { createChallenge, createDailyChallenge, dailyId, practiceId, launchSpeedFor } from './Challenge.js';
import { makeResult, isBetter, compareMargins } from './Scoring.js';
import { rivalsFor, targetRival, rivalsBeatenBy } from './Rivals.js';
import { buildBoard, playerRank } from './Ranking.js';
import { Camera } from '../render/Camera.js';
import { Particles } from '../render/Particles.js';
import { clamp, clamp01, damp, lerp } from '../core/math.js';
import { toMm, formatMm, utcDayKey } from '../ui/format.js';
import { t } from '../ui/i18n.js';
import { EVENTS } from '../telemetry/Telemetry.js';
import { now } from '../core/Loop.js';

const SHOT = { IDLE: 'idle', CHARGING: 'charging', LIVE: 'live', RESULT: 'result' };

export class Game {
  constructor(deps) {
    this.renderer = deps.renderer;
    this.save = deps.save;
    this.tel = deps.telemetry;
    this.audio = deps.audio;
    this.haptics = deps.haptics;
    this.ui = deps.ui;
    this.debug = deps.debug || null;

    this.camera = new Camera();
    this.particles = new Particles();
    this.trail = [];

    this.screen = 'home';
    this.shotState = SHOT.IDLE;
    this.challenge = null;
    this.match = null;
    this.state = null;
    this.shot = null;
    this.result = null;

    this.power = 0;
    this.pressAt = 0;
    this.accumulator = 0;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.hitStop = 0;
    this.squash = { x: 1, y: 1 };
    this.magnifier = { on: false, alpha: 0, mm: 0, comX: 0, until: 0 };
    this.resultAt = 0;
    this.nearEdgeFired = false;
    this.tension = 0;
    this.dustCarry = 0;
    this.paused = false;
    this.forced = { surfaceId: null, objectId: null, rivalMm: null, disableFx: false };
  }

  // =================================================================== MODES
  startMode(modeId, opts = {}) {
    const mode = GameConfig.modes[modeId] || GameConfig.modes.quick;
    const challenge = this._challengeForMode(modeId, opts);
    const rivals = rivalsFor(challenge);

    const prevBest = this._storedBest(challenge.id);
    let target = null;
    if (modeId === 'beat') {
      target = opts.rival || targetRival(rivals, prevBest) || rivals[0];
    } else {
      target = targetRival(rivals, prevBest);
    }

    this.match = {
      modeId,
      mode,
      challenge,
      rivals,
      target,
      attempt: 0,
      maxAttempts: mode.attempts,
      results: [],
      best: null,
      bestBefore: prevBest,
      startedAt: Date.now(),
      beatenThisRun: [],
    };
    this.challenge = challenge;
    this.screen = 'game';

    this.tel.log(EVENTS.MODE_START, { mode: modeId, challenge: challenge.id });
    this.tel.log(EVENTS.CHALLENGE_START, {
      challenge: challenge.id, surface: challenge.surfaceId,
      object: challenge.objectId, mutator: challenge.mutatorId, pe: +challenge.pe.toFixed(4),
    });

    this.ui.setScreen('game');
    this.beginAttempt();
  }

  _challengeForMode(modeId, opts) {
    if (opts.challenge) return opts.challenge;
    const s = this.save.data;
    const force = {};
    if (this.forced.surfaceId) force.surfaceId = this.forced.surfaceId;
    if (this.forced.objectId) force.objectId = this.forced.objectId;

    if (modeId === 'daily') return createChallenge(dailyId(), force);
    if (modeId === 'beat') {
      // Hunt on the daily setup so the rival's number means something.
      return createChallenge(dailyId(), force);
    }
    // Practice pools use whatever the player has unlocked.
    const pool = OBJECTS.filter((o) => s.unlocked.includes(o.id));
    force.objectPool = pool.length ? pool : [OBJECTS[0]];
    if (modeId === 'three') {
      s.threeIndex = (s.threeIndex || 0) + 1;
      return createChallenge(`three-${s.threeIndex}-${s.createdAt % 100000}`, force);
    }
    return createChallenge(practiceId(s.practiceIndex || 1), force);
  }

  nextSetup() {
    const s = this.save.data;
    s.practiceIndex = (s.practiceIndex || 1) + 1;
    this.save.save();
    this.startMode(this.match ? this.match.modeId : 'quick');
  }

  quit() {
    this.audio.stopCharge();
    this.audio.stopSlide();
    this.audio.stopTension();
    this.shotState = SHOT.IDLE;
    this.screen = 'home';
    this.match = null;
    this.result = null;
    this.timeScale = 1;
    this.ui.setScreen('home');
    this.ui.refreshHome();
    this.tel.log(EVENTS.MODE_END, {});
  }

  // ================================================================ ATTEMPTS
  beginAttempt() {
    const m = this.match;
    if (!m) return;
    m.attempt += 1;
    this.state = createState(this.challenge.derived);
    this.shot = null;
    this.result = null;
    this.power = 0;
    this.accumulator = 0;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.hitStop = 0;
    this.nearEdgeFired = false;
    this.tension = 0;
    this.trail.length = 0;
    this.particles.clear();
    this.magnifier.on = false;
    this.magnifier.alpha = 0;
    this.squash.x = 1; this.squash.y = 1;
    this.shotState = SHOT.IDLE;

    this._frameCamera(true);
    this.ui.hideResult();
    this.ui.setMeter(0);
    this.ui.setPrompt(t('prompt.hold'));
    this._syncHud();

    // Now or never: a cue you feel rather than read. Nothing about the physics changes.
    if (this.isFinalShot && (m.modeId === 'three' || m.modeId === 'daily')) {
      this.audio.play('final');
      this.haptics.buzz(10);
    }
  }

  get isFinalShot() {
    const m = this.match;
    return !!m && Number.isFinite(m.maxAttempts) && m.attempt === m.maxAttempts;
  }

  _syncHud() {
    const m = this.match;
    if (!m) return;
    const best = m.best ? m.best.marginM : null;
    this.ui.updateHud({
      modeId: m.modeId,
      attempt: m.attempt,
      maxAttempts: m.maxAttempts,
      finalShot: this.isFinalShot && m.modeId !== 'quick' && m.modeId !== 'beat',
      target: m.target,
      best,
      setupLabel: `${this.challenge.surface.name} · ${this.challenge.object.name}`,
      mutatorLabel: this.challenge.mutatorId !== 'none' ? this.challenge.mutatorName : '',
    });
  }

  // =================================================================== INPUT
  press() {
    if (this.paused) return;
    if (this.screen !== 'game') return;
    if (this.shotState === SHOT.RESULT) {
      if (now() - this.resultAt >= GameConfig.flow.resultLockMs) this.advance();
      return;
    }
    if (this.shotState !== SHOT.IDLE) return;
    this.shotState = SHOT.CHARGING;
    this.pressAt = now();
    this.power = 0;
    this.audio.unlock();
    this.audio.startCharge();
    this.ui.setPrompt(t('prompt.release'));
    this.tel.log(EVENTS.SHOT_CHARGE_START, { attempt: this.match.attempt });
  }

  release() {
    if (this.shotState !== SHOT.CHARGING) return;
    const holdMs = now() - this.pressAt;
    this.audio.stopCharge();
    if (holdMs < GameConfig.power.minHoldMs) {
      // A stray tap is not a shot.
      this.shotState = SHOT.IDLE;
      this.power = 0;
      this.ui.setMeter(0);
      this.ui.setPrompt(t('prompt.hold'));
      return;
    }
    this._fire(clamp01(holdMs / GameConfig.power.chargeMs), holdMs);
  }

  cancelPress() {
    if (this.shotState !== SHOT.CHARGING) return;
    this.audio.stopCharge();
    this.shotState = SHOT.IDLE;
    this.power = 0;
    this.ui.setMeter(0);
    this.ui.setPrompt(t('prompt.hold'));
  }

  /**
   * Fires an exact power value, bypassing the wall clock. Used by the debug replay
   * and by the automated QA pass — the physics path is identical to a real shot.
   */
  fireExact(power, holdMs = power * GameConfig.power.chargeMs) {
    if (this.shotState === SHOT.CHARGING) this.audio.stopCharge();
    if (this.shotState === SHOT.LIVE) return false;
    this._fire(clamp01(power), holdMs);
    return true;
  }

  /** Shared by the player and by the debug replay. */
  _fire(power, holdMs) {
    const ch = this.challenge;
    const v0 = launchSpeedFor(ch, power);

    // The same shot on an endless platform: this is how "x mm PAST THE EDGE" is
    // measured honestly, and it tells the camera in advance how tense to get.
    const ghost = simulateHeadless(ch, v0);

    this.state = createState(ch.derived);
    launch(this.state, v0);
    this.shot = {
      power,
      holdMs,
      v0,
      ghost,
      predictedMargin: ch.travelToEdge - ghost.travelM,
      startedAt: Date.now(),
    };
    this.shotState = SHOT.LIVE;
    this.power = power;

    this.audio.play('release');
    this.audio.startSlide(ch.surface);
    this.haptics.buzz(GameConfig.feedback.haptics.release);
    this.squash.x = 1.10; this.squash.y = 0.90;
    this.ui.setPrompt('', true);
    this._burstRelease();

    this.tel.log(EVENTS.SHOT_RELEASE, {
      attempt: this.match.attempt, power: +power.toFixed(4), holdMs: Math.round(holdMs),
      v0: +v0.toFixed(5), challenge: ch.id,
    });
  }

  /**
   * Result panel primary button, and tap-anywhere. A finished run starts another
   * one rather than dumping the player back to the menu — the whole game is
   * "one more", so the default action is always another go.
   */
  advance() {
    const m = this.match;
    if (!m) return;
    this.ui.hideResult();
    if (m.finished) {
      this.tel.log(EVENTS.RETRY, { attempt: m.attempt, run: 'new' });
      this.startMode(m.modeId);
      return;
    }
    this.tel.log(EVENTS.RETRY, { attempt: m.attempt });
    this.beginAttempt();
  }

  // =================================================================== FRAME
  frame(dt) {
    if (this.paused) return;
    const cfg = GameConfig;

    if (this.shotState === SHOT.CHARGING) {
      const held = now() - this.pressAt;
      this.power = clamp01(held / cfg.power.chargeMs);
      this.audio.updateCharge(this.power);
      this.ui.setMeter(this.power);
      if (this.power >= 1 && !this._maxedFlag) { this._maxedFlag = true; this.audio.play('tick'); this.haptics.buzz(8); }
      if (this.power < 1) this._maxedFlag = false;
    }

    if (this.shotState === SHOT.LIVE) this._stepSimulation(dt);

    // Squash/stretch relaxes back
    this.squash.x = damp(this.squash.x, 1, 9, dt);
    this.squash.y = damp(this.squash.y, 1, 9, dt);

    const worldDt = dt * this.timeScale;
    this.particles.update(worldDt);
    this._frameCamera(false, dt);

    if (this.magnifier.on) {
      this.magnifier.alpha = damp(this.magnifier.alpha, 1, 12, dt);
      if (this.shotState !== SHOT.RESULT && now() > this.magnifier.until) this.magnifier.on = false;
    } else if (this.magnifier.alpha > 0) {
      this.magnifier.alpha = damp(this.magnifier.alpha, 0, 10, dt);
    }
  }

  _stepSimulation(dt) {
    const cfg = GameConfig;
    const d = this.challenge.derived;
    const st = this.state;

    // Hit stop: a hard freeze that makes the fall land in the player's chest.
    if (this.hitStop > 0) {
      this.hitStop -= dt * 1000;
      return;
    }

    this._updateTimeScale(dt);
    let budget = P.maxStepsPerFrame;
    this.accumulator += Math.min(dt, P.maxFrameDelta) * this.timeScale;
    const wasPhase = st.phase;

    while (this.accumulator >= P.dt && budget-- > 0 && !isSettled(st)) {
      step(st, d, false);
      this.accumulator -= P.dt;
      if (st.phase === PHASE.TIPPING && wasPhase === PHASE.SLIDE) break;
    }
    if (budget <= 0) this.accumulator = 0; // never spiral

    // Trail + dust in world time
    const worldDt = dt * this.timeScale;
    if (st.phase === PHASE.SLIDE) {
      this.trail.push(st.x);
      if (this.trail.length > 26) this.trail.shift();
      this._emitDust(worldDt);
    }

    const margin = d.edgeX - (st.x + d.comOffset);
    const predicted = this.shot ? this.shot.predictedMargin : margin;

    // Audio: speed and tension
    const tensionAmt = clamp01(1 - Math.abs(predicted) / cfg.tension.approachMargin) *
      clamp01(1 - margin / (cfg.tension.approachMargin * 2.2));
    this.tension = Number.isFinite(tensionAmt) ? clamp01(tensionAmt) : 0;
    this.audio.updateSlide(st.v, st.phase === PHASE.SLIDE ? this.tension : 0);

    if (!this.nearEdgeFired && margin < cfg.tension.approachMargin && st.phase === PHASE.SLIDE) {
      this.nearEdgeFired = true;
      this.haptics.buzz(GameConfig.feedback.haptics.critical);
      this.tel.log(EVENTS.NEAR_EDGE_ENTER, { marginMm: +toMm(margin).toFixed(3) });
    }

    if (wasPhase === PHASE.SLIDE && st.phase === PHASE.TIPPING) this._onTipStart();
    if (isSettled(st)) this._finishShot();
  }

  _updateTimeScale(dt) {
    const cfg = GameConfig;
    const st = this.state;
    const d = this.challenge.derived;
    const predicted = this.shot ? this.shot.predictedMargin : 1;
    const margin = d.edgeX - (st.x + d.comOffset);
    let target = 1;
    if (st.phase === PHASE.SLIDE) {
      const closeResult = Math.abs(predicted) <= cfg.tension.slowMoMargin;
      const nearNow = margin <= cfg.tension.approachMargin;
      if (closeResult && nearNow) {
        // Deeper slow motion the tighter the result is going to be.
        const k = clamp01(1 - Math.abs(predicted) / cfg.tension.slowMoMargin);
        target = lerp(0.55, cfg.tension.slowMoScale, k);
      }
    } else if (st.phase === PHASE.TIPPING) {
      target = Math.abs(predicted) <= cfg.tension.nearMissMargin ? 0.30 : 0.72;
    } else if (st.phase === PHASE.FALLING) {
      target = 0.85;
    }
    if (this.save.data.settings.reduceFx) target = Math.max(target, 0.6);
    this.timeScaleTarget = target;
    this.timeScale = damp(this.timeScale, this.timeScaleTarget, cfg.tension.slowMoLerp, dt);
  }

  // ================================================================== CAMERA
  _frameCamera(snap = false, dt = 0) {
    const cfg = GameConfig.camera;
    const ch = this.challenge;
    if (!ch) return;
    const st = this.state;
    const obj = ch.object;

    this.camera.anchorY =
      this.screen === 'home' ? 0.44 : this.shotState === SHOT.RESULT ? 0.40 : cfg.anchorY;
    if (!st || this.shotState === SHOT.IDLE || this.shotState === SHOT.CHARGING) {
      // Frame the whole runway so the player can read the distance to the edge.
      const platW = ch.platform.edgeX - ch.platform.startX;
      const span = clamp(platW * 1.22, 0.30, 1.15);
      const cx = (ch.platform.startX + ch.platform.edgeX) / 2 + span * 0.02;
      const cy = obj.height * 0.5;
      if (snap) this.camera.snap(cx, cy, span);
      else this.camera.target(cx, cy, span);
    } else {
      const com = st.x + obj.comOffset;
      const margin = ch.platform.edgeX - com;
      const predicted = this.shot ? Math.abs(this.shot.predictedMargin) : margin;
      // Zoom scales with how tight the result will be, but never tighter than the
      // object itself needs to stay readable.
      // Keep the object AND the edge in frame: the overhang is half the drama.
      const floor = Math.max(obj.width * 2.6, GameConfig.camera.tightSpan);
      const wanted = clamp(Math.max(predicted * 26, floor), floor, cfg.wideSpan);
      const approach = clamp01(1 - margin / 0.26);
      const platW = ch.platform.edgeX - ch.platform.startX;
      const wide = clamp(platW * 1.22, 0.30, 1.15);
      let span = lerp(wide, wanted, approach * approach);
      let cx = lerp(st.x, (com + ch.platform.edgeX) / 2, approach);
      let cy = obj.height * 0.5;

      if (st.phase === PHASE.FALLING || st.phase === PHASE.TIPPING) {
        // Pull back so the drop is visible: watching it disappear is the punishment.
        cy = lerp(obj.height * 0.5, -st.y * 0.7, clamp01(st.y / 0.3));
        span = Math.max(span, Math.max(obj.width * 7, 0.20) + st.y * 1.6);
        cx = lerp(cx, ch.platform.edgeX, 0.45);
      }
      if (this.shotState === SHOT.RESULT && !st.crossedEdge) {
        // Recentre on the gap. The zoom already tracks how tight the result was, so
        // a 9 mm shot keeps its context instead of being shoved into a macro.
        span = clamp(span, Math.max(obj.width * 2.2, GameConfig.camera.tightSpan), cfg.wideSpan);
        cx = (com + ch.platform.edgeX) / 2;
      }
      if (snap) this.camera.snap(cx, cy, span);
      else this.camera.target(cx, cy, span);
    }
    if (!snap) this.camera.update(dt, { lerp: this.magnifier.on ? GameConfig.camera.macroLerp : GameConfig.camera.lerp });
  }

  // ================================================================ FEEDBACK
  _emitDust(dt) {
    const st = this.state;
    if (st.v <= 0.02) return;
    const s = this.challenge.surface;
    if (this.save.data.settings.reduceFx) return;
    const rate = clamp(st.v * 26 * (s.noise ?? 0.6), 0, 70);
    this.dustCarry += rate * dt;
    while (this.dustCarry >= 1) {
      this.dustCarry -= 1;
      const j = (this.particles.cursor % 7) / 7;
      this.particles.spawn({
        x: st.x - this.challenge.object.width * 0.45,
        y: 0.0008 + j * 0.004,
        vx: -st.v * (0.06 + j * 0.10),
        vy: 0.02 + j * 0.06,
        life: 0.24 + j * 0.3,
        size: 0.0009 + j * 0.0011,
        color: s.accent,
        gravity: 0.05,
        drag: 2.4,
        type: 'dust',
      });
    }
  }

  _burstRelease() {
    const st = this.state;
    const s = this.challenge.surface;
    this.particles.burst(this.save.data.settings.reduceFx ? 4 : 14, (i, n) => ({
      x: st.x - this.challenge.object.width * 0.5,
      y: 0.001 + (i / n) * 0.006,
      vx: -0.25 - (i / n) * 0.5,
      vy: 0.08 + (i / n) * 0.25,
      life: 0.3 + (i / n) * 0.25,
      size: 0.0012,
      color: s.accent,
      gravity: 0.5,
      drag: 2.2,
      type: 'dust',
    }));
    this.camera.addPunch(0.35);
  }

  _onTipStart() {
    const nearMiss = Math.abs(this.shot ? this.shot.predictedMargin : 1) <= GameConfig.tension.nearMissMargin;
    this.audio.stopSlide();
    this.audio.stopTension();
    this.audio.play('fall');
    this.haptics.buzz(GameConfig.feedback.haptics.fall);
    if (!this.save.data.settings.reduceFx) this.hitStop = nearMiss ? GameConfig.feedback.hitStopMs : 40;
    if (this.save.data.settings.shake) this.camera.addShake(nearMiss ? 0.5 : 0.32);
  }

  // ================================================================== RESULT
  _finishShot() {
    const ch = this.challenge;
    const m = this.match;
    const sim = buildResult(this.state, ch.derived);
    const res = makeResult(sim, this.shot.ghost, ch, { power: this.shot.power, holdMs: this.shot.holdMs });
    this.result = res;
    this.shotState = SHOT.RESULT;
    this.resultAt = now();
    this.audio.stopSlide();
    this.audio.stopTension();

    const prevMatchBest = m.best ? m.best.marginM : null;
    const prevChallengeBest = m.bestBefore;
    const prevAllTime = this.save.data.records.bestM;

    if (isBetter(res, m.best)) m.best = res;
    m.results.push(res);

    // ---- Rival comparison -------------------------------------------------
    let beaten = [];
    let target = m.target;
    let stillLeads = null;
    if (res.valid) {
      beaten = rivalsBeatenBy(m.rivals, res.marginM, prevChallengeBest ?? prevMatchBest);
      if (target && res.marginM < target.marginM) {
        m.beatenThisRun.push(target.id);
      } else if (target) {
        stillLeads = target;
      }
    }

    const board = buildBoard(ch, m.best ? m.best.marginM : null, t('result.you'), ch.objectId);
    m.board = board;
    const rank = playerRank(board);
    m.rank = rank;

    const isChallengeBest = res.valid && (prevChallengeBest == null || res.marginM < prevChallengeBest - P.tieEpsilon);
    const isAllTimeBest = res.valid && (prevAllTime == null || res.marginM < prevAllTime - P.tieEpsilon);

    this._commitStats(res, { isChallengeBest, isAllTimeBest, beaten, rank });

    // ---- Feedback ---------------------------------------------------------
    this._resultFeedback(res, { isAllTimeBest, isChallengeBest, beaten, rank });

    // Retarget for the next attempt: always somebody left to hunt.
    m.target = targetRival(m.rivals, m.best ? m.best.marginM : null);

    const attemptsLeft = Number.isFinite(m.maxAttempts) ? m.maxAttempts - m.attempt : Infinity;
    m.finished = attemptsLeft <= 0;

    const delay = res.fell ? GameConfig.flow.fallPauseMs : GameConfig.flow.settlePauseMs;
    const showAt = res.magnify ? delay + GameConfig.flow.magnifierMs : delay;
    if (res.magnify) {
      this.magnifier.on = true;
      this.magnifier.mm = res.mm;
      this.magnifier.comX = this.state.x + ch.object.comOffset;
      this.magnifier.frontX = this.state.x + ch.object.width / 2;
      this.magnifier.until = now() + GameConfig.flow.magnifierMs;
    }

    this.tel.log(res.fell ? EVENTS.SHOT_FALL : EVENTS.SHOT_STOP, {
      mm: res.valid ? +res.mm.toFixed(4) : null,
      pastMm: res.fell ? +res.overshootMm.toFixed(4) : null,
      zone: res.zoneId, attempt: m.attempt, challenge: ch.id,
    });
    if (isAllTimeBest) this.tel.log(EVENTS.NEW_BEST, { mm: +res.mm.toFixed(4) });
    for (const b of beaten) this.tel.log(EVENTS.RIVAL_BEATEN, { rival: b.id, mm: +res.mm.toFixed(4) });

    this._saveReplay(res);

    setTimeout(() => {
      if (this.shotState !== SHOT.RESULT) return;
      this.resultAt = now();
      this.ui.showResult(this._resultPayload(res, { isAllTimeBest, isChallengeBest, beaten, stillLeads, rank, board }));
    }, showAt);
  }

  _resultFeedback(res, info) {
    const s = this.save.data.settings;
    if (res.fell) {
      this.audio.play('impact');
      if (res.nearMiss) this.ui.flash(0.16);
      return;
    }
    this.audio.play('stop');
    this.haptics.buzz(GameConfig.feedback.haptics.stop);
    if (res.hanging || res.mm < 3) this.audio.play('brink');

    if (info.isAllTimeBest || info.isChallengeBest) {
      setTimeout(() => this.audio.play(res.absurd ? 'legendary' : 'record'), 180);
      this.haptics.buzz(GameConfig.feedback.haptics.record);
      if (s.shake) this.camera.addShake(0.42);
      this.camera.addPunch(0.6);
      this.ui.flash(res.absurd ? 0.34 : 0.2);
      this._recordBurst(res);
    } else if (info.beaten.length) {
      setTimeout(() => this.audio.play('beaten'), 140);
      this.haptics.buzz(GameConfig.feedback.haptics.beaten);
      this.camera.addPunch(0.4);
    }
  }

  _recordBurst(res) {
    if (this.save.data.settings.reduceFx) return;
    const st = this.state;
    const zone = res.zone;
    this.particles.burst(res.absurd ? 46 : 30, (i, n) => {
      const a = (i / n) * Math.PI * 2;
      const sp = 0.10 + ((i * 37) % 13) / 13 * 0.30;
      return {
        x: st.x, y: this.challenge.object.height * 0.6,
        vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp * 1.4 + 0.1,
        life: 0.5 + ((i * 17) % 11) / 11 * 0.6,
        size: 0.0013 + ((i * 7) % 5) / 5 * 0.0016,
        color: zone ? zone.color : '#ff2fd0',
        gravity: 0.55, drag: 1.1,
        rot: a, spin: (i % 2 ? 1 : -1) * 7,
        type: 'shard',
      };
    });
  }

  _resultPayload(res, info) {
    const m = this.match;
    const target = info.stillLeads || m.target;
    return {
      result: res,
      match: m,
      challenge: this.challenge,
      isAllTimeBest: info.isAllTimeBest,
      isChallengeBest: info.isChallengeBest,
      beaten: info.beaten,
      stillLeads: info.stillLeads,
      target,
      rank: info.rank,
      board: info.board,
      finished: m.finished,
      canChangeSetup: m.modeId === 'quick',
      attemptsLeft: Number.isFinite(m.maxAttempts) ? m.maxAttempts - m.attempt : Infinity,
    };
  }

  // ================================================================= PERSIST
  _storedBest(challengeId) {
    const rec = this.save.data.records.perChallenge[challengeId];
    return rec && typeof rec.bestM === 'number' ? rec.bestM : null;
  }

  _commitStats(res, info) {
    const day = utcDayKey();
    this.save.update((d) => {
      const st = d.stats;
      st.attempts += 1;
      st.shots += 1;
      if (res.fell) {
        st.falls += 1;
        st.streak = 0;
        if (res.nearMiss) st.nearMisses += 1;
      } else {
        st.streak += 1;
        st.bestStreak = Math.max(st.bestStreak, st.streak);
        if (res.mm <= 3) st.closeCalls += 1;
        st.zones[res.zoneId] = (st.zones[res.zoneId] || 0) + 1;
      }
      if (info.beaten.length) st.rivalsBeaten += info.beaten.length;
      if (info.isAllTimeBest) st.records += 1;

      if (res.valid) {
        const rec = d.records;
        if (rec.bestM == null || res.marginM < rec.bestM) {
          rec.bestM = res.marginM;
          rec.bestAt = Date.now();
          rec.bestChallengeId = this.challenge.id;
        }
        if (rec.today.day !== day) rec.today = { day, bestM: res.marginM };
        else if (rec.today.bestM == null || res.marginM < rec.today.bestM) rec.today.bestM = res.marginM;

        const pc = rec.perChallenge[this.challenge.id] || { bestM: null, attempts: 0, at: 0 };
        pc.attempts += 1;
        if (pc.bestM == null || res.marginM < pc.bestM) { pc.bestM = res.marginM; pc.at = Date.now(); }
        rec.perChallenge[this.challenge.id] = pc;
      } else {
        const pc = d.records.perChallenge[this.challenge.id] || { bestM: null, attempts: 0, at: 0 };
        pc.attempts += 1;
        d.records.perChallenge[this.challenge.id] = pc;
      }

      if (this.match.modeId === 'daily') {
        if (d.daily.day !== day) d.daily = { day, attempts: 0, bestM: null, done: false, results: [] };
        d.daily.attempts += 1;
        // Only the official three shots count towards today's standing.
        const counts = d.daily.attempts <= GameConfig.modes.daily.attempts;
        if (counts && res.valid && (d.daily.bestM == null || res.marginM < d.daily.bestM)) d.daily.bestM = res.marginM;
        if (counts) d.daily.results.push({ mm: res.valid ? +res.mm.toFixed(4) : null, fell: res.fell });
        d.daily.done = d.daily.attempts >= GameConfig.modes.daily.attempts;
      }

      for (const r of info.beaten) if (!d.rivals.beaten.includes(r.id)) d.rivals.beaten.push(r.id);
    });

    this._checkUnlocks();
  }

  _checkUnlocks() {
    const d = this.save.data;
    const best = d.records.bestM;
    const beatenCount = d.stats.rivalsBeaten;
    for (const obj of OBJECTS) {
      if (!obj.unlock || d.unlocked.includes(obj.id)) continue;
      let ok = false;
      if (obj.unlock.type === 'best') ok = best != null && best <= obj.unlock.value;
      else if (obj.unlock.type === 'rivals') ok = beatenCount >= obj.unlock.value;
      if (ok) {
        d.unlocked.push(obj.id);
        this.save.save();
        this.tel.log(EVENTS.UNLOCK, { object: obj.id });
        this.ui.showToast(t('unlock.title'), t('unlock.sub', { name: obj.name }));
      }
    }
  }

  /** Enough to replay or to re-verify a score server side (docs/ANTICHEAT.md). */
  _saveReplay(res) {
    const ch = this.challenge;
    const rec = {
      v: 1,
      challengeId: ch.id,
      physics: P.version,
      game: GameConfig.version,
      objectId: ch.objectId,
      surfaceId: ch.surfaceId,
      mutatorId: ch.mutatorId,
      pe: +ch.pe.toFixed(6),
      power: +this.shot.power.toFixed(6),
      holdMs: Math.round(this.shot.holdMs),
      v0: +this.shot.v0.toFixed(6),
      marginM: res.valid ? +res.marginM.toFixed(9) : null,
      fell: res.fell,
      at: Date.now(),
    };
    this.lastReplay = rec;
    this.save.update((d) => {
      d.replays.unshift(rec);
      if (d.replays.length > 20) d.replays.length = 20;
    });
  }

  replayLast() {
    const r = this.lastReplay;
    if (!r || this.shotState !== SHOT.IDLE) return false;
    return this.fireExact(r.power, r.holdMs);
  }

  // ================================================================== RENDER
  render() {
    if (!this.challenge) return;
    const ghosts = this._ghosts();
    this.renderer.draw({
      camera: this.camera,
      challenge: this.challenge,
      state: this.state,
      particles: this.particles,
      trail: this.shotState === SHOT.LIVE ? this.trail : null,
      ghosts,
      squash: this.squash,
      time: this.state ? this.state.t : 0,
      showCom: this.camera.pxPerM > 1800,
      magnifier: this.magnifier,
      reduceFx: this.save.data.settings.reduceFx || this.forced.disableFx,
      highContrast: this.save.data.settings.highContrast,
      debug: this.debug && this.debug.drawWorld ? { draw: true } : null,
    });
  }

  _ghosts() {
    const m = this.match;
    if (!m) return [];
    const out = [];
    const edge = this.challenge.platform.edgeX;
    if (m.target) {
      out.push({
        x: edge - m.target.marginM,
        object: getObject(m.target.objectId),
        color: m.target.color,
        label: `${m.target.name}  ${formatMm(m.target.mm)}`,
        alpha: 0.9,
      });
    }
    const best = m.best ? m.best.marginM : m.bestBefore;
    if (best != null) {
      out.push({
        x: edge - best,
        object: null,
        color: '#ffffff',
        label: `${t('hud.best')}  ${formatMm(toMm(best))}`,
        labelOffset: 26,
        alpha: 0.55,
      });
    }
    return out;
  }

  // ================================================================== SYSTEM
  setPaused(p) {
    this.paused = !!p;
    if (p) {
      this.audio.stopCharge();
      this.audio.suspend();
      if (this.shotState === SHOT.CHARGING) this.cancelPress();
    } else {
      this.audio.resume();
    }
  }
}

/** Headless run of the current challenge on an endless platform. */
function simulateHeadless(challenge, v0) {
  const d = challenge.derived;
  const st = createState(d);
  launch(st, v0);
  let guard = 240 * 25;
  while (!isSettled(st) && guard-- > 0) step(st, d, true);
  return buildResult(st, d);
}

export { SHOT, simulateHeadless };
