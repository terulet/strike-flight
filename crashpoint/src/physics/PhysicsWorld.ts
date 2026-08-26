import Matter from 'matter-js';
import type { Vec2 } from '../core/types';

export interface PhysicsCollisionInfo {
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  impactSpeed: number; // relative speed along collision normal, m/s-ish (Matter units)
  point: Vec2;
}

export type CollisionHandler = (info: PhysicsCollisionInfo) => void;

/**
 * Thin wrapper around Matter.js. Owns engine/world lifecycle and translates raw collision
 * pairs into a simplified impact-speed signal DamageSystem can consume without touching Matter types.
 */
export class PhysicsWorld {
  engine!: Matter.Engine;
  private collisionHandlers: CollisionHandler[] = [];
  /** Bodies removed during the current step, deferred until after Engine.update finishes. */
  private pendingRemovals = new Set<Matter.Body>();

  constructor(private gravityY = 1.0) {
    this.rebuild();
  }

  private rebuild(): void {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: this.gravityY, scale: 0.001 },
      enableSleeping: true,
      positionIterations: 8,
      velocityIterations: 6,
    });
    Matter.Events.on(this.engine, 'collisionStart', (evt) => this.handleCollisionStart(evt));
  }

  /** Full teardown + fresh engine. Used by RETRY so no stale bodies/listeners survive between runs. */
  reset(): void {
    Matter.World.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.pendingRemovals.clear();
    this.rebuild();
  }

  get world(): Matter.World {
    return this.engine.world;
  }

  addBody(body: Matter.Body): void {
    Matter.World.add(this.engine.world, body);
  }

  addConstraint(constraint: Matter.Constraint): void {
    Matter.World.add(this.engine.world, constraint);
  }

  removeBody(body: Matter.Body): void {
    this.pendingRemovals.add(body);
  }

  removeConstraint(constraint: Matter.Constraint): void {
    Matter.World.remove(this.engine.world, constraint);
  }

  onCollisionStart(handler: CollisionHandler): void {
    this.collisionHandlers.push(handler);
  }

  step(dtMs: number): void {
    Matter.Engine.update(this.engine, dtMs);
    if (this.pendingRemovals.size > 0) {
      for (const body of this.pendingRemovals) {
        Matter.World.remove(this.engine.world, body);
      }
      this.pendingRemovals.clear();
    }
  }

  private handleCollisionStart(evt: Matter.IEventCollision<Matter.Engine>): void {
    for (const pair of evt.pairs) {
      const relVel = Matter.Vector.sub(pair.bodyA.velocity, pair.bodyB.velocity);
      const impactSpeed = Matter.Vector.magnitude(relVel);
      const point = pair.collision.supports[0] ?? pair.bodyA.position;
      const info: PhysicsCollisionInfo = {
        bodyA: pair.bodyA,
        bodyB: pair.bodyB,
        impactSpeed,
        point: { x: point.x, y: point.y },
      };
      for (const handler of this.collisionHandlers) handler(info);
    }
  }
}
