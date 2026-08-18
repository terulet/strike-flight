/**
 * THE WARDEN — mini boss.
 *
 * Loop the player learns in one cycle:
 *   it locks on -> a shadow marks the ground -> SLAM -> it is stuck and its
 *   core opens on top -> land on it. Three hits and the way up opens.
 *
 * Everything is telegraphed and the punish window is generous; the pressure
 * comes from the sweep beam it adds once it is hurt.
 */
import { COLORS, ROOM } from '../../config.js';
import { Entity, box, solid } from '../entity.js';
import { registerEntity } from '../registry.js';
import { clamp, damp, easeInCubic, easeOutCubic } from '../../core/math.js';

const HOVER = 'hover';
const TELEGRAPH = 'telegraph';
const SLAM = 'slam';
const STUCK = 'stuck';
const RISE = 'rise';
const DEAD = 'dead';

class Boss extends Entity {
  constructor(def, ctx) {
    super(def, ctx);
    this.layer = 48;
    this.w = def.w ?? 92;
    this.h = def.h ?? 62;
    this.hp = def.hp ?? 3;
    this.maxHp = this.hp;
    this.hard = !!def.hard;
    this.hoverY = this.wy(def.hoverY ?? 96);
    this.groundY = this.wy(ROOM.H - ROOM.SLAB) - this.h;
    this.x = def.x ?? (ROOM.W - this.w) / 2;
    this.y = this.hoverY;
    this.phase = HOVER;
    this.timer = 0;
    this.t = 0;
    this.targetX = this.x;
    this.slamFrom = this.y;
    this.hurtFlash = 0;
    this.eyeX = 0;
    this.eyeY = 0;
    this.defeated = false;
    this.deathT = 0;
    this.hoverTime = def.hoverTime ?? (this.hard ? 0.85 : 1.05);
    this.telegraphTime = def.telegraph ?? (this.hard ? 0.42 : 0.55);
    this.slamTime = 0.16;
    this.stuckTime = def.stuckTime ?? (this.hard ? 1.05 : 1.35);
    this.riseTime = 0.62;

    // Body is lethal; the top strip becomes a landing pad while stuck.
    this.hazards.push(box(this.x + 4, this.y + 10, this.w - 8, this.h - 10, 'boss'));
    this.topSolid = solid(this.x + 6, this.y, this.w - 12, 10);
    this.sweep = {
      active: false,
      charge: 0,
      y: this.wy(ROOM.H - ROOM.SLAB - 40),
      box: box(0, 0, ROOM.W, 10, 'laser'),
    };
    this.sweep.box.active = false;
    this.hazards.push(this.sweep.box);
  }

  reset() {
    this.hp = this.maxHp;
    this.phase = HOVER;
    this.timer = 0;
    this.y = this.hoverY;
    this.x = this.def.x ?? (ROOM.W - this.w) / 2;
    this.defeated = false;
    this.deathT = 0;
    this.hurtFlash = 0;
    this.solids.length = 0;
    this.sweep.active = false;
    this.sweep.box.active = false;
    this.hazards[0].active = true;
  }

  get vulnerable() {
    return this.phase === STUCK && !this.defeated;
  }

  hit(ctx) {
    if (!this.vulnerable) return false;
    this.hp -= 1;
    this.hurtFlash = 1;
    ctx?.onBossHit?.(this, this.hp);
    if (this.hp <= 0) {
      this.phase = DEAD;
      this.defeated = true;
      this.deathT = 0;
      this.solids.length = 0;
      this.hazards[0].active = false;
      this.sweep.active = false;
      this.sweep.box.active = false;
      ctx?.onBossDefeated?.(this);
    } else {
      this.phase = RISE;
      this.timer = 0;
      this.solids.length = 0;
    }
    return true;
  }

