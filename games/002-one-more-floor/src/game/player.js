/**
 * The player: a little cyan bot with a visor.
 *
 * Control contract (one finger):
 *   press          -> jump, fired on pointer DOWN so it is never late
 *   hold + grounded-> brake to a stop (wait for the laser to pass)
 *   release        -> resume running
 *   swipe down     -> dive (fast fall + slam)
 *   swipe left/righ-> face that way; the bot runs on its own, this overrides it
 *
 * Fairness helpers baked in: coyote time, jump buffering, a forgiving hazard
 * hitbox, and a full-speed impulse on standing jumps so a jump from a dead
 * stop covers the same gap as a running one.
 */
import { COLORS, PLAYER } from '../config.js';
import { approach, clamp, damp, sign } from '../core/math.js';
import { groundUnder, moveAndCollide } from '../systems/collision.js';

const TRAIL = 10;

export class Player {
  constructor() {
    this.w = PLAYER.W;
    this.h = PLAYER.H;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.dir = 1;
    this.grounded = false;
    this.wasGrounded = false;
    this.braking = false;
    this.diving = false;
    this.jumping = false;
    this.dead = false;
    this.coyote = 0;
    this.buffer = 0;
    this.airTime = 0;
    this.runAnim = 0;
    this.sx = 1;
    this.sy = 1;
    this.lean = 0;
    this.blink = 0;
    this.spawnSafe = 0;
    this.rideId = null;
    this.landImpact = 0;
    this.bonk = 0;
    this.trailX = new Float32Array(TRAIL);
    this.trailY = new Float32Array(TRAIL);
    this.trailN = 0;
    this._col = { hitLeft: false, hitRight: false, hitTop: false, hitBottom: false, ground: null };
    /** Set by the game each step; consumed by the renderer/audio for feedback. */
    this.events = { jumped: false, landed: false, dove: false, bonked: false };
  }

