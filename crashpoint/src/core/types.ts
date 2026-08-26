/** Shared vocabulary used across physics, damage, chain, score and UI. Kept small on purpose. */

export type MaterialId = 'wood' | 'metal' | 'concrete' | 'glass' | 'cable' | 'explosive';

export type ProjectileId = 'impact_core' | 'drill_spike' | 'pulse_orb';

export type PieceRole = 'primary' | 'secondary' | 'prop' | 'reactive';

export type DestructionEventKind = 'hit' | 'break' | 'collapse' | 'explosion' | 'chain' | 'mega_collapse';

export interface Vec2 {
  x: number;
  y: number;
}

/** A single causality edge: `cause` produced `effect`. Used for chain detection & telemetry. */
export interface CausalityEdge {
  causeId: string;
  effectId: string;
  kind: DestructionEventKind;
  atMs: number;
}

export type Medal = 'none' | 'bronze' | 'silver' | 'gold' | 'crashpoint';

export interface ShotResult {
  projectile: ProjectileId;
  origin: Vec2;
  velocity: Vec2;
}

export interface RunRecord {
  bestDestructionPct: number;
  bestScore: number;
  bestChain: number;
  fewestShotsForClear: number | null;
  perfectCollapse: boolean;
  timesPlayed: number;
}