  update(dt, ctx) {
    this.t += dt;
    this.timer += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    const player = ctx?.player;

    if (this.phase === DEAD) {
      this.deathT += dt;
      this.y += 120 * dt;
      return;
    }

    if (this.phase === HOVER) {
      // Drifts towards the player, slowly enough to be outrun on purpose.
      if (player) this.targetX = clamp(player.cx - this.w / 2, 20, ROOM.W - this.w - 20);
      this.x = damp(this.x, this.targetX, this.hard ? 3.4 : 2.4, dt);
      this.y = this.hoverY + Math.sin(this.t * 2.2) * 6;
      if (this.timer >= this.hoverTime) { this.phase = TELEGRAPH; this.timer = 0; }
    } else if (this.phase === TELEGRAPH) {
      this.y = this.hoverY + Math.sin(this.t * 40) * 2.2 * (this.timer / this.telegraphTime);
      if (this.timer >= this.telegraphTime) {
        this.phase = SLAM;
        this.timer = 0;
        this.slamFrom = this.y;
      }
    } else if (this.phase === SLAM) {
      const k = clamp(this.timer / this.slamTime, 0, 1);
      this.y = this.slamFrom + (this.groundY - this.slamFrom) * easeInCubic(k);
      if (k >= 1) {
        this.phase = STUCK;
        this.timer = 0;
        this.y = this.groundY;
        ctx?.onBossSlam?.(this);
        // Once hurt, it punishes camping with a low sweep beam.
        if (this.hp <= this.maxHp - 1) {
          this.sweep.active = true;
          this.sweep.charge = 0;
        }
      }
    } else if (this.phase === STUCK) {
      if (this.timer >= this.stuckTime) {
        this.phase = RISE;
        this.timer = 0;
        this.solids.length = 0;
      }
    } else if (this.phase === RISE) {
      const k = clamp(this.timer / this.riseTime, 0, 1);
      this.y = this.groundY + (this.hoverY - this.groundY) * easeOutCubic(k);
      if (k >= 1) { this.phase = HOVER; this.timer = 0; }
    }

    // Landing pad only exists while stuck.
    if (this.phase === STUCK) {
      if (this.solids.length === 0) this.solids.push(this.topSolid);
      this.topSolid.x = this.x + 6;
      this.topSolid.y = this.y;
      this.topSolid.dx = 0;
      this.topSolid.dy = 0;
    } else if (this.solids.length) {
      this.solids.length = 0;
    }

    const body = this.hazards[0];
    body.x = this.x + 4;
    body.y = this.y + (this.phase === STUCK ? 12 : 6);
    body.w = this.w - 8;
    body.h = this.h - (this.phase === STUCK ? 12 : 6);
    body.active = !this.defeated;

    // Sweep beam: charges visibly, then fires across the room low to the floor.
    if (this.sweep.active) {
      this.sweep.charge += dt;
      const chargeTime = this.hard ? 0.5 : 0.65;
      const fireTime = 0.5;
      const on = this.sweep.charge > chargeTime && this.sweep.charge < chargeTime + fireTime;
      this.sweep.box.active = on;
      this.sweep.box.x = 0;
      this.sweep.box.y = this.sweep.y;
      this.sweep.box.w = ROOM.W;
      this.sweep.box.h = 9;
      if (this.sweep.charge > chargeTime + fireTime) {
        this.sweep.active = false;
        this.sweep.box.active = false;
      }
    }

    if (player) {
      this.eyeX = damp(this.eyeX, clamp((player.cx - (this.x + this.w / 2)) / 60, -1, 1), 8, dt);
      this.eyeY = damp(this.eyeY, clamp((player.cy - (this.y + this.h / 2)) / 90, -1, 1), 8, dt);
    }
  }

