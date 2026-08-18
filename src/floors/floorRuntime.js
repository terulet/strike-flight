/**
 * A live floor: turns a definition (pure data) into a playable room.
 *
 * Rooms are stacked in world space, so "ascending" is just the camera moving
 * up. Every floor is authored left-to-right and mirrored automatically when
 * the player enters from the right, which is what makes the climb zig-zag
 * naturally without authoring two versions of anything.
 */
import { COLORS, ROOM } from '../config.js';
import { aabb, circleAabb } from '../core/math.js';
import { createEntity } from './registry.js';
import { solid } from './entity.js';
import { mirrorPath } from './path.js';
import { roomTopY } from '../systems/camera.js';

export const FLOOR_TOP = ROOM.H - ROOM.SLAB;
export const HATCH_W = 52;

/** Width used to mirror an entity around the room's vertical axis. */
function defWidth(def) {
  switch (def.type) {
    case 'saw': return 0;
    case 'laser': return def.orient === 'v' ? (def.thickness ?? 8) : (def.len ?? 200);
    default: return def.w ?? 0;
  }
}

export function mirrorEntityDef(def, roomW = ROOM.W) {
  const m = { ...def };
  const w = defWidth(def);
  if (typeof def.x === 'number') m.x = roomW - def.x - w;
  if (def.path) m.path = mirrorPath(def.path, roomW, w);
  if (def.slots) m.slots = def.slots.map((s) => ({ ...s, x: roomW - s.x - (s.w ?? def.w ?? 34) }));
  if (def.type === 'walker') {
    const left = def.left ?? def.x - 50;
    const right = def.right ?? def.x + 50;
    m.left = roomW - right;
    m.right = roomW - left;
    m.dir = -(def.dir ?? 1);
  }
  if (def.type === 'spikes') {
    if (def.dir === 'left') m.dir = 'right';
    else if (def.dir === 'right') m.dir = 'left';
  }
  return m;
}

export function mirrorDefinition(def, roomW = ROOM.W) {
  return {
    ...def,
    mirrored: !def.mirrored,
    pits: (def.pits || []).map((p) => ({ ...p, x: roomW - p.x - p.w })),
    entities: (def.entities || []).map((e) => mirrorEntityDef(e, roomW)),
  };
}

