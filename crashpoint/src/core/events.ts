import type { CausalityEdge, DestructionEventKind, Medal, MaterialId, ProjectileId, Vec2 } from './types';

/** Central event map for the game's EventBus. One place to see every signal in the system. */
export interface GameEvents {
  game_start: { atMs: number };
  shot_aim_start: { projectile: ProjectileId };
  shot_fired: { projectile: ProjectileId; shotIndex: number; origin: Vec2; velocity: Vec2 };
  projectile_spawned: { entityId: string; projectile: ProjectileId };
  impact: { entityId: string; pieceId: string; impulse: number; point: Vec2; causeId: string };
  structural_break: { pieceId: string; material: MaterialId; causeId: string; point: Vec2 };
  piece_collapsed: { pieceId: string; causeId: string };
  explosion: { pieceId: string; causeId: string; point: Vec2; radius: number };
  cable_cut: { pieceId: string; causeId: string };
  chain_start: { rootCauseId: string };
  chain_event: { edge: CausalityEdge; chainLength: number };
  chain_end: { chainLength: number; durationMs: number };
  destruction_progress: { percent: number };
  destruction_event: { kind: DestructionEventKind; point: Vec2; magnitude: number };
  slow_motion_trigger: { reason: string; strength: number; durationMs: number };
  camera_focus: { point: Vec2; zoom?: number; reason: string };
  shots_changed: { remaining: number };
  score_changed: { score: number };
  perfect_collapse: { destructionPct: number };
  stability_check_passed: {};
  game_finish: {
    destructionPct: number;
    score: number;
    shotsUsed: number;
    bestChain: number;
    medal: Medal;
    perfectCollapse: boolean;
    timeMs: number;
  };
  retry: { atMs: number };
}

export type GameEventName = keyof GameEvents;
