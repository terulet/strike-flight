/**
 * Game — owns the state machine and wires every system together.
 *
 * Update order inside a step is deliberate:
 *   room (hazards move, platforms record their delta)
 *     -> player (rides platforms, resolves against the moved geometry)
 *       -> contacts (exit, stomps, hazards)
 * Doing it the other way round is how you get "the platform left without me"
 * and "the saw hit me where it used to be" — both of which read as the game
 * cheating.
 */
import { COLORS, FEEL, PLAYER, ROOM, VIEW } from '../config.js';
import { clamp, easeOutCubic, lerp } from '../core/math.js';
import { EventBus } from '../core/events.js';
import { SaveManager, detectStorage } from '../core/save.js';
import { State, StateMachine } from '../core/state.js';
import { Clock } from '../core/time.js';
import { Input } from '../input/input.js';
import { Viewport } from '../systems/viewport.js';
import { Gfx } from '../systems/gfx.js';
import { Camera, roomTopY } from '../systems/camera.js';
import { Particles, Shape } from '../systems/particles.js';
import { AudioManager } from '../systems/audio.js';
import { UI } from '../systems/ui.js';
import { Debug } from '../systems/debug.js';
import { Player } from './player.js';
import { FloorManager } from '../floors/floorManager.js';
import '../floors/hazards/index.js';

const CAUSE_COLOR = {
  saw: COLORS.danger,
  laser: COLORS.laser,
  crush: COLORS.warn,
  spike: COLORS.danger,
  fall: '#4c7cff',
  fire: COLORS.fire,
  shock: '#ffe14c',
  enemy: COLORS.danger,
  boss: COLORS.boss,
};