  reset(x, y, dir = 1) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = dir;
    this.grounded = false;
    this.wasGrounded = false;
    this.braking = false;
    this.diving = false;
    this.jumping = false;
    this.dead = false;
    this.coyote = 0;
    this.buffer = 0;
    this.airTime = 0;
    this.runAnim = 0;
    this.sx = 1;
    this.sy = 1;
    this.lean = 0;
    this.spawnSafe = PLAYER.SPAWN_SAFE_TIME;
    this.rideId = null;
    this.landImpact = 0;
    this.bonk = 0;
    this.trailN = 0;
    for (let i = 0; i < TRAIL; i++) {
      this.trailX[i] = x;
      this.trailY[i] = y;
    }
    this._clearEvents();
  }

  _clearEvents() {
    this.events.jumped = false;
    this.events.landed = false;
    this.events.dove = false;
    this.events.bonked = false;
  }

  /** Forgiving hitbox used against hazards (never against solids). */
  get hitX() { return this.x + PLAYER.HIT_INSET_X; }
  get hitY() { return this.y + PLAYER.HIT_INSET_Y; }
  get hitW() { return this.w - PLAYER.HIT_INSET_X * 2; }
  get hitH() { return this.h - PLAYER.HIT_INSET_Y * 2; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  jump(strength = 1) {
    this.vy = PLAYER.JUMP_VEL * strength;
    this.jumping = true;
    this.grounded = false;
    this.braking = false;
    this.diving = false;
    this.coyote = 0;
    this.buffer = 0;
    this.airTime = 0;
    // Standing jumps launch at full speed: waiting at a ledge is never a trap.
    if (Math.abs(this.vx) < PLAYER.RUN_SPEED * 0.7) this.vx = PLAYER.RUN_SPEED * this.dir;
    this.sx = 0.74;
    this.sy = 1.3;
    this.events.jumped = true;
  }

  dive() {
    if (this.diving) return;
    if (this.grounded) {
      // Grounded swipe-down = skid stop. Gives the player a way to plant their
      // feet without the little hop that pressing to brace would cost them.
      this.vx = 0;
      this.sx = 1.22;
      this.sy = 0.8;
      this.events.dove = true;
      return;
    }
    this.vy = PLAYER.DIVE_VEL;
    this.diving = true;
    this.jumping = false;
    this.sx = 0.7;
    this.sy = 1.34;
    this.events.dove = true;
  }

  /**
   * @param {number} dt
   * @param {{press:boolean, held:boolean, swipeDown:boolean}} cmd
   * @param {Array} solids world-space solids for this room
   */
  update(dt, cmd, solids) {
    this._clearEvents();
    if (dt <= 0 || this.dead) return;

    if (this.spawnSafe > 0) this.spawnSafe -= dt;

    // --- intent ----------------------------------------------------------
    if (cmd.press) this.buffer = PLAYER.JUMP_BUFFER;
    if (cmd.swipeDown) this.dive();
    if (cmd.face) this.dir = cmd.face;

    this.braking = cmd.held && this.grounded;

    if (this.buffer > 0) this.buffer -= dt;
    if (this.coyote > 0) this.coyote -= dt;
    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) this.jump();

    // Variable jump height: releasing early clips the upward velocity.
    if (this.jumping && !cmd.held && this.vy < PLAYER.JUMP_CUT_VEL) {
      this.vy = PLAYER.JUMP_CUT_VEL;
      this.jumping = false;
    }
    if (this.vy >= 0) this.jumping = false;

    // --- horizontal ------------------------------------------------------
    const target = this.braking ? 0 : PLAYER.RUN_SPEED * this.dir;
    const accel = this.braking ? PLAYER.BRAKE : PLAYER.ACCEL;
    this.vx = approach(this.vx, target, accel * dt);

    // --- vertical --------------------------------------------------------
    const g = PLAYER.GRAVITY * (this.vy > 0 ? PLAYER.FALL_GRAVITY_MULT : 1);
    const maxFall = this.diving ? PLAYER.DIVE_VEL : PLAYER.MAX_FALL;
    this.vy = Math.min(maxFall, this.vy + g * dt);

    // --- carry by moving platforms ---------------------------------------
    if (this.rideId != null) {
      const ride = solids.find((s) => s.id === this.rideId);
      if (ride && (ride.dx || ride.dy)) {
        this.x += ride.dx;
        this.y += ride.dy;
      }
    }

    // --- integrate + resolve ---------------------------------------------
    const col = moveAndCollide(this, this.vx * dt, this.vy * dt, solids, this._col);

    if (col.hitLeft || col.hitRight) {
      if (Math.abs(this.vx) > 40) {
        this.bonk = 1;
        this.events.bonked = true;
      }
      this.dir = col.hitLeft ? 1 : -1;
      this.vx = 0;
    }
    if (col.hitTop && this.vy < 0) this.vy = 0;

    this.wasGrounded = this.grounded;
    if (col.hitBottom) {
      this.grounded = true;
      this.rideId = col.ground?.id ?? null;
      if (!this.wasGrounded) {
        this.landImpact = clamp(Math.abs(this.vy) / PLAYER.MAX_FALL, 0, 1);
        const squash = this.diving ? 0.5 : 0.62 + (1 - this.landImpact) * 0.28;
        this.sy = squash;
        this.sx = 2 - squash;
        this.events.landed = true;
      }
      this.vy = 0;
      this.diving = false;
      this.coyote = PLAYER.COYOTE;
    } else {
      const g2 = groundUnder(this, solids);
      if (g2) {
        this.grounded = true;
        this.rideId = g2.id ?? null;
        this.coyote = PLAYER.COYOTE;
      } else {
        if (this.grounded) this.coyote = PLAYER.COYOTE;
        this.grounded = false;
        this.rideId = null;
      }
    }

    if (!this.grounded) this.airTime += dt;
    else this.airTime = 0;

    // --- cosmetic --------------------------------------------------------
    this.runAnim += Math.abs(this.vx) * dt * 0.09;
    this.sx = damp(this.sx, 1, PLAYER.HIT_INSET_X ? 14 : 14, dt);
    this.sy = damp(this.sy, 1, 14, dt);
    if (!this.grounded) {
      // Stretch while rising / falling fast.
      const stretch = clamp(this.vy / 700, -1, 1);
      this.sy = damp(this.sy, 1 + Math.abs(stretch) * 0.16, 8, dt);
      this.sx = damp(this.sx, 1 - Math.abs(stretch) * 0.13, 8, dt);
    }
    this.lean = damp(this.lean, clamp(this.vx / PLAYER.RUN_SPEED, -1, 1) * 0.16, 10, dt);
    this.bonk = Math.max(0, this.bonk - dt * 5);
    this.blink -= dt;
    if (this.blink < -2.6) this.blink = 0.12;

    // Trail ring buffer (used for the dive/fast-fall smear).
    this.trailN = (this.trailN + 1) % TRAIL;
    this.trailX[this.trailN] = this.cx;
    this.trailY[this.trailN] = this.cy;
  }

  /** Facing sign used by the renderer (never 0). */
  get facing() {
    return sign(this.vx) || this.dir;
  }

  /**
   * Draws the bot. Squash and stretch pivot on the feet so landings read as
   * weight rather than as the sprite sliding into the floor.
   */
  draw(gfx, time = 0) {
    if (this.dead) return;
    const g = gfx.ctx;
    const face = this.facing;

    // Dive smear.
    if (this.diving || this.vy > 520) {
      for (let i = 1; i < 5; i++) {
        const idx = (this.trailN - i * 2 + 40) % 10;
        gfx.roundRect(this.trailX[idx] - this.w * 0.34, this.trailY[idx] - this.h * 0.34,
          this.w * 0.68, this.h * 0.68, 5, COLORS.player, 0.1 - i * 0.02);
      }
    }

    const cx = this.x + this.w / 2;
    const by = this.y + this.h;
    const w = this.w * this.sx;
    const h = this.h * this.sy;

    g.save();
    g.translate(cx, by);
    g.rotate(this.lean * face * 0.5);
    const x = -w / 2;
    const y = -h;

    gfx.glowRect(x, y, w, h, COLORS.player, this.braking ? 0.24 : 0.4, 7);
    gfx.roundRect(x, y, w, h, 7, COLORS.player);
    gfx.roundRect(x, y + h * 0.62, w, h * 0.38, 6, COLORS.playerDark, 0.55);

    // Visor: squints while braking, widens while falling.
    const open = this.braking ? 0.45 : this.grounded ? 1 : this.vy > 260 ? 1.35 : 1.1;
    const blink = this.blink > 0 ? 0.15 : 1;
    const vh = 6 * open * blink;
    const vw = w * 0.62;
    gfx.roundRect(x + (w - vw) / 2 + face * 1.6, y + h * 0.26 - vh / 2, vw, Math.max(1.2, vh), 3, COLORS.playerEye);
    gfx.rect(x + (w - vw) / 2 + face * 1.6 + 1.5, y + h * 0.26 - vh / 2 + 1, 3, Math.max(1, vh * 0.4), '#bff4ff', 0.85 * blink);

    // Legs while running on the ground.
    if (this.grounded && Math.abs(this.vx) > 12) {
      const swing = Math.sin(this.runAnim * 6) * 3.2;
      gfx.rect(x + 3, -2, 4, 3 + swing, COLORS.playerDark);
      gfx.rect(x + w - 7, -2, 4, 3 - swing, COLORS.playerDark);
    } else if (this.grounded) {
      gfx.rect(x + 3, -2, 4, 3, COLORS.playerDark);
      gfx.rect(x + w - 7, -2, 4, 3, COLORS.playerDark);
    }

    // Antenna: lags behind the movement, sells the acceleration.
    const tilt = -this.vx / PLAYER.RUN_SPEED * 0.5 + Math.sin(time * 7) * 0.05;
    const ax = Math.sin(tilt) * 9;
    const ay = -Math.cos(tilt) * 9;
    gfx.line(0, y + 2, ax, y + 2 + ay, COLORS.playerDark, 2, 0.9);
    gfx.circle(ax, y + 2 + ay, 2.4, this.braking ? COLORS.warn : COLORS.player);
    gfx.glowCircle(ax, y + 2 + ay, 2.4, this.braking ? COLORS.warn : COLORS.player, 0.5, 4);

    g.restore();

    if (this.bonk > 0) {
      gfx.circle(cx + face * this.w * 0.6, this.y + this.h * 0.4, 4 + this.bonk * 5, COLORS.warn, this.bonk * 0.5);
    }
  }
}
