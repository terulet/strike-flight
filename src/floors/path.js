/**
 * Movement paths for hazards. Declarative in the floor data:
 *   { type:'line', to:{x,y}, time:2, phase:0, ease:'sine' }
 *   { type:'orbit', cx, cy, r, time:3, phase:0 }
 *   { type:'none' }
 * `phase` (0..1) offsets the cycle so several hazards can share one rhythm
 * while staying out of sync — the basis of every readable timing puzzle here.
 */
import { pingPong } from '../core/math.js';

/**
 * Path Y coordinates are authored in room-local space like everything else in
 * a definition; entities live in world space. This lifts a path into world
 * space once, at construction.
 */
export function toWorldPath(path, originY) {
  if (!path || path.type === 'none' || !originY) return path;
  const p = { ...path };
  if (p.to) p.to = { ...p.to, y: (p.to.y ?? 0) + originY };
  if (typeof p.cy === 'number') p.cy += originY;
  return p;
}

export function pathPosition(path, x0, y0, t, out = { x: 0, y: 0 }) {
  if (!path || path.type === 'none') {
    out.x = x0;
    out.y = y0;
    return out;
  }
  const time = path.time || 2;
  const phase = path.phase || 0;
  const u = (t / time + phase) % 1;

  if (path.type === 'orbit') {
    const a = u * Math.PI * 2 + (path.startAngle || 0);
    const dir = path.reverse ? -1 : 1;
    out.x = (path.cx ?? x0) + Math.cos(a * dir) * (path.r || 40);
    out.y = (path.cy ?? y0) + Math.sin(a * dir) * (path.r || 40);
    return out;
  }

  // line: ping-pongs between (x0,y0) and `to`.
  let k = pingPong(u * 2);
  if (path.ease === 'sine') k = 0.5 - 0.5 * Math.cos(k * Math.PI);
  const tx = path.to?.x ?? x0;
  const ty = path.to?.y ?? y0;
  out.x = x0 + (tx - x0) * k;
  out.y = y0 + (ty - y0) * k;
  return out;
}

/**
 * Mirrors a path definition horizontally around the room width.
 * `width` is the entity's own width: path coordinates are top-left anchored
 * like the entity itself, so mirroring without it slides every moving
 * platform sideways by its own width.
 */
export function mirrorPath(path, roomW, width = 0) {
  if (!path || path.type === 'none') return path;
  const p = { ...path };
  if (p.to) p.to = { ...p.to, x: roomW - p.to.x - width };
  if (typeof p.cx === 'number') p.cx = roomW - p.cx - width;
  if (p.type === 'orbit') p.reverse = !p.reverse;
  return p;
}