export class Game {
  constructor({ canvas, probe, storage } = {}) {
    this.viewport = new Viewport(canvas, probe);
    this.gfx = new Gfx(this.viewport.ctx);
    this.ui = new UI(this.gfx, this.viewport);
    this.bus = new EventBus();
    this.save = new SaveManager(storage || detectStorage());
    this.audio = new AudioManager({ muted: this.save.muted });
    this.input = new Input(this.viewport);
    this.clock = new Clock();
    this.camera = new Camera();
    this.particles = new Particles();
    this.floors = new FloorManager();
    this.player = new Player();
    this.debug = new Debug(this);
    this.state = new StateMachine(State.BOOT, (to, from) => this.bus.emit('state_change', { to, from }));

    this.floorNumber = 1;
    this.room = null;
    this.prevRoom = null;
    this.nextRoom = null;
    this.deathCause = null;
    this.isRecord = false;
    this.hintAge = 99;
    this.hudPulse = 0;
    this.flashColor = '#ffffff';
    this.flashAlpha = 0;
    this.transT = 1;
    this.transFrom = { x: 0, y: 0 };
    this.transTo = { x: 0, y: 0 };
    this.runFloors = 0;
    this.fps = 60;

    // Shared context handed to entities — created once, never per frame.
    this.entityCtx = {
      player: this.player,
      time: 0,
      floorNumber: 1,
      sfx: (name, opts) => this.audio.play(name, opts),
      onCrusherSlam: (c) => this.onCrusherSlam(c),
      onCrumbleBreak: (c) => this.onCrumbleBreak(c),
      onWalkerStomp: (w) => this.onWalkerStomp(w),
      onBossHit: (b, hp) => this.onBossHit(b, hp),
      onBossSlam: (b) => this.onBossSlam(b),
      onBossDefeated: (b) => this.onBossDefeated(b),
    };

    this._cmd = { press: false, held: false, swipeDown: false };
    window.addEventListener('resize', () => this.viewport.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.viewport.resize(), 120));
  }

  boot() {
    this.state.set(State.TITLE);
    this.floorNumber = 1;
    this.room = this.floors.build(1);
    this.nextRoom = this.floors.build(2);
    this.player.reset(this.room.spawn.x, this.room.spawn.y, this.room.spawn.dir);
    this.player.spawnSafe = 999; // The title screen bot is scenery, not prey.
    this.camera.focusFloor(1, true);
  }

  // ── run lifecycle ───────────────────────────────────────────────────────

  startRun(floor = 1) {
    this.audio.unlock();
    const from = this.state.current;
    if (from !== State.PLAYING && !this.state.set(State.PLAYING)) {
      // Recover from any odd state (e.g. debug restart mid-transition).
      this.state.current = State.PLAYING;
      this.state.timeInState = 0;
    }
    this.floorNumber = Math.max(1, Math.floor(floor));
    this.prevRoom = null;
    this.room = this.floors.build(this.floorNumber);
    this.nextRoom = this.floors.build(this.floorNumber + 1);
    this.player.reset(this.room.spawn.x, this.room.spawn.y, this.room.spawn.dir);
    this.camera.focusFloor(this.floorNumber, true);
    this.particles.clear();
    this.clock.resetScale();
    this.deathCause = null;
    this.isRecord = false;
    this.runFloors = 0;
    this.hintAge = 0;
    this.transT = 1;
    this.flashAlpha = 0;
    this.input.flush();
    this.bus.emit(from === State.RESULT ? 'retry' : 'game_start', { floor: this.floorNumber });
    this.bus.emit('floor_start', { floor: this.floorNumber, id: this.room.def.id });
    this.audio.play('start');
  }

  completeFloor() {
    if (!this.state.set(State.TRANSITION)) return;
    const room = this.room;
    this.bus.emit('floor_complete', { floor: this.floorNumber, id: room.def.id, time: room.time });
    this.runFloors++;
    this.audio.play('complete');
    this.clock.freeze(0.035);
    this.camera.addShake(2.5);
    this.hudPulse = 1;

    const ex = room.exitCenterX();
    const ey = room.originY + ROOM.H - ROOM.SLAB;
    this.particles.burst(ex, ey - 6, 16, {
      color: COLORS.exit, speed: 60, speedVar: 130, dir: -Math.PI / 2, spread: Math.PI * 0.9,
      life: 0.4, size: 2.5, sizeVar: 2.5, grav: 260, additive: true, shape: Shape.SPARK,
    });

    this.prevRoom = room;
    this.floorNumber++;
    // The room above was already built and ticking, so its hazard timings are
    // exactly the ones the player has been watching from below.
    this.room = this.nextRoom || this.floors.build(this.floorNumber);
    this.nextRoom = this.floors.build(this.floorNumber + 1);
    this.entityCtx.floorNumber = this.floorNumber;

    this.transFrom.x = this.player.x;
    this.transFrom.y = this.player.y;
    this.transTo.x = this.room.spawn.x;
    this.transTo.y = this.room.spawn.y;
    this.transT = 0;
    this.camera.focusFloor(this.floorNumber, false);
  }

  die(cause) {
    if (this.debug.invincible) return;
    if (!this.state.set(State.DYING)) return;
    this.deathCause = cause;
    this.player.dead = true;
    const color = CAUSE_COLOR[cause] || COLORS.danger;

    this.clock.freeze(FEEL.HITSTOP_DEATH);
    this.clock.slowmo(0.35);
    this.camera.addShake(11);
    this.flash(color, 0.3);
    this.audio.play('death');

    const cx = this.player.cx;
    const cy = this.player.cy;
    this.particles.burst(cx, cy, 26, {
      color: COLORS.player, speed: 90, speedVar: 240, spread: Math.PI * 2,
      life: 0.5, lifeVar: 0.35, size: 3, sizeVar: 3.5, grav: 900, drag: 1.1,
    });
    this.particles.burst(cx, cy, 14, {
      color, speed: 140, speedVar: 260, spread: Math.PI * 2,
      life: 0.3, lifeVar: 0.25, size: 2, sizeVar: 3, grav: 200, additive: true, shape: Shape.SPARK,
    });

    this.isRecord = this.save.submitRun(this.floorNumber);
    this.bus.emit('death', { floor: this.floorNumber, cause, floorsCleared: this.runFloors });
    if (this.isRecord && this.floorNumber > 1) {
      this.bus.emit('new_record', { floor: this.floorNumber });
    }
  }

  toResult() {
    if (!this.state.set(State.RESULT)) return;
    this.clock.resetScale();
    this.input.flush();
    if (this.isRecord && this.floorNumber > 1) this.audio.play('record');
  }

  toggleMute() {
    const next = !this.save.muted;
    this.save.setMuted(next);
    this.audio.setMuted(next);
  }

  debugSkipFloor(delta) {
    const target = Math.max(1, this.floorNumber + delta);
    this.startRun(target);
  }

  flash(color, alpha) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  // ── entity callbacks ────────────────────────────────────────────────────

  onCrusherSlam(c) {
    const onScreen = Math.abs((c.topY + c.offset) - this.camera.y) < VIEW.H;
    if (!onScreen) return;
    this.camera.addShake(4.5);
    this.audio.play('crusher');
    const y = c.topY + c.offset + c.h;
    this.particles.burst(c.x + c.w / 2, y, 8, {
      color: '#6b7590', speed: 130, speedVar: 90, dir: 0, spread: Math.PI * 0.4,
      life: 0.3, size: 2.5, sizeVar: 2, grav: 700,
    });
    this.particles.burst(c.x + c.w / 2, y, 8, {
      color: '#6b7590', speed: 130, speedVar: 90, dir: Math.PI, spread: Math.PI * 0.4,
      life: 0.3, size: 2.5, sizeVar: 2, grav: 700,
    });
  }

  onCrumbleBreak(c) {
    this.audio.play('crumble');
    this.particles.burst(c.x + c.w / 2, c.y + c.h / 2, 8, {
      color: '#3b465f', speed: 40, speedVar: 90, spread: Math.PI * 2,
      life: 0.45, size: 2.5, sizeVar: 2.5, grav: 800,
    });
  }

  onWalkerStomp(w) {
    this.audio.play('stomp');
    this.clock.freeze(0.05);
    this.camera.addShake(3);
    this.player.vy = PLAYER.JUMP_VEL * 0.78;
    this.player.jumping = true;
    this.player.grounded = false;
    this.particles.burst(w.x + w.w / 2, w.y + w.h / 2, 12, {
      color: COLORS.danger, speed: 80, speedVar: 150, spread: Math.PI * 2,
      life: 0.35, size: 2.5, sizeVar: 2, grav: 700,
    });
  }

  onBossSlam(b) {
    this.camera.addShake(7);
    this.audio.play('boss_slam');
    const y = b.y + b.h;
    for (const dir of [0, Math.PI]) {
      this.particles.burst(b.x + b.w / 2, y, 10, {
        color: COLORS.boss, speed: 170, speedVar: 120, dir, spread: Math.PI * 0.35,
        life: 0.35, size: 3, sizeVar: 2, grav: 800,
      });
    }
  }

  onBossHit(b, hp) {
    this.clock.freeze(FEEL.HITSTOP_BOSS_HIT);
    this.camera.addShake(8);
    this.flash('#ffffff', 0.35);
    this.audio.play('boss_hit');
    this.player.vy = PLAYER.JUMP_VEL * 0.9;
    this.player.jumping = true;
    this.player.grounded = false;
    this.bus.emit('boss_hit', { floor: this.floorNumber, hpLeft: hp });
    this.particles.burst(b.x + b.w / 2, b.y, 22, {
      color: COLORS.boss, speed: 120, speedVar: 220, spread: Math.PI * 2,
      life: 0.45, lifeVar: 0.3, size: 3, sizeVar: 3, grav: 600, additive: true,
    });
  }

  onBossDefeated(b) {
    this.clock.freeze(0.2);
    this.clock.slowmo(0.45);
    this.camera.addShake(12);
    this.flash(COLORS.boss, 0.6);
    this.audio.play('boss_die');
    this.particles.burst(b.x + b.w / 2, b.y + b.h / 2, 40, {
      color: COLORS.boss, speed: 90, speedVar: 320, spread: Math.PI * 2,
      life: 0.7, lifeVar: 0.5, size: 3.5, sizeVar: 4, grav: 500, additive: true,
    });
    setTimeout(() => this.clock.slowmo(1), 500);
  }

  // ── update ──────────────────────────────────────────────────────────────

  update(rawDt) {
    const scaled = rawDt * this.debug.timeScale;
    const dt = this.clock.step(scaled);
    this.input.update(rawDt);
    this.ui.update(rawDt);
    this.state.update(rawDt);
    this.debug.updateTouchToggle(rawDt, this.input);
    this.hudPulse = Math.max(0, this.hudPulse - rawDt * 2.2);
    this.flashAlpha = Math.max(0, this.flashAlpha - rawDt * 4.5);
    this.entityCtx.time += rawDt;

    const cmd = this._cmd;
    cmd.press = this.input.consumePress();
    cmd.held = this.input.held;
    cmd.swipeDown = this.input.consumeSwipeDown();
    if (cmd.press) this.audio.unlock();

    switch (this.state.current) {
      case State.TITLE: this.updateTitle(dt, cmd); break;
      case State.PLAYING: this.updatePlaying(dt, cmd); break;
      case State.TRANSITION: this.updateTransition(dt, rawDt, cmd); break;
      case State.DYING: this.updateDying(dt, cmd); break;
      case State.RESULT: this.updateResult(dt, cmd); break;
      default: break;
    }

    this.particles.update(dt);
    this.camera.update(dt, rawDt);
  }

  updateTitle(dt, cmd) {
    // The bot idles on floor 1 behind the title so the game is never a still image.
    if (this.room) {
      this.room.update(dt, this.entityCtx);
      this.player.update(dt, { press: false, held: false, swipeDown: false }, this.room.solids);
      if (this.player.x > 200) this.player.dir = -1;
      if (this.player.x < 40) this.player.dir = 1;
    }
    if (cmd.press) this.startRun(this.debug.startFloor || 1);
  }

  updatePlaying(dt, cmd) {
    this.hintAge += dt;
    const room = this.room;
    room.update(dt, this.entityCtx);
    this.nextRoom?.update(dt, this.entityCtx);

    const before = this.player.grounded;
    this.player.update(dt, cmd, room.solids);
    this.playerFeedback(before);

    // Crumbling tiles react to weight; a dive shatters them immediately.
    room.touchCrumbles(this.player, this.player.events.landed && this.player.landImpact > 0.55);

    // Stomps resolve before hazards: landing on a drone is a kill, not a death.
    room.checkStomps(this.player, this.entityCtx);
    room.checkBossStomp(this.player, this.entityCtx);

    if (this.player.y > room.bottomY + 50) {
      this.die('fall');
      return;
    }

    const cause = room.checkHazards(this.player);
    if (cause) {
      this.die(cause);
      return;
    }

    if (room.checkExit(this.player)) this.completeFloor();
  }

  playerFeedback(wasGrounded) {
    const e = this.player.events;
    const p = this.player;
    if (e.jumped) {
      this.audio.play('jump');
      this.particles.burst(p.cx, p.y + p.h, 5, {
        color: '#48557a', speed: 30, speedVar: 60, dir: Math.PI / 2, spread: Math.PI,
        life: 0.22, size: 2, sizeVar: 2, grav: 260,
      });
    }
    if (e.dove) {
      this.audio.play('dive');
    }
    if (e.landed) {
      const impact = p.landImpact;
      this.audio.play('land', { impact });
      if (impact > 0.3) {
        this.camera.addShake(impact * 3.2);
        if (impact > 0.62) this.clock.freeze(FEEL.HITSTOP_LAND);
      }
      const n = 3 + Math.round(impact * 7);
      this.particles.burst(p.cx, p.y + p.h, n, {
        color: '#48557a', speed: 40 + impact * 90, speedVar: 70, dir: 0, spread: 0.7,
        life: 0.24, size: 2, sizeVar: 2, grav: 500,
      });
      this.particles.burst(p.cx, p.y + p.h, n, {
        color: '#48557a', speed: 40 + impact * 90, speedVar: 70, dir: Math.PI, spread: 0.7,
        life: 0.24, size: 2, sizeVar: 2, grav: 500,
      });
    }
    if (e.bonked) this.audio.play('bonk');
    void wasGrounded;
  }

  updateTransition(dt, rawDt, cmd) {
    this.room.update(dt, this.entityCtx);
    this.nextRoom?.update(dt, this.entityCtx);
    this.transT = clamp(this.transT + rawDt / FEEL.TRANSITION_TIME, 0, 1);
    const k = easeOutCubic(this.transT);
    const p = this.player;
    p.x = lerp(this.transFrom.x, this.transTo.x, k);
    p.y = lerp(this.transFrom.y, this.transTo.y, this.transT) - Math.sin(this.transT * Math.PI) * 46;
    p.vx = 0;
    p.vy = 0;
    p.sy = 1 + Math.sin(this.transT * Math.PI) * 0.16;
    p.sx = 2 - p.sy;

    if (this.transT >= 1) {
      p.reset(this.room.spawn.x, this.room.spawn.y, this.room.spawn.dir);
      this.prevRoom = null;
      this.hintAge = 0;
      this.state.set(State.PLAYING);
      this.bus.emit('floor_start', { floor: this.floorNumber, id: this.room.def.id });
      // A tap held through the transition should not be eaten by the new floor.
      if (cmd.press) this.input.flush();
    }
  }

  updateDying(dt, cmd) {
    this.room.update(dt, this.entityCtx);
    if (this.state.timeInState > FEEL.DEATH_PANEL_DELAY || (cmd.press && this.state.timeInState > 0.18)) {
      this.toResult();
    }
  }

  updateResult(dt, cmd) {
    this.room.update(dt, this.entityCtx);
    if (cmd.press && this.state.timeInState > 0.12) {
      this.startRun(this.debug.startFloor > 1 ? this.debug.startFloor : 1);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────

  render(frameDt, fps) {
    this.fps = fps;
    const ctx = this.viewport.begin();
    const gfx = this.gfx;

    // Background: a vertical gradient that shifts as the tower climbs.
    const climb = clamp(this.floorNumber / 40, 0, 1);
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.H);
    grad.addColorStop(0, climb > 0.5 ? '#0e0a1c' : COLORS.bg1);
    grad.addColorStop(1, COLORS.bg0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);

    ctx.save();
    ctx.translate(-this.camera.offsetX, -this.camera.offsetY);

    this.drawShaft(gfx);

    if (this.nextRoom) {
      this.nextRoom.drawBackground(gfx);
      this.nextRoom.drawShell(gfx);
      this.nextRoom.draw(gfx, this.entityCtx);
    }
    if (this.prevRoom) {
      this.prevRoom.drawBackground(gfx);
      this.prevRoom.drawShell(gfx);
      this.prevRoom.draw(gfx, this.entityCtx);
    }
    if (this.room) {
      this.room.drawBackground(gfx);
      this.room.drawShell(gfx);
      this.room.draw(gfx, this.entityCtx);
    }

    if (this.room) {
      const fy = this.room.originY + ROOM.H;
      const grad = ctx.createLinearGradient(0, fy, 0, fy + 220);
      grad.addColorStop(0, 'rgba(5,6,12,0.15)');
      grad.addColorStop(1, 'rgba(5,6,12,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, fy, VIEW.W, 240);
      // ...and a matching one above, so the floor above stays a hint, not a spoiler.
      const ty = this.room.originY - ROOM.SLAB;
      const grad2 = ctx.createLinearGradient(0, ty, 0, ty - 210);
      grad2.addColorStop(0, 'rgba(5,6,12,0.5)');
      grad2.addColorStop(1, 'rgba(5,6,12,0.96)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, ty - 210, VIEW.W, 210);
    }

    this.particles.draw(gfx);
    this.player.draw(gfx, this.entityCtx.time);
    this.debug.drawWorld(gfx, this);

    ctx.restore();

    this.drawScreenSpace();
    this.debug.drawOverlay(gfx, this, fps);
    void frameDt;
  }

  /**
   * The tower continues past the room you are standing in. Drawing the shaft
   * across the whole visible range costs a handful of rects and removes the
   * "floating box in a void" look entirely.
   */
  drawShaft(gfx) {
    const top = this.camera.offsetY - 20;
    const bottom = this.camera.offsetY + VIEW.H + 20;
    const h = bottom - top;
    gfx.rect(0, top, ROOM.WALL, h, '#0a0f1c');
    gfx.rect(ROOM.W - ROOM.WALL, top, ROOM.WALL, h, '#0a0f1c');
    gfx.rect(ROOM.WALL - 2, top, 2, h, '#141d33');
    gfx.rect(ROOM.W - ROOM.WALL, top, 2, h, '#141d33');
    const start = Math.floor(top / 34) * 34;
    for (let y = start; y < bottom; y += 34) {
      gfx.rect(3, y, ROOM.WALL - 6, 13, '#070c17', 0.9);
      gfx.rect(ROOM.W - ROOM.WALL + 3, y, ROOM.WALL - 6, 13, '#070c17', 0.9);
    }
    // Faint light spilling from the hatch you are climbing towards.
    if (this.room) {
      const hx = this.room.hatch.x;
      const hy = this.room.originY - ROOM.SLAB;
      const g = gfx.ctx;
      const grad = g.createLinearGradient(0, hy - 96, 0, hy);
      grad.addColorStop(0, 'rgba(124,255,155,0)');
      grad.addColorStop(1, 'rgba(124,255,155,0.05)');
      g.fillStyle = grad;
      g.fillRect(hx + 2, hy - 96, Math.max(0, this.room.hatch.w - 4), 96);
    }
  }

  drawScreenSpace() {
    const s = this.state.current;
    this.ui.drawHudScrim();

    if (s === State.TITLE) {
      this.ui.drawTitle(this.save.bestFloor, this.state.timeInState);
    } else {
      this.ui.drawHud(this.floorNumber, this.save.bestFloor, {
        newRecord: this.floorNumber > this.save.bestFloor && this.save.bestFloor > 0,
        pulse: this.hudPulse,
      });
      if (s === State.PLAYING) this.ui.drawHint(this.room?.def?.hint, this.hintAge);
    }

    if (s === State.RESULT) {
      this.ui.drawResult(this.floorNumber, this.save.bestFloor, this.isRecord, this.deathCause, this.state.timeInState);
    }

    this.ui.drawFlash(this.flashColor, this.flashAlpha);
  }
}

export { roomTopY };
