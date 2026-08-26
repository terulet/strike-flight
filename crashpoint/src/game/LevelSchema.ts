import type { MaterialId, PieceRole } from '../core/types';
import type { ShapeDescriptor } from '../entities/GameEntity';

export interface PieceSpec {
  id: string;
  role: PieceRole;
  material: MaterialId;
  x: number;
  y: number;
  angle?: number;
  shape: ShapeDescriptor;
  /** Structural value weight (contributes to destruction % pool). Static ground/decor omit this. */
  structuralValue: number;
  isExplosive?: boolean;
  isCable?: boolean;
  assetId: string;
  /** If true, body starts asleep-friendly / high friction (used for base pieces resting on ground). */
  restsOnGround?: boolean;
}

/** A rigid or rope-like joint between two pieces (or a piece and the static world). */
export interface ConstraintSpec {
  id: string;
  bodyA: string; // piece id, or 'world' for a fixed point
  bodyB: string;
  pointA?: { x: number; y: number }; // local offset from bodyA center
  pointB?: { x: number; y: number }; // local offset from bodyB center, or world point if bodyB==='world'
  stiffness: number;
  length?: number; // omit to use rest distance at build time
  /** Damps out oscillation (0 = none, ~0.1 = heavy). Defaults to a small value — see buildTheTower. */
  damping?: number;
  /** Which piece "owns" this joint for damage purposes — breaking that piece cuts this constraint. */
  ownedBy: 'bodyA' | 'bodyB' | 'both';
}

/** Purely visual, non-physical background/decoration (section 6: "no todo tiene que ser destructible"). */
export interface DecorSpec {
  id: string;
  x: number;
  y: number;
  shape: ShapeDescriptor;
  assetId: string;
  color: string;
  strokeColor: string;
  /** 'far'/'near' draw behind all structural pieces; 'accent' draws after them (weak-point markers,
   * gussets) so they read as details layered onto the structure rather than being hidden by it. */
  layer: 'far' | 'near' | 'accent';
  rotationDeg?: number;
  flipX?: boolean;
}

export interface TowerLevelData {
  name: string;
  worldWidth: number;
  worldHeight: number;
  groundY: number;
  launcherOrigin: { x: number; y: number };
  pieces: PieceSpec[];
  constraints: ConstraintSpec[];
  decor: DecorSpec[];
}
