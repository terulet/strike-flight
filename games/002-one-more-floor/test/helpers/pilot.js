/**
 * Heuristic pilots used to prove floors can actually be finished.
 *
 * They are not clever and they are not meant to be: they read the room the
 * way a first-time player does (gap ahead, wall ahead, something lethal
 * ahead, a ledge worth taking) and are run many times with different
 * reflexes. If none of a few hundred variations can finish a floor, that
 * floor is telling us something.
 */
import { makeRng } from '../../src/core/rng.js';
import { buildFloor, run } from './sim.js';

/** Hazards worth waiting out. The rest never switch off, so waiting is a stall. */
const CYCLIC = new Set(['laser', 'fire', 'crush', 'saw']);

export function heuristicPilot(rng, tune) {
  let waiting = 0;
  let riding = 0;
  return (step, { room, player }) => {
    if (!player.grounded) return { press: false, held: player.vy < 0, swipeDown: false, face: 0 };
    if (step < tune.startDelay) return { press: false, held: true, swipeDown: false, face: 0 };

    const feet = player.y + player.h;
    const front = player.dir > 0 ? player.x + player.w : player.x;
    const towardExit = Math.sign(room.exitCenterX() - player.cx) || player.dir;

    const probe = player.cx + player.dir * tune.probe;
    const ground = room.solids.some((s) =>
      probe > s.x - 2 && probe < s.x + s.w + 2 && s.y > feet - 6 && s.y < feet + 30);
    const bx = player.dir > 0 ? player.x + player.w : player.x - 26;
    const blocked = room.solids.some((s) =>
      bx < s.x + s.w && bx + 26 > s.x && player.y + 6 < s.y + s.h && feet - 4 > s.y);

    let jump = false;
    let danger = false;
    for (const h of room.hazards) {
      const hx = h.kind === 'circle' ? h.x - h.r : h.x;
      const hw = h.kind === 'circle' ? h.r * 2 : h.w;
      const hy = h.kind === 'circle' ? h.y : h.y + h.h / 2;
      const near = player.dir > 0 ? hx : hx + hw;
      const gap = (near - front) * player.dir;
      const low = hy > player.y && hy < feet + 24;
      if (gap > -8 && gap < tune.jumpGap && low) jump = true;
      if (CYCLIC.has(h.cause) && gap > -4 && gap < tune.stopGap) danger = true;
    }

    if (!jump && player.dir === towardExit) {
      for (const s of room.solids) {
        const up = feet - s.y;
        if (up < 6 || up > 66) continue;
        const gap = (player.dir > 0 ? s.x - front : (s.x + s.w) - front) * player.dir;
        if (gap > -10 && gap < tune.ledgeGap) jump = true;
      }
    }

    const ride = player.rideId ? room.solids.find((s) => s.id === player.rideId) : null;
    if (ride && (ride.dx || ride.dy)) {
      riding++;
      if (!jump && !blocked && riding < tune.rideFrames) {
        return { press: false, held: true, swipeDown: false, face: 0 };
      }
    } else {
      riding = 0;
    }

    if (danger && !jump) waiting = tune.waitFrames;
    if (waiting > 0) { waiting--; return { press: false, held: true, swipeDown: false, face: 0 }; }
    const act = jump || !ground || blocked || rng.chance(tune.noise);
    return { press: act, held: act, swipeDown: false, face: 0 };
  };
}

/** Dodge the slam, climb on the crown, repeat. */
export function bossPilot(tune) {
  return (_step, { room, player }) => {
    if (!player.grounded) return { press: false, held: player.vy < 0, swipeDown: false, face: 0 };
    const boss = room.boss;
    const front = player.dir > 0 ? player.x + player.w : player.x;
    const feet = player.y + player.h;

    for (const h of room.hazards) {
      if (h.kind !== 'box') continue;
      const near = player.dir > 0 ? h.x : h.x + h.w;
      const gap = (near - front) * player.dir;
      if (gap > -6 && gap < tune.jumpGap && h.y + h.h > player.y && h.y < feet + 24) {
        return { press: true, held: true, swipeDown: false, face: 0 };
      }
    }
    if (!boss || boss.defeated) {
      return { press: false, held: false, swipeDown: false, face: Math.sign(room.exitCenterX() - player.cx) || player.dir };
    }
    if (boss.vulnerable) {
      const want = Math.sign(boss.x + boss.w / 2 - player.cx) || player.dir;
      const near = want > 0 ? boss.x : boss.x + boss.w;
      const gap = (near - (want > 0 ? player.x + player.w : player.x)) * want;
      const go = gap > tune.lo && gap < tune.hi;
      return { press: go, held: go, swipeDown: false, face: want };
    }
    // Step out of the column it is about to drop into, using the nearer lane.
    const escLeft = boss.x - 26;
    const escRight = boss.x + boss.w + 4;
    const canLeft = escLeft > 18;
    const canRight = escRight < 322;
    const away = canLeft && (!canRight || player.x - escLeft < escRight - player.x) ? -1 : 1;
    return { press: false, held: false, swipeDown: false, face: away };
  };
}

/** Tries seeded variations until one finishes the floor. */
export function trySolve(n, { attempts = 300, seconds = 22, boss = false } = {}) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const rng = makeRng(1000 + attempt * 7 + n * 131);
    const controller = boss
      ? bossPilot({
        lo: 2 + rng.int(0, 18),
        hi: 22 + rng.int(0, 34),
        jumpGap: 8 + rng.int(0, 22),
      })
      : heuristicPilot(rng, {
        probe: 26 + rng.int(0, 16),
        jumpGap: 6 + rng.int(0, 22),
        stopGap: 24 + rng.int(0, 70),
        ledgeGap: 10 + rng.int(0, 40),
        waitFrames: 8 + rng.int(0, 90),
        startDelay: rng.int(0, 400),
        rideFrames: rng.int(0, 260),
        noise: rng.range(0, 0.02),
      });
    const r = run(buildFloor(n), seconds, controller);
    if (r.outcome === 'exit') return { attempt, seconds: r.step / 120 };
  }
  return null;
}
