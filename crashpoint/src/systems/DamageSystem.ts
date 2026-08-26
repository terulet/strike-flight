import type Matter from 'matter-js';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { PhysicsWorld, PhysicsCollisionInfo } from '../physics/PhysicsWorld';
import { getMaterial } from '../physics/materials';
import type { StructuralPiece } from '../entities/StructuralPiece';
import type { Projectile } from '../entities/Projectile';

const MIN_IMPACT_SPEED = 2.4; // below this, treat as a resting/settling contact — never damages (section 34)
const GLASS_BREAK_SPEED = 2.2;

/**
 * Converts raw physics collisions into structural damage. Materials absorb damage differently
 * (toughness/fragility from physics/materials.ts); breaking a piece cuts exactly the joints it owns,
 * letting the rest of the structure fall under normal physics rather than a scripted animation.
 */
export class DamageSystem {
  private bodyToPieceId = new Map<number, string>();
  private bodyToProjectileId = new Map<number, string>();
  /** While true, all damage is suppressed — covers the brief settle after a level (re)builds
   *  so any residual constraint/contact jitter can never be mistaken for player-caused damage. */
  graceActive = false;

  constructor(
    private physics: PhysicsWorld,
    private pieces: Map<string, StructuralPiece>,
    private projectiles: Map<string, Projectile>,
    private bus: EventBus<GameEvents>
  ) {
    for (const piece of pieces.values()) this.bodyToPieceId.set(piece.body.id, piece.id);
    physics.onCollisionStart((info) => this.handleCollision(info));
  }

  registerProjectile(projectile: Projectile): void {
    this.projectiles.set(projectile.id, projectile);
    this.bodyToProjectileId.set(projectile.body.id, projectile.id);
  }

  unregisterProjectileBody(bodyId: number): void {
    this.bodyToProjectileId.delete(bodyId);
  }

  private handleCollision(info: PhysicsCollisionInfo): void {
    if (info.impactSpeed < MIN_IMPACT_SPEED) return;

    const pieceIdA = this.bodyToPieceId.get(info.bodyA.id);
    const pieceIdB = this.bodyToPieceId.get(info.bodyB.id);
    const projIdA = this.bodyToProjectileId.get(info.bodyA.id);
    const projIdB = this.bodyToProjectileId.get(info.bodyB.id);

    // Projectile -> piece.
    if (projIdA && pieceIdB) this.applyImpact(pieceIdB, info.impactSpeed, projIdA, info.point);
    else if (projIdB && pieceIdA) this.applyImpact(pieceIdA, info.impactSpeed, projIdB, info.point);
    // Piece -> piece (falling debris smashing into another piece continues the chain).
    else if (pieceIdA && pieceIdB) {
      this.applyImpact(pieceIdB, info.impactSpeed, pieceIdA, info.point);
      this.applyImpact(pieceIdA, info.impactSpeed, pieceIdB, info.point);
    }
  }

  /** Applies impact damage to a piece. `causeId` is whatever hit it (projectile id or another piece id). */
  applyImpact(pieceId: string, impactSpeed: number, causeId: string, point: { x: number; y: number }): void {
    if (this.graceActive || impactSpeed < MIN_IMPACT_SPEED) return;
    const piece = this.pieces.get(pieceId);
    if (!piece || piece.broken) return;

    const mat = getMaterial(piece.material);
    this.bus.emit('impact', { entityId: pieceId, pieceId, impulse: impactSpeed, point, causeId });
    this.bus.emit('destruction_event', { kind: 'hit', point, magnitude: impactSpeed });

    if (mat.breaksInstantly && impactSpeed >= GLASS_BREAK_SPEED) {
      this.breakPiece(piece, causeId, point);
      return;
    }

    const damage = impactSpeed * mat.fragility * 3.2;
    piece.integrity = Math.max(0, piece.integrity - damage / piece.toughness);
    piece.lastDamageCauseId = causeId;

    if (piece.integrity <= 0) this.breakPiece(piece, causeId, point);
  }

  /** Direct damage application (used by ExplosionSystem for nearby pieces caught in a blast). */
  applyDamage(pieceId: string, amount: number, causeId: string, point: { x: number; y: number }): void {
    if (this.graceActive) return;
    const piece = this.pieces.get(pieceId);
    if (!piece || piece.broken) return;
    piece.integrity = Math.max(0, piece.integrity - amount / piece.toughness);
    piece.lastDamageCauseId = causeId;
    if (piece.integrity <= 0) this.breakPiece(piece, causeId, point);
  }

  private breakPiece(piece: StructuralPiece, causeId: string, point: { x: number; y: number }): void {
    piece.broken = true;
    piece.integrity = 0;

    for (const constraint of piece.constraints) this.physics.removeConstraint(constraint);
    piece.constraints = [];

    this.bus.emit('structural_break', { pieceId: piece.id, material: piece.material, causeId, point });
    this.bus.emit('destruction_event', { kind: 'break', point, magnitude: 1 });

    if (piece.isCable) this.bus.emit('cable_cut', { pieceId: piece.id, causeId });

    if (piece.isExplosive) {
      this.bus.emit('explosion', { pieceId: piece.id, causeId: piece.id, point, radius: 170 });
      this.bus.emit('destruction_event', { kind: 'explosion', point, magnitude: 2 });
    }

    this.recomputeDestruction();
  }

  private recomputeDestruction(): void {
    let broken = 0;
    let total = 0;
    for (const piece of this.pieces.values()) {
      total += piece.structuralValue;
      if (piece.broken) broken += piece.structuralValue;
    }
    const percent = total > 0 ? (broken / total) * 100 : 0;
    this.bus.emit('destruction_progress', { percent });
  }

  getDestructionPercent(): number {
    let broken = 0;
    let total = 0;
    for (const piece of this.pieces.values()) {
      total += piece.structuralValue;
      if (piece.broken) broken += piece.structuralValue;
    }
    return total > 0 ? (broken / total) * 100 : 0;
  }

  /** Rebinds body lookups after a level rebuild (RETRY). */
  reindex(pieces: Map<string, StructuralPiece>): void {
    this.pieces = pieces;
    this.bodyToPieceId.clear();
    for (const piece of pieces.values()) this.bodyToPieceId.set(piece.body.id, piece.id);
    this.bodyToProjectileId.clear();
  }
}
