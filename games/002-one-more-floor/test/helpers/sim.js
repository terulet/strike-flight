/**
 * Headless simulation helpers. No DOM, no canvas: the gameplay modules are
 * deliberately free of rendering concerns so they can be stepped in Node.
 */
import { FIXED_DT } from '../../src/core/loop.js';
import { Player } from '../../src/game/player.js';
import { FloorManager } from '../../src/floors/floorManager.js';
import '../../src/floors/hazards/index.js';

export const NO_INPUT = { press: false, held: false, swipeDown: false };

export function makeCtx(overrides = {}) {
  return {
    time: 0,
    sfx: () => {},
    onCrusherSlam: () => {},
    onCrumbleBreak: () => {},
    onWalkerStomp: () => {},
    onBossHit: () => {},
    onBossSlam: () => {},
    onBossDefeated: () => {},
    ...overrides,
  };
}

export function buildFloor(n) {
  const fm = new FloorManager();
  const room = fm.build(n);
  const player = new Player();
  player.reset(room.spawn.x, room.spawn.y, room.spawn.dir);
  const ctx = makeCtx({ player });
  return { room, player, ctx, fm };
}

/**
 * Steps a floor forward.
 * @param {(step:number, s:object)=>object} controller returns an input command
 */
export function run(state, seconds, controller = () => NO_INPUT) {
  const steps = Math.round(seconds / FIXED_DT);
  const { room, player, ctx } = state;
  for (let i = 0; i < steps; i++) {
    const cmd = controller(i, state) || NO_INPUT;
    ctx.time += FIXED_DT;
    room.update(FIXED_DT, ctx);
    player.update(FIXED_DT, cmd, room.solids);
    room.touchCrumbles(player, false);
    room.checkStomps(player, ctx);
    room.checkBossStomp(player, ctx);
    if (player.y > room.bottomY + 50) return { outcome: 'fall', step: i };
    const cause = room.checkHazards(player);
    if (cause) return { outcome: 'hazard', cause, step: i };
    if (room.checkExit(player)) return { outcome: 'exit', step: i };
  }
  return { outcome: 'timeout', step: steps };
}

/** Measures the jump arc actually produced by the physics. */
export function measureJump({ hold = true } = {}) {
  const player = new Player();
  const ground = [{ x: -1000, y: 400, w: 3000, h: 20, id: 'g' }];
  player.reset(100, 370, 1);
  player.spawnSafe = 0;
  // Settle on the ground and reach run speed.
  for (let i = 0; i < 120; i++) player.update(FIXED_DT, NO_INPUT, ground);
  const x0 = player.x;
  const y0 = player.y;
  let peak = y0;
  player.update(FIXED_DT, { press: true, held: true, swipeDown: false }, ground);
  for (let i = 0; i < 400; i++) {
    const held = hold ? true : false;
    player.update(FIXED_DT, { press: false, held, swipeDown: false }, ground);
    peak = Math.min(peak, player.y);
    if (player.grounded && i > 4) break;
  }
  return { height: y0 - peak, distance: Math.abs(player.x - x0) };
}
