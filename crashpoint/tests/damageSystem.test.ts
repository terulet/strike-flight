import Matter from 'matter-js';
import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/events';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { StructuralPiece } from '../src/entities/StructuralPiece';
import { getMaterial } from '../src/physics/materials';
import { DamageSystem } from '../src/systems/DamageSystem';

function makePiece(id: string, material: Parameters<typeof getMaterial>[0], opts: { isExplosive?: boolean; isCable?: boolean } = {}) {
  const body = Matter.Bodies.rectangle(0, 0, 40, 40);
  const mat = getMaterial(material);
  return new StructuralPiece({
    id,
    body,
    visual: { assetId: 'placeholder', shape: { kind: 'rectangle', width: 40, height: 40 } },
    material,
    role: 'secondary',
    structuralValue: 10,
    toughness: mat.toughness,
    isExplosive: opts.isExplosive,
    isCable: opts.isCable,
  });
}

function setup(pieces: StructuralPiece[]) {
  const physics = new PhysicsWorld();
  const bus = new EventBus<GameEvents>();
  const map = new Map(pieces.map((p) => [p.id, p]));
  const damage = new DamageSystem(physics, map, new Map(), bus);
  return { physics, bus, map, damage };
}

describe('DamageSystem', () => {
  it('ignores contacts below the minimum impact speed (no damage from resting/settling)', () => {
    const piece = makePiece('wood_1', 'wood');
    const { damage, map } = setup([piece]);
    damage.applyImpact('wood_1', 0.5, 'proj_0', { x: 0, y: 0 });
    expect(map.get('wood_1')!.integrity).toBe(1);
  });

  it('accumulates damage across hits and breaks once integrity is depleted', () => {
    const piece = makePiece('wood_1', 'wood');
    const { damage, bus, map } = setup([piece]);

    let broke = false;
    bus.on('structural_break', () => (broke = true));

    for (let i = 0; i < 20 && !broke; i++) {
      damage.applyImpact('wood_1', 6, 'proj_0', { x: 0, y: 0 });
    }

    expect(broke).toBe(true);
    expect(map.get('wood_1')!.broken).toBe(true);
    expect(map.get('wood_1')!.integrity).toBe(0);
  });

  it('breaks glass instantly on a single qualifying hit regardless of toughness', () => {
    const piece = makePiece('glass_1', 'glass');
    const { damage, bus, map } = setup([piece]);
    let broke = false;
    bus.on('structural_break', () => (broke = true));

    damage.applyImpact('glass_1', 5, 'proj_0', { x: 0, y: 0 });

    expect(broke).toBe(true);
    expect(map.get('glass_1')!.broken).toBe(true);
  });

  it('never damages an already-broken piece twice', () => {
    const piece = makePiece('glass_1', 'glass');
    const { damage, bus } = setup([piece]);
    let breakCount = 0;
    bus.on('structural_break', () => breakCount++);

    damage.applyImpact('glass_1', 5, 'proj_0', { x: 0, y: 0 });
    damage.applyImpact('glass_1', 5, 'proj_1', { x: 0, y: 0 });

    expect(breakCount).toBe(1);
  });

  it('emits an explosion event when an explosive piece breaks', () => {
    const piece = makePiece('tank_1', 'explosive', { isExplosive: true });
    const { damage, bus } = setup([piece]);
    let exploded = false;
    bus.on('explosion', () => (exploded = true));

    for (let i = 0; i < 20 && !exploded; i++) damage.applyImpact('tank_1', 6, 'proj_0', { x: 0, y: 0 });

    expect(exploded).toBe(true);
  });

  it('emits a cable_cut event when a cable piece breaks', () => {
    const piece = makePiece('cable_1', 'cable', { isCable: true });
    const { damage, bus } = setup([piece]);
    let cut = false;
    bus.on('cable_cut', () => (cut = true));

    for (let i = 0; i < 20 && !cut; i++) damage.applyImpact('cable_1', 6, 'proj_0', { x: 0, y: 0 });

    expect(cut).toBe(true);
  });

  it('cuts every constraint owned by a piece when it breaks', () => {
    const piece = makePiece('beam_1', 'metal');
    const other = Matter.Bodies.rectangle(50, 0, 20, 20);
    const constraint = Matter.Constraint.create({ bodyA: piece.body, bodyB: other, stiffness: 1 });
    piece.constraints.push(constraint);

    const { physics, damage } = setup([piece]);
    physics.addBody(other);
    physics.addConstraint(constraint);

    for (let i = 0; i < 30 && !piece.broken; i++) damage.applyImpact('beam_1', 6, 'proj_0', { x: 0, y: 0 });

    expect(piece.broken).toBe(true);
    expect(piece.constraints.length).toBe(0);
  });

  it('reports destruction percent as the weighted share of broken pieces', () => {
    const a = makePiece('a', 'wood');
    const b = makePiece('b', 'wood');
    const { damage } = setup([a, b]);
    expect(damage.getDestructionPercent()).toBe(0);

    for (let i = 0; i < 20 && !a.broken; i++) damage.applyImpact('a', 6, 'proj_0', { x: 0, y: 0 });

    expect(damage.getDestructionPercent()).toBeCloseTo(50, 5);
  });
});
