import Matter from 'matter-js';
import { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { StructuralPiece } from '../entities/StructuralPiece';
import type { DamageSystem } from './DamageSystem';

/** Applies radial impulse + damage falloff for explosive pieces and Pulse Orb detonations. */
export class ExplosionSystem {
  constructor(
    private pieces: Map<string, StructuralPiece>,
    private damage: DamageSystem,
    bus: EventBus<GameEvents>
  ) {
    bus.on('explosion', (e) => this.detonate(e.point, e.radius, e.causeId, e.pieceId));
  }

  detonate(point: { x: number; y: number }, radius: number, causeId: string, sourcePieceId: string): void {
    for (const piece of this.pieces.values()) {
      if (piece.broken || piece.id === sourcePieceId) continue;
      const dx = piece.body.position.x - point.x;
      const dy = piece.body.position.y - point.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) continue;

      const falloff = 1 - dist / radius;
      const impulseMag = falloff * 0.045 * piece.body.mass;
      const dir = dist > 0.001 ? { x: dx / dist, y: dy / dist } : { x: 0, y: -1 };
      Matter.Body.applyForce(piece.body, piece.body.position, {
        x: dir.x * impulseMag,
        y: dir.y * impulseMag - impulseMag * 0.35, // slight upward kick — reads as an explosion, not a shove
      });

      const damageAmount = falloff * 22;
      this.damage.applyDamage(piece.id, damageAmount, causeId, point);
    }
  }
}