export class Room {
  /**
   * @param {object} def floor definition (already resolved by FloorManager)
   * @param {number} floorNumber 1-based
   * @param {object} opts { rng, mirrored }
   */
  constructor(def, floorNumber, opts = {}) {
    this.floorNumber = floorNumber;
    this.originY = roomTopY(floorNumber);
    this.def = opts.mirrored ? mirrorDefinition(def) : def;
    this.mirrored = !!opts.mirrored;
    this.rng = opts.rng ?? null;
    this.time = 0;
    this.completed = false;
    this.entities = [];
    this.solids = [];
    this.hazards = [];
    this.staticSolids = [];
    this.crumbles = [];
    this.walkers = [];
    this.boss = null;
    this.exitEntity = null;
    this.exitIsDoors = false;

    const ctx = { originY: this.originY, rng: this.rng, floorNumber };

    // --- shell ------------------------------------------------------------
    const top = this.originY;
    this.staticSolids.push(solid(0, top, ROOM.WALL, ROOM.H, { wall: true }));
    this.staticSolids.push(solid(ROOM.W - ROOM.WALL, top, ROOM.WALL, ROOM.H, { wall: true }));

    // Floor slab, split around pits.
    const pits = (this.def.pits || []).slice().sort((a, b) => a.x - b.x);
    let cursor = 0;
    for (const p of pits) {
      const w = Math.max(0, p.x - cursor);
      if (w > 0) this.staticSolids.push(solid(cursor, top + FLOOR_TOP, w, ROOM.SLAB, { floor: true }));
      cursor = p.x + p.w;
    }
    if (cursor < ROOM.W) {
      this.staticSolids.push(solid(cursor, top + FLOOR_TOP, ROOM.W - cursor, ROOM.SLAB, { floor: true }));
    }

    // --- entities ---------------------------------------------------------
    for (const eDef of this.def.entities || []) {
      const e = createEntity(eDef, ctx);
      this.entities.push(e);
      if (eDef.type === 'crumble') this.crumbles.push(e);
      if (eDef.type === 'walker') this.walkers.push(e);
      if (eDef.type === 'boss') this.boss = e;
      if (eDef.type === 'exit') this.exitEntity = e;
      if (eDef.type === 'doors') { this.exitEntity = e; this.exitIsDoors = true; }
    }

    if (!this.exitEntity) {
      const x = this.mirrored ? 26 : ROOM.W - 60;
      const e = createEntity({ type: 'exit', x, y: FLOOR_TOP - 8, w: 34, h: 8 }, ctx);
      this.entities.push(e);
      this.exitEntity = e;
    }

    this.entities.sort((a, b) => a.layer - b.layer);

    // --- ceiling with a hatch above the way out ---------------------------
    const ex = this.exitCenterX();
    const hatchL = Math.max(ROOM.WALL, ex - HATCH_W / 2);
    const hatchR = Math.min(ROOM.W - ROOM.WALL, ex + HATCH_W / 2);
    this.hatch = { x: hatchL, w: hatchR - hatchL };
    if (hatchL > 0) this.staticSolids.push(solid(0, top - ROOM.SLAB, hatchL, ROOM.SLAB, { ceiling: true }));
    if (hatchR < ROOM.W) this.staticSolids.push(solid(hatchR, top - ROOM.SLAB, ROOM.W - hatchR, ROOM.SLAB, { ceiling: true }));

    // --- spawn ------------------------------------------------------------
    this.spawn = {
      x: this.mirrored ? ROOM.W - ROOM.WALL - 12 - 22 : ROOM.WALL + 12,
      y: this.originY + FLOOR_TOP - 30,
      dir: this.mirrored ? -1 : 1,
    };

    this.rebuildLists();
  }

  exitCenterX() {
    const e = this.exitEntity;
    if (!e) return ROOM.W / 2;
    if (this.exitIsDoors) {
      const s = e.exitSlot;
      return s ? s.x + s.w / 2 : ROOM.W / 2;
    }
    return e.x + e.w / 2;
  }

  /** Exit is inert while a boss is alive. */
  get exitLocked() {
    return !!(this.boss && !this.boss.defeated);
  }