  draw(gfx, ctx) {
    const g = gfx.ctx;
    if (this.defeated && this.deathT > 0.9) return;
    const flash = this.hurtFlash;
    const shake = this.phase === TELEGRAPH ? Math.sin(this.t * 50) * 2.5 : 0;
    const x = this.x + shake;
    const y = this.y;

    // Ground marker while it locks on.
    if (this.phase === TELEGRAPH || this.phase === SLAM) {
      const gy = this.wy(ROOM.H - ROOM.SLAB);
      const k = this.phase === TELEGRAPH ? this.timer / this.telegraphTime : 1;
      gfx.rect(x + 4, y + this.h, this.w - 8, gy - y - this.h, COLORS.boss, 0.06 + k * 0.1);
      gfx.rect(x + 4, gy - 4, this.w - 8, 4, COLORS.danger, 0.35 + k * 0.5);
      gfx.glowRect(x + 4, gy - 4, this.w - 8, 4, COLORS.danger, 0.3 + k * 0.5, 7);
    }

    // Sweep beam
    if (this.sweep.active) {
      const on = this.sweep.box.active;
      if (on) {
        gfx.rect(0, this.sweep.y, ROOM.W, 9, COLORS.laser, 0.95);
        gfx.rect(0, this.sweep.y + 3, ROOM.W, 3, '#fff', 0.6);
        gfx.glowRect(0, this.sweep.y, ROOM.W, 9, COLORS.laser, 0.7, 10);
      } else {
        gfx.rect(0, this.sweep.y + 3.5, ROOM.W, 2, COLORS.warn, 0.5 + Math.sin(this.t * 40) * 0.3);
      }
    }

    const bodyCol = flash > 0 ? '#ffffff' : this.vulnerable ? '#3a1f52' : '#2a1640';
    gfx.roundRect(x, y, this.w, this.h, 12, bodyCol);
    gfx.strokeRoundRect(x, y, this.w, this.h, 12, COLORS.boss, 2, 0.85);
    gfx.glowRect(x, y, this.w, this.h, COLORS.boss, this.vulnerable ? 0.5 : 0.28, 9);

    // Armour plates
    gfx.rect(x + 8, y + this.h - 10, this.w - 16, 5, '#1a0f28');
    for (let i = 0; i < 4; i++) gfx.rect(x + 12 + i * ((this.w - 24) / 4), y + this.h - 9, 6, 3, COLORS.boss, 0.7);

    // Eye
    const ecx = x + this.w / 2 + this.eyeX * 8;
    const ecy = y + this.h / 2 + this.eyeY * 5;
    const eyeCol = this.vulnerable ? COLORS.exit : this.phase === TELEGRAPH ? COLORS.danger : COLORS.boss;
    gfx.circle(x + this.w / 2, y + this.h / 2, 17, '#0b0714');
    gfx.circle(ecx, ecy, 11, eyeCol, 0.95);
    gfx.glowCircle(ecx, ecy, 11, eyeCol, 0.55, 8);
    gfx.circle(ecx + this.eyeX * 2, ecy + this.eyeY * 2, 4.5, '#0b0714');

    // Weak point while stuck: unmissable target on the crown.
    if (this.vulnerable) {
      const pulse = 0.6 + Math.sin(this.t * 14) * 0.4;
      gfx.rect(x + 6, y - 3, this.w - 12, 6, COLORS.exit, 0.55 + pulse * 0.35);
      gfx.glowRect(x + 6, y - 3, this.w - 12, 6, COLORS.exit, 0.5 + pulse * 0.4, 8);
      for (let i = 0; i < 2; i++) {
        const off = ((ctx?.time ?? this.t) * 40 + i * 18) % 36;
        const ay = y - 14 - off;
        const a = clamp(1 - off / 34, 0, 1) * 0.8;
        gfx.line(x + this.w / 2 - 8, ay, x + this.w / 2, ay + 8, COLORS.exit, 2.5, a);
        gfx.line(x + this.w / 2, ay + 8, x + this.w / 2 + 8, ay, COLORS.exit, 2.5, a);
      }
    }

    // HP pips
    for (let i = 0; i < this.maxHp; i++) {
      const px = x + this.w / 2 - (this.maxHp * 9) / 2 + i * 9;
      gfx.rect(px, y - 12, 6, 3, i < this.hp ? COLORS.boss : '#241a33', i < this.hp ? 1 : 0.8);
    }
    g.globalAlpha = 1;
  }
}

registerEntity('boss', (def, ctx) => new Boss(def, ctx), { lethal: true, boss: true });
export { Boss, HOVER, TELEGRAPH, SLAM, STUCK, RISE, DEAD };
