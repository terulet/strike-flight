/**
 * Axis-separated AABB collision. Deliberately boring: move on X, resolve; move
 * on Y, resolve. Predictable resolution is what makes deaths feel fair —
 * there is no situation where the player "clips" or gets nudged sideways by a
 * corner they were clearly on top of.
 */
import { aabb } from '../core/math.js';

/** A solid: { x, y, w, h, oneWay?, id?, dx?, dy? } in world coordinates. */

export function overlapsAny(x, y, w, h, boxes) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (aabb(x, y, w, h, b.x, b.y, b.w, b.h)) return b;
  }
  return null;
}

/**
 * Moves a body (mutating body.x / body.y) against a list of solids.
 * `result` is reused to avoid per-frame allocations.
 */
export function moveAndCollide(body, dx, dy, solids, result) {
  const r = result || { hitLeft: false, hitRight: false, hitTop: false, hitBottom: false, ground: null };
  r.hitLeft = r.hitRight = r.hitTop = r.hitBottom = false;
  r.ground = null;

  // --- X axis -------------------------------------------------------------
  if (dx !== 0) {
    body.x += dx;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (s.oneWay) continue;
      if (!aabb(body.x, body.y, body.w, body.h, s.x, s.y, s.w, s.h)) continue;
      if (dx > 0) {
        body.x = s.x - body.w;
        r.hitRight = true;
      } else {
        body.x = s.x + s.w;
        r.hitLeft = true;
      }
    }
  }

  // --- Y axis -------------------------------------------------------------
  if (dy !== 0) {
    const prevBottom = body.y + body.h;
    body.y += dy;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (!aabb(body.x, body.y, body.w, body.h, s.x, s.y, s.w, s.h)) continue;
      if (s.oneWay) {
        // Only lands on a one-way platform when falling and previously above it.
        if (dy <= 0) continue;
        if (prevBottom > s.y + 0.6) continue;
      }
      if (dy > 0) {
        body.y = s.y - body.h;
        r.hitBottom = true;
        r.ground = s;
      } else {
        body.y = s.y + s.h;
        r.hitTop = true;
      }
    }
  }

  return r;
}

/** Ground probe: is there a solid directly under the body? */
export function groundUnder(body, solids, eps = 1.5) {
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (aabb(body.x, body.y + eps, body.w, body.h, s.x, s.y, s.w, s.h)) {
      if (s.oneWay && body.y + body.h - eps > s.y + 0.6) continue;
      return s;
    }
  }
  return null;
}
