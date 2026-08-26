import type Matter from 'matter-js';
import type { MaterialId, PieceRole } from '../core/types';
import type { GameEntity, VisualSprite } from './GameEntity';

/**
 * One destructible/structural element of a level. Constraints attached to this piece
 * are tracked so a "break" can cut exactly its supports without a global structural solver.
 */
export class StructuralPiece implements GameEntity {
  id: string;
  body: Matter.Body;
  visual: VisualSprite;
  material: MaterialId;
  role: PieceRole;
  /** Relative weight of this piece toward the level's total destructible value (section 18). */
  structuralValue: number;
  toughness: number;
  integrity: number; // 0..1, starts at 1
  broken = false;
  /** Constraints that reference this body on either end; cut when the piece breaks. */
  constraints: Matter.Constraint[] = [];
  /** True for explosive props: breaking triggers ExplosionSystem instead of just falling apart. */
  isExplosive: boolean;
  /** True for cable/chain pieces holding a counterweight or suspended load. */
  isCable: boolean;
  lastDamageCauseId: string | null = null;

  constructor(opts: {
    id: string;
    body: Matter.Body;
    visual: VisualSprite;
    material: MaterialId;
    role: PieceRole;
    structuralValue: number;
    toughness: number;
    isExplosive?: boolean;
    isCable?: boolean;
  }) {
    this.id = opts.id;
    this.body = opts.body;
    this.visual = opts.visual;
    this.material = opts.material;
    this.role = opts.role;
    this.structuralValue = opts.structuralValue;
    this.toughness = opts.toughness;
    this.integrity = 1;
    this.isExplosive = opts.isExplosive ?? false;
    this.isCable = opts.isCable ?? false;
  }
}
