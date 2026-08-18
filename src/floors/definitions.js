/**
 * The 20 authored floors.
 *
 * Everything here is plain data — no logic, no imports beyond geometry
 * constants — so floors can be tested, mirrored, retimed and (later) authored
 * by a tool without touching the engine.
 *
 * Coordinate cheatsheet (room is 360 x 420, y grows down):
 *   floor surface      y = 402      playable x = 14 .. 346
 *   standing player    y = 372 (22 x 30)
 *   full jump          73px up, ~77px across
 *   shortest tap jump  36px up, ~54px across   <- every mandatory gap fits this
 */
import { ROOM } from '../config.js';

export const FLOOR_Y = ROOM.H - ROOM.SLAB; // 402
const onFloor = (h) => FLOOR_Y - h;

export const FLOORS = [
  // 1 ────────────────────────────────────────────── teach TAP (cannot die)
  {
    id: 'f01',
    name: 'FIRST STEPS',
    hint: { text: 'TAP TO JUMP', icon: 'tap' },
    entities: [
      { type: 'block', x: 150, y: onFloor(26), w: 44, h: 26 },
    ],
  },

  // 2 ────────────────────────────────────────────── saw + teach waiting
  {
    id: 'f02',
    name: 'BLADE',
    hint: { text: 'HOLD TO STOP', icon: 'hold' },
    entities: [
      { type: 'saw', x: 120, y: 376, r: 17, path: { type: 'line', to: { x: 248, y: 376 }, time: 2.6, ease: 'sine' } },
    ],
  },

  // 3 ────────────────────────────────────────────── crumbling floor
  {
    id: 'f03',
    name: 'FALLING FLOOR',
    hint: { text: 'KEEP MOVING', icon: 'run' },
    pits: [{ x: 96, w: 190 }],
    entities: [
      { type: 'crumble', x: 100, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 152, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 204, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 256, y: FLOOR_Y, w: 44, h: 14 },
    ],
  },

  // 4 ────────────────────────────────────────────── laser gates
  {
    id: 'f04',
    name: 'LASER GATE',
    hint: { text: 'WAIT FOR THE GAP', icon: 'hold' },
    entities: [
      { type: 'laser', orient: 'v', x: 152, y: 120, len: 282, thickness: 8, onTime: 0.85, offTime: 1.25, charge: 0.45, t0: 0 },
      { type: 'laser', orient: 'v', x: 244, y: 120, len: 282, thickness: 8, onTime: 0.85, offTime: 1.25, charge: 0.45, t0: 1.3 },
    ],
  },

  // 5 ────────────────────────────────────────────── two moving platforms
  {
    id: 'f05',
    name: 'LIFTS',
    hint: { text: 'HOLD TO RIDE', icon: 'hold' },
    pits: [{ x: 78, w: 206 }],
    entities: [
      // Lowest position is inside the *shortest* jump's reach: floor 5 is still
      // a teaching floor, so a nervous quick tap must not be a death sentence.
      { type: 'platform', x: 100, y: 366, w: 56, h: 12, path: { type: 'line', to: { x: 100, y: 312 }, time: 3.0, ease: 'sine' } },
      { type: 'platform', x: 196, y: 312, w: 56, h: 12, path: { type: 'line', to: { x: 196, y: 366 }, time: 3.0, ease: 'sine' } },
    ],
  },

  // 6 ────────────────────────────────────────────── the doors rule
  {
    id: 'f06',
    name: 'TWO DOORS',
    hint: { text: 'GREEN LAMP = SAFE', icon: 'eye' },
    entities: [
      { type: 'block', x: 228, y: 340, w: 104, h: 12 },
      {
        type: 'doors',
        w: 34,
        h: 44,
        slots: [
          { x: 254, y: 296 },  // upper door, standing on the ledge
          { x: 254, y: 358 },  // lower door, straight ahead
        ],
      },
    ],
  },

  // 7 ────────────────────────────────────────────── spikes rhythm
  {
    id: 'f07',
    name: 'SPIKES',
    hint: { text: 'SPIKES', icon: 'danger' },
    // Three clean jumps, nothing to bounce off. The earlier version put a
    // 30px step right after a spike patch: land short and you were pinned
    // against its face with no room for a run-up, which is the definition of
    // an unfair floor.
    entities: [
      { type: 'spikes', x: 104, y: 390, w: 36, h: 12, dir: 'up' },
      { type: 'spikes', x: 186, y: 390, w: 36, h: 12, dir: 'up' },
      { type: 'spikes', x: 254, y: 390, w: 36, h: 12, dir: 'up' },
    ],
  },

  // 8 ────────────────────────────────────────────── crushers
  {
    id: 'f08',
    name: 'CRUSHER',
    hint: { text: 'READ THE RHYTHM', icon: 'eye' },
    entities: [
      { type: 'crusher', x: 108, y: 200, w: 64, h: 40, travel: 162, idleTime: 1.0, t0: 0 },
      { type: 'crusher', x: 222, y: 200, w: 64, h: 40, travel: 162, idleTime: 1.0, t0: 1.45 },
    ],
  },

  // 9 ────────────────────────────────────────────── first real sequence
  {
    id: 'f09',
    name: 'RUSH',
    pits: [{ x: 140, w: 100 }],
    entities: [
      { type: 'saw', x: 84, y: 376, r: 16, path: { type: 'line', to: { x: 138, y: 376 }, time: 1.5, ease: 'sine' } },
      { type: 'crumble', x: 144, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 194, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'laser', orient: 'v', x: 268, y: 130, len: 272, thickness: 8, onTime: 0.7, offTime: 0.95, charge: 0.36 },
    ],
  },

  // 10 ───────────────────────────────────────────── MINI BOSS
  {
    id: 'f10',
    name: 'THE WARDEN',
    hint: { text: 'LAND ON ITS CORE', icon: 'boss' },
    boss: true,
    entities: [
      { type: 'block', x: 14, y: 328, w: 62, h: 12 },
      { type: 'block', x: 284, y: 328, w: 62, h: 12 },
      { type: 'boss', x: 134, hp: 3, hoverY: 96 },
    ],
  },

  // 11 ───────────────────────────────────────────── saw over crumbling floor
  {
    id: 'f11',
    name: 'BLADE RUN',
    pits: [{ x: 100, w: 152 }],
    entities: [
      { type: 'crumble', x: 104, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 156, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 208, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'saw', x: 178, y: 330, r: 16, path: { type: 'orbit', cx: 178, cy: 336, r: 54, time: 2.8 } },
    ],
  },

  // 12 ───────────────────────────────────────────── shuttle under a beam
  {
    id: 'f12',
    name: 'GRID',
    pits: [{ x: 90, w: 180 }],
    entities: [
      { type: 'platform', x: 108, y: 350, w: 70, h: 12, path: { type: 'line', to: { x: 200, y: 350 }, time: 3.2, ease: 'sine' } },
      { type: 'laser', orient: 'h', x: 90, y: 300, len: 180, thickness: 8, onTime: 0.9, offTime: 1.0, charge: 0.4 },
      { type: 'laser', orient: 'v', x: 284, y: 140, len: 262, thickness: 8, onTime: 0.7, offTime: 1.1, charge: 0.4, t0: 0.9 },
    ],
  },

  // 13 ───────────────────────────────────────────── flame vents
  {
    id: 'f13',
    name: 'HEAT',
    hint: { text: 'VENTS', icon: 'danger' },
    entities: [
      { type: 'fire', x: 116, y: FLOOR_Y, w: 26, len: 112, dir: 'up', idleTime: 1.0, warn: 0.42, burn: 0.7, t0: 0 },
      { type: 'fire', x: 196, y: FLOOR_Y, w: 26, len: 112, dir: 'up', idleTime: 1.0, warn: 0.42, burn: 0.7, t0: 1.15 },
      { type: 'spikes', x: 248, y: 390, w: 36, h: 12, dir: 'up' },
    ],
  },

  // 14 ───────────────────────────────────────────── doors under pressure
  {
    id: 'f14',
    name: 'PRESSURE',
    entities: [
      { type: 'crusher', x: 142, y: 210, w: 60, h: 40, travel: 152, idleTime: 0.85, t0: 0 },
      { type: 'block', x: 232, y: 336, w: 104, h: 12 },
      {
        type: 'doors',
        w: 34,
        h: 44,
        slots: [
          { x: 258, y: 292 },
          { x: 258, y: 358 },
        ],
      },
    ],
  },

  // 15 ───────────────────────────────────────────── patrol drones
  {
    id: 'f15',
    name: 'PATROL',
    hint: { text: 'LAND ON THEM', icon: 'boss' },
    entities: [
      { type: 'block', x: 112, y: 348, w: 104, h: 12 },
      { type: 'walker', x: 240, y: 380, w: 24, h: 22, left: 200, right: 300, speed: 58 },
      { type: 'walker', x: 130, y: 326, w: 24, h: 22, left: 112, right: 216, speed: 46 },
    ],
  },

  // 16 ───────────────────────────────────────────── lifts under a beam
  {
    id: 'f16',
    name: 'SKY LIFTS',
    pits: [{ x: 70, w: 220 }],
    entities: [
      { type: 'platform', x: 84, y: 352, w: 54, h: 12, path: { type: 'line', to: { x: 84, y: 302 }, time: 2.6, ease: 'sine' } },
      { type: 'platform', x: 168, y: 302, w: 54, h: 12, path: { type: 'line', to: { x: 168, y: 352 }, time: 2.6, ease: 'sine' } },
      { type: 'block', x: 240, y: 344, w: 48, h: 12 },
      { type: 'laser', orient: 'h', x: 70, y: 262, len: 222, thickness: 8, onTime: 1.0, offTime: 0.9, charge: 0.4 },
    ],
  },

  // 17 ───────────────────────────────────────────── crushers over a chasm
  {
    id: 'f17',
    name: 'GAUNTLET',
    pits: [{ x: 118, w: 156 }],
    entities: [
      { type: 'crumble', x: 122, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 174, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crumble', x: 226, y: FLOOR_Y, w: 44, h: 14 },
      { type: 'crusher', x: 138, y: 196, w: 56, h: 40, travel: 166, idleTime: 0.95, t0: 0.4 },
      { type: 'crusher', x: 222, y: 196, w: 56, h: 40, travel: 166, idleTime: 0.95, t0: 1.7 },
    ],
  },

  // 18 ───────────────────────────────────────────── fire from above + blade
  {
    id: 'f18',
    name: 'INFERNO',
    pits: [{ x: 96, w: 168 }],
    entities: [
      { type: 'platform', x: 106, y: 352, w: 64, h: 12, path: { type: 'line', to: { x: 196, y: 352 }, time: 3.4, ease: 'sine' } },
      { type: 'fire', x: 148, y: 292, w: 26, len: 92, dir: 'down', idleTime: 1.1, warn: 0.4, burn: 0.7, t0: 0 },
      { type: 'fire', x: 214, y: 292, w: 26, len: 92, dir: 'down', idleTime: 1.1, warn: 0.4, burn: 0.7, t0: 1.2 },
      { type: 'saw', x: 268, y: 376, r: 16, path: { type: 'line', to: { x: 312, y: 376 }, time: 1.7, ease: 'sine' } },
    ],
  },

  // 19 ───────────────────────────────────────────── everything, quickly
  {
    id: 'f19',
    name: 'FINAL RUSH',
    pits: [{ x: 236, w: 56 }],
    entities: [
      { type: 'saw', x: 84, y: 376, r: 16, path: { type: 'line', to: { x: 136, y: 376 }, time: 1.3, ease: 'sine' } },
      { type: 'walker', x: 150, y: 380, w: 24, h: 22, left: 132, right: 204, speed: 62 },
      { type: 'laser', orient: 'v', x: 214, y: 128, len: 274, thickness: 8, onTime: 0.6, offTime: 0.85, charge: 0.32 },
      { type: 'crumble', x: 240, y: FLOOR_Y, w: 48, h: 14 },
    ],
  },

  // 20 ───────────────────────────────────────────── MINI BOSS MK II
  {
    id: 'f20',
    name: 'WARDEN MK II',
    boss: true,
    entities: [
      { type: 'block', x: 14, y: 326, w: 58, h: 12 },
      { type: 'block', x: 288, y: 326, w: 58, h: 12 },
      { type: 'spikes', x: 96, y: 390, w: 36, h: 12, dir: 'up' },
      { type: 'spikes', x: 224, y: 390, w: 36, h: 12, dir: 'up' },
      { type: 'boss', x: 134, hp: 4, hard: true, hoverY: 92 },
    ],
  },
];

export const FLOOR_BY_ID = Object.fromEntries(FLOORS.map((f) => [f.id, f]));
export const AUTHORED_COUNT = FLOORS.length;
