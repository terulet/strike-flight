import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { buildTheTower } from '../src/game/TheTower';
import { DamageSystem } from '../src/systems/DamageSystem';

describe('THE TOWER — full stability with DamageSystem live (section 34/35)', () => {
  it('no piece breaks and destruction stays ~0% after 10s of idle simulation', () => {
    const physics = new PhysicsWorld();
    const built = buildTheTower(physics);
    const bus = new EventBus<GameEvents>();
    const damage = new DamageSystem(physics, built.pieces, new Map(), bus);
    damage.graceActive = true; // matches Game's real startup sequence

    const stepMs = 1000 / 60;
    let simMs = 0;
    let brokeDuringGrace = false;
    while (simMs < 10000) {
      physics.step(stepMs);
      simMs += stepMs;
      if (simMs > 1500) damage.graceActive = false;
      if (damage.getDestructionPercent() > 0 && simMs < 1500) brokeDuringGrace = true;
    }

    expect(brokeDuringGrace).toBe(false);
    expect(damage.getDestructionPercent()).toBe(0);
    for (const piece of built.pieces.values()) expect(piece.broken).toBe(false);
  });
});

describe('no piece bodies overlap at spawn (would cause a violent separation pop)', () => {
  it('every pair of piece bodies, and every piece vs the ground, starts non-overlapping', async () => {
    const Matter = (await import('matter-js')).default;
    const physics = new PhysicsWorld();
    const built = buildTheTower(physics);
    const pieces = Array.from(built.pieces.values());

    const overlaps: string[] = [];
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const collision = Matter.Collision.collides(pieces[i].body, pieces[j].body);
        if (collision?.collided) overlaps.push(`${pieces[i].id} <-> ${pieces[j].id}`);
      }
      const groundCollision = Matter.Collision.collides(pieces[i].body, built.groundBody);
      if (groundCollision?.collided) overlaps.push(`${pieces[i].id} <-> ground`);
    }

    expect(overlaps).toEqual([]);
  });
});