  rebuildLists() {
    const solids = this.solids;
    const hazards = this.hazards;
    solids.length = 0;
    hazards.length = 0;
    for (let i = 0; i < this.staticSolids.length; i++) solids.push(this.staticSolids[i]);
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      for (let j = 0; j < e.solids.length; j++) solids.push(e.solids[j]);
      for (let j = 0; j < e.hazards.length; j++) {
        const h = e.hazards[j];
        if (h.active) hazards.push(h);
      }
    }
  }

  update(dt, ctx) {
    this.time += dt;
    for (let i = 0; i < this.entities.length; i++) this.entities[i].update(dt, ctx);
    this.rebuildLists();
  }

  /** Returns the death cause string if the player is touching something lethal. */
  checkHazards(player) {
    if (player.spawnSafe > 0) return null;
    const px = player.hitX;
    const py = player.hitY;
    const pw = player.hitW;
    const ph = player.hitH;
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (h.kind === 'circle') {
        if (circleAabb(h.x, h.y, h.r, px, py, pw, ph)) return h.cause;
      } else if (aabb(px, py, pw, ph, h.x, h.y, h.w, h.h)) {
        return h.cause;
      }
    }
    return null;
  }

  /** True when the player has reached the way up. */
  checkExit(player) {
    if (this.exitLocked) return false;
    const e = this.exitEntity;
    if (!e) return false;
    if (this.exitIsDoors) return e.containsExit(player.hitX, player.hitY, player.hitW, player.hitH);
    return e.contains(player.hitX, player.hitY, player.hitW, player.hitH);
  }

  /** Crumble tiles react to whatever the player is standing on. */
  touchCrumbles(player, hardImpact) {
    if (!player.grounded || !this.crumbles.length) return;
    for (let i = 0; i < this.crumbles.length; i++) {
      const c = this.crumbles[i];
      const s = c.solids[0];
      if (!s) continue;
      if (player.rideId === s.id || aabb(player.x, player.y + player.h - 1, player.w, 3, s.x, s.y, s.w, 4)) {
        c.touch(hardImpact);
      }
    }
  }

  /** Landing on a walker's head kills it and bounces the player. */
  checkStomps(player, ctx) {
    if (!this.walkers.length || player.vy < 0) return null;
    for (let i = 0; i < this.walkers.length; i++) {
      const wlk = this.walkers[i];
      if (!wlk.alive) continue;
      const b = wlk.stompBox;
      const feetY = player.y + player.h;
      if (feetY >= b.y - 2 && feetY <= b.y + b.h + 4 &&
          player.x + player.w > b.x + 2 && player.x < b.x + b.w - 2) {
        wlk.stomp(ctx);
        return wlk;
      }
    }
    return null;
  }

  /** Landing on the boss's crown damages it. */
  checkBossStomp(player, ctx) {
    if (!this.boss || !this.boss.vulnerable) return false;
    if (player.rideId === this.boss.topSolid.id && player.grounded) {
      return this.boss.hit(ctx);
    }
    return false;
  }

  get bottomY() {
    return this.originY + ROOM.H;
  }

  // --- rendering ----------------------------------------------------------

  drawBackground(gfx) {
    const top = this.originY;
    const g = gfx.ctx;
    // Room shaft
    gfx.rect(0, top, ROOM.W, ROOM.H, COLORS.roomFill);
    // Faint grid gives the climb a sense of speed without costing anything.
    g.globalAlpha = 0.5;
    g.strokeStyle = '#121a30';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = ROOM.WALL; x <= ROOM.W - ROOM.WALL; x += 24) {
      g.moveTo(x + 0.5, top + 6);
      g.lineTo(x + 0.5, top + ROOM.H - ROOM.SLAB);
    }
    for (let y = top + 18; y < top + ROOM.H - ROOM.SLAB; y += 24) {
      g.moveTo(ROOM.WALL, y + 0.5);
      g.lineTo(ROOM.W - ROOM.WALL, y + 0.5);
    }
    g.stroke();
    g.globalAlpha = 1;

    // Big ghosted floor number painted on the back wall.
    gfx.text(String(this.floorNumber).padStart(2, '0'), ROOM.W / 2, top + ROOM.H * 0.4, {
      size: 118, color: '#141d36', alpha: 0.75, weight: 800,
    });

    // Walls
    for (const s of this.staticSolids) {
      if (s.wall) {
        gfx.rect(s.x, s.y, s.w, s.h, '#101728');
        gfx.rect(s.x + (s.x === 0 ? s.w - 2 : 0), s.y, 2, s.h, '#1d2942');
        for (let y = s.y + 10; y < s.y + s.h; y += 32) gfx.rect(s.x + 3, y, s.w - 6, 12, '#0c1220', 0.8);
      }
    }
  }

  drawShell(gfx) {
    // Floor + ceiling slabs, drawn after the background so pits read clearly.
    for (const s of this.staticSolids) {
      if (s.wall) continue;
      gfx.rect(s.x, s.y, s.w, s.h, COLORS.solid);
      if (s.floor) {
        gfx.rect(s.x, s.y, s.w, 3, COLORS.solidTop);
        gfx.rect(s.x, s.y + 3, s.w, 1, '#0a0e18', 0.6);
      } else {
        gfx.rect(s.x, s.y + s.h - 3, s.w, 3, '#0d1424');
      }
    }
    // Hatch lip so the way out is legible from below.
    const top = this.originY;
    gfx.rect(this.hatch.x - 2, top - ROOM.SLAB, 2, ROOM.SLAB, '#22304e');
    gfx.rect(this.hatch.x + this.hatch.w, top - ROOM.SLAB, 2, ROOM.SLAB, '#22304e');
  }

  draw(gfx, ctx) {
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e === this.exitEntity && this.exitLocked) continue;
      e.draw(gfx, ctx);
    }
  }
}
