import Matter from 'matter-js';
import { describe, it, expect } from 'vitest';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { buildTheTower, THE_TOWER } from '../src/game/TheTower';

describe('THE_TOWER data', () => {
  it('has a positive total structural value covering every piece', () => {
    const total = THE_TOWER.pieces.reduce((sum, p) => sum + p.structuralValue, 0);
    expect(total).toBeGreaterThan(0);
    expect(THE_TOWER.pieces.length).toBeGreaterThanOrEqual(20);
  });

  it('every constraint references pieces (or "world") that actually exist', () => {
    const ids = new Set(THE_TOWER.pieces.map((p) => p.id));
    for (const c of THE_TOWER.constraints) {
      expect(ids.has(c.bodyA)).toBe(true);
      expect(c.bodyB === 'world' || ids.has(c.bodyB)).toBe(true);
    }
  });
});

describe('buildTheTower', () => {
  it('instantiates one physics body per piece, plus ground and walls', () => {
    const physics = new PhysicsWorld();
    const built = buildTheTower(physics);
    expect(built.pieces.size).toBe(THE_TOWER.pieces.length);
    expect(built.totalStructuralValue).toBeGreaterThan(0);

    const bodies = Matter.Composite.allBodies(physics.world);
    // pieces + ground + 2 boundary walls
    expect(bodies.length).toBe(THE_TOWER.pieces.length + 3);
  });

  it('wires up every declared constraint', () => {
    const physics = new PhysicsWorld();
    buildTheTower(physics);
    const constraints = Matter.Composite.allConstraints(physics.world);
    expect(constraints.length).toBe(THE_TOWER.constraints.length);
  });

  it('rebuilds cleanly after PhysicsWorld.reset() (RETRY must not leak bodies)', () => {
    const physics = new PhysicsWorld();
    buildTheTower(physics);
    physics.reset();
    const built2 = buildTheTower(physics);

    const bodies = Matter.Composite.allBodies(physics.world);
    expect(bodies.length).toBe(THE_TOWER.pieces.length + 3);
    expect(built2.pieces.size).toBe(THE_TOWER.pieces.length);
  });
});

describe('THE TOWER — initial stability (section 34)', () => {
  it('stays standing with no player input for 10 simulated seconds', () => {
    const physics = new PhysicsWorld();
    const built = buildTheTower(physics);

    const columnsStartY = new Map(
      ['col_left', 'col_right'].map((id) => [id, built.pieces.get(id)!.body.position.y])
    );

    const stepMs = 1000 / 60;
    const steps = Math.ceil(10000 / stepMs);
    for (let i = 0; i < steps; i++) physics.step(stepMs);

    for (const [id, startY] of columnsStartY) {
      const body = built.pieces.get(id)!.body;
      expect(Number.isFinite(body.position.x)).toBe(true);
      expect(Number.isFinite(body.position.y)).toBe(true);
      // Columns may settle a few pixels but must not have toppled or fallen through the ground.
      expect(Math.abs(body.position.y - startY)).toBeLessThan(20);
      expect(Math.abs(body.angle)).toBeLessThan(0.15);
    }

    // Nothing should have broken — DamageSystem never even needs to run for a passive scene,
    // but as a sanity check every piece's local "broken" flag (untouched here) is still false.
    for (const piece of built.pieces.values()) expect(piece.broken).toBe(false);
  });
});
