/**
 * Static reachability analysis for a built room.
 *
 * Rather than hoping a bot stumbles into the exit, this models the jump arc
 * from the real physics constants and asks a graph question: from the surface
 * you spawn on, can you reach the surface the exit sits on?
 *
 * It is intentionally conservative — it only ever claims a jump is possible
 * when the arc clears it with margin — so a floor that passes is a floor a
 * human can clear.
 */
import { PLAYER, ROOM } from '../../src/config.js';
import { pathPosition } from '../../src/floors/path.js';

const V0 = -PLAYER.JUMP_VEL;                 // 470
const G_UP = PLAYER.GRAVITY;                 // 1500
const G_DOWN = PLAYER.GRAVITY * PLAYER.FALL_GRAVITY_MULT;
export const MAX_HEIGHT = (V0 * V0) / (2 * G_UP);
const T_APEX = V0 / G_UP;
const SAFETY = 0.85;

/** Horizontal distance available when landing `up` units above the take-off. */
export function reachAt(up) {
  if (up > MAX_HEIGHT) return -1;
  const fall = Math.sqrt((2 * (MAX_HEIGHT - up)) / G_DOWN);
  return PLAYER.RUN_SPEED * (T_APEX + fall) * SAFETY;
}

/** Every surface the player could stand on, including platform extremes. */
export function surfaces(room) {
  const out = [];
  const push = (x, w, y, owner) => out.push({ x, w, y, owner, id: out.length });

  for (const s of room.staticSolids) {
    if (s.floor) push(s.x, s.w, s.y, 'floor');
  }

  for (const e of room.entities) {
    if (e.type === 'platform') {
      const pos = { x: 0, y: 0 };
      const samples = e.path?.type === 'orbit' ? 8 : 2;
      for (let i = 0; i < samples; i++) {
        const t = (i / samples) * (e.path?.time || 2);
        pathPosition(e.path, e.x0, e.y0, e.path?.type === 'orbit' ? t : (i === 0 ? 0 : (e.path.time || 2) / 2), pos);
        push(pos.x, e.w, pos.y, e.id);
      }
    } else if (e.type === 'crumble') {
      push(e.x, e.w, e.y, e.id);
    } else if (e.solids.length) {
      for (const s of e.solids) push(s.x, s.w, s.y, e.id);
    }
  }
  return out;
}

const gapX = (a, b) => {
  if (a.x + a.w < b.x) return b.x - (a.x + a.w);
  if (b.x + b.w < a.x) return a.x - (b.x + b.w);
  return 0;
};

export function canJump(a, b) {
  const up = a.y - b.y;                    // positive when b is higher
  const reach = reachAt(Math.max(0, up));
  if (reach < 0) return false;
  if (up > MAX_HEIGHT * 0.92) return false;
  return gapX(a, b) <= reach;
};

export function reachableSet(room) {
  const nodes = surfaces(room);
  const start = nodes.filter((n) =>
    room.spawn.x + PLAYER.W > n.x - 2 && room.spawn.x < n.x + n.w + 2 &&
    Math.abs(n.y - (room.spawn.y + PLAYER.H)) < 6);
  const seen = new Set(start.map((n) => n.id));
  const queue = [...start];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of nodes) {
      if (seen.has(n.id)) continue;
      // Riding the same moving platform connects its extremes for free.
      const sameOwner = cur.owner === n.owner && cur.owner !== 'floor';
      if (sameOwner || canJump(cur, n)) {
        seen.add(n.id);
        queue.push(n);
      }
    }
  }
  return { nodes, reachable: nodes.filter((n) => seen.has(n.id)) };
}

/** The surface the way out stands on. */
export function exitSurface(room, nodes) {
  const e = room.exitEntity;
  let x;
  let w;
  let bottom;
  if (room.exitIsDoors) {
    const slot = e.exitSlot;
    x = slot.x;
    w = slot.w;
    bottom = slot.y + slot.h;
  } else {
    x = e.x;
    w = e.w;
    bottom = e.y + e.h;
  }
  return nodes.filter((n) =>
    x + w > n.x - 4 && x < n.x + n.w + 4 && Math.abs(n.y - bottom) < 10);
}

export function analyse(room) {
  const { nodes, reachable } = reachableSet(room);
  const exits = exitSurface(room, nodes);
  const ids = new Set(reachable.map((n) => n.id));
  return {
    nodes,
    reachable,
    exits,
    exitReachable: exits.length > 0 && exits.some((n) => ids.has(n.id)),
    withinBounds: nodes.every((n) => n.x >= -1 && n.x + n.w <= ROOM.W + 1),
  };
}
