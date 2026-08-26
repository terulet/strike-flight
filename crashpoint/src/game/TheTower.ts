import Matter from 'matter-js';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { getMaterial } from '../physics/materials';
import { StructuralPiece } from '../entities/StructuralPiece';
import type { ConstraintSpec, DecorSpec, PieceSpec, TowerLevelData } from './LevelSchema';

// --- World layout constants (see docs/SCALE.md: ~100px = 1m) -------------------------------
export const WORLD_WIDTH = 1700;
export const WORLD_HEIGHT = 960;
export const GROUND_Y = 880; // top surface of the ground

const COL_LEFT_X = 560;
const COL_RIGHT_X = 1080;
const COL_HALF_H = 280;
const COL_Y = GROUND_Y - COL_HALF_H; // column center y

const FLOOR1_Y = 750;
const FLOOR2_Y = 610;
const FLOOR3_Y = 470;
const ROOF_Y = 330;
const SPAN_X = 820; // center between columns
// Kept a few px short of the columns' inner edges (598) on both sides so beams/platforms never
// spawn overlapping a column body — an initial overlap makes Matter shove them apart violently,
// which reads as damage and breaks pieces before the player has done anything (section 34).
const SPAN_W = 430;

function platformY(beamY: number, platformHalfH = 12): number {
  return beamY - 18 - platformHalfH; // rests just on top of the beam (beam half-height 18)
}

const LEVEL_NAME = 'THE TOWER';

const pieces: PieceSpec[] = [
  // --- Primary structure: columns ---
  { id: 'col_left', role: 'primary', material: 'concrete', x: COL_LEFT_X, y: COL_Y, shape: { kind: 'rectangle', width: 74, height: COL_HALF_H * 2 }, structuralValue: 22, assetId: 'structure_column_concrete_placeholder', restsOnGround: true },
  // Steel skin on col_right is purely cosmetic variety (MEGA_ASSET_PACK_v1) — material stays
  // 'concrete' so toughness/damage economics are unchanged; see ASSET_INTEGRATION_REPORT.md.
  { id: 'col_right', role: 'primary', material: 'concrete', x: COL_RIGHT_X, y: COL_Y, shape: { kind: 'rectangle', width: 74, height: COL_HALF_H * 2 }, structuralValue: 22, assetId: 'structure_column_steel_placeholder', restsOnGround: true },

  // --- Primary structure: beams (span between columns) ---
  { id: 'beam_roof', role: 'primary', material: 'metal', x: SPAN_X, y: ROOF_Y, shape: { kind: 'rectangle', width: SPAN_W, height: 36 }, structuralValue: 6, assetId: 'structure_beam_metal_placeholder' },
  { id: 'beam_floor3', role: 'primary', material: 'metal', x: SPAN_X, y: FLOOR3_Y, shape: { kind: 'rectangle', width: SPAN_W, height: 36 }, structuralValue: 8, assetId: 'structure_beam_metal_placeholder' },
  { id: 'beam_floor2', role: 'primary', material: 'metal', x: SPAN_X, y: FLOOR2_Y, shape: { kind: 'rectangle', width: SPAN_W, height: 36 }, structuralValue: 8, assetId: 'structure_beam_metal_placeholder' },
  { id: 'beam_floor1', role: 'primary', material: 'metal', x: SPAN_X, y: FLOOR1_Y, shape: { kind: 'rectangle', width: SPAN_W, height: 36 }, structuralValue: 8, assetId: 'structure_beam_metal_placeholder' },

  // --- Secondary structure: platforms / walkway ---
  { id: 'platform_floor1', role: 'secondary', material: 'wood', x: SPAN_X, y: platformY(FLOOR1_Y), shape: { kind: 'rectangle', width: SPAN_W, height: 24 }, structuralValue: 4, assetId: 'structure_platform_wood_placeholder' },
  { id: 'platform_floor2', role: 'secondary', material: 'wood', x: SPAN_X, y: platformY(FLOOR2_Y), shape: { kind: 'rectangle', width: SPAN_W, height: 24 }, structuralValue: 4, assetId: 'structure_platform_wood_placeholder' },
  { id: 'platform_floor3', role: 'secondary', material: 'wood', x: SPAN_X, y: platformY(FLOOR3_Y), shape: { kind: 'rectangle', width: SPAN_W, height: 24 }, structuralValue: 4, assetId: 'structure_platform_wood_placeholder' },
  { id: 'walkway_floor2', role: 'secondary', material: 'metal', x: 1300, y: platformY(FLOOR2_Y), shape: { kind: 'rectangle', width: 340, height: 20 }, structuralValue: 3, assetId: 'structure_platform_walkway_placeholder' },

  // --- Reactive / props ---
  // Physics collision boxes are shorter than the recommended final-art dims in ASSET_REQUIREMENTS.md
  // (a full-height box didn't fit in the gap between floors) — the sprite can still be drawn taller.
  { id: 'gas_tank', role: 'reactive', material: 'explosive', x: COL_LEFT_X + 100, y: platformY(FLOOR1_Y) - 12 - 35, shape: { kind: 'rectangle', width: 90, height: 70 }, structuralValue: 5, assetId: 'react_gas_tank_placeholder', isExplosive: true },
  { id: 'glass_panel', role: 'secondary', material: 'glass', x: SPAN_X + 130, y: platformY(FLOOR3_Y) - 12 - 32, shape: { kind: 'rectangle', width: 130, height: 64 }, structuralValue: 2, assetId: 'break_glass_panel_placeholder' },
  { id: 'crate_1', role: 'prop', material: 'wood', x: COL_LEFT_X + 100, y: platformY(FLOOR2_Y) - 12 - 30, shape: { kind: 'rectangle', width: 56, height: 56 }, structuralValue: 1, assetId: 'prop_crate_wood_placeholder' },
  { id: 'crate_2', role: 'prop', material: 'wood', x: SPAN_X - 40, y: platformY(FLOOR2_Y) - 12 - 30, shape: { kind: 'rectangle', width: 56, height: 56 }, structuralValue: 1, assetId: 'prop_crate_wood_placeholder' },
  { id: 'barrel_1', role: 'prop', material: 'metal', x: COL_RIGHT_X - 90, y: platformY(FLOOR1_Y) - 12 - 34, shape: { kind: 'rectangle', width: 48, height: 68 }, structuralValue: 1, assetId: 'prop_barrel_metal_placeholder' },
  { id: 'barrel_2', role: 'prop', material: 'metal', x: SPAN_X - 60, y: platformY(FLOOR3_Y) - 12 - 34, shape: { kind: 'rectangle', width: 48, height: 68 }, structuralValue: 1, assetId: 'prop_barrel_metal_placeholder' },
  { id: 'generator', role: 'prop', material: 'metal', x: COL_LEFT_X - 170, y: GROUND_Y - 55, shape: { kind: 'rectangle', width: 130, height: 110 }, structuralValue: 4, assetId: 'react_generator_placeholder', restsOnGround: true },

  // --- Counterweight (cable + mass) hanging under floor2 beam — short drop, stays clear of
  // platform_floor1 below it (a long drop here would spawn the ball overlapping that platform). ---
  { id: 'cable_counterweight', role: 'secondary', material: 'cable', x: SPAN_X + 60, y: FLOOR2_Y + 18 + 10, shape: { kind: 'rectangle', width: 8, height: 20 }, structuralValue: 2, assetId: 'weak_tension_cable_placeholder', isCable: true },
  { id: 'counterweight_ball', role: 'prop', material: 'metal', x: SPAN_X + 60, y: FLOOR2_Y + 18 + 10 + 10 + 25, shape: { kind: 'circle', radius: 25 }, structuralValue: 4, assetId: 'react_counterweight_placeholder' },

  // --- Crane: independent structure well clear of the tower's footprint, boom overhangs the roof
  // with a wrecking-ball load dangling above it (tall enough that it doesn't spawn overlapping
  // the roof beam — see the geometry note in docs/SCALE.md). ---
  { id: 'crane_mast', role: 'primary', material: 'metal', x: 1600, y: GROUND_Y - 325, shape: { kind: 'rectangle', width: 46, height: 650 }, structuralValue: 6, assetId: 'environment_crane_placeholder', restsOnGround: true },
  { id: 'crane_boom', role: 'secondary', material: 'metal', x: 1470, y: 216, shape: { kind: 'rectangle', width: 300, height: 28 }, structuralValue: 4, assetId: 'environment_crane_placeholder' },
  { id: 'crane_cable', role: 'secondary', material: 'cable', x: 1320, y: 305, shape: { kind: 'rectangle', width: 10, height: 150 }, structuralValue: 2, assetId: 'weak_tension_cable_placeholder', isCable: true },
  { id: 'crane_hook', role: 'secondary', material: 'metal', x: 1320, y: 394, shape: { kind: 'circle', radius: 14 }, structuralValue: 1, assetId: 'mach_crane_hook_placeholder' },
  { id: 'crane_load', role: 'prop', material: 'concrete', x: 1320, y: 458, shape: { kind: 'circle', radius: 50 }, structuralValue: 6, assetId: 'prop_suspended_load_placeholder' },
];

const constraints: ConstraintSpec[] = [
  // Foundation anchors — two points per column/mast so it's welded upright (not just resting on
  // friction, which let a tall slender column slowly tip under sideways load). Breaking the piece
  // cuts both, so a demolished column genuinely topples instead of being physically unbreakable.
  { id: 'joint_col_left_base_l', bodyA: 'col_left', bodyB: 'world', pointA: { x: -31, y: COL_HALF_H - 4 }, pointB: { x: COL_LEFT_X - 31, y: GROUND_Y - 4 }, stiffness: 1, ownedBy: 'bodyA' },
  { id: 'joint_col_left_base_r', bodyA: 'col_left', bodyB: 'world', pointA: { x: 31, y: COL_HALF_H - 4 }, pointB: { x: COL_LEFT_X + 31, y: GROUND_Y - 4 }, stiffness: 1, ownedBy: 'bodyA' },
  { id: 'joint_col_right_base_l', bodyA: 'col_right', bodyB: 'world', pointA: { x: -31, y: COL_HALF_H - 4 }, pointB: { x: COL_RIGHT_X - 31, y: GROUND_Y - 4 }, stiffness: 1, ownedBy: 'bodyA' },
  { id: 'joint_col_right_base_r', bodyA: 'col_right', bodyB: 'world', pointA: { x: 31, y: COL_HALF_H - 4 }, pointB: { x: COL_RIGHT_X + 31, y: GROUND_Y - 4 }, stiffness: 1, ownedBy: 'bodyA' },

  // Beams bolted to the columns at each floor.
  { id: 'joint_roof_left', bodyA: 'beam_roof', bodyB: 'col_left', pointA: { x: -SPAN_W / 2 + 10, y: 0 }, pointB: { x: 27, y: -COL_HALF_H + 20 }, stiffness: 0.95, ownedBy: 'both' },
  { id: 'joint_roof_right', bodyA: 'beam_roof', bodyB: 'col_right', pointA: { x: SPAN_W / 2 - 10, y: 0 }, pointB: { x: -27, y: -COL_HALF_H + 20 }, stiffness: 0.95, ownedBy: 'both' },
  { id: 'joint_f3_left', bodyA: 'beam_floor3', bodyB: 'col_left', pointA: { x: -SPAN_W / 2 + 10, y: 0 }, pointB: { x: 27, y: -30 }, stiffness: 0.9, ownedBy: 'both' },
  { id: 'joint_f3_right', bodyA: 'beam_floor3', bodyB: 'col_right', pointA: { x: SPAN_W / 2 - 10, y: 0 }, pointB: { x: -27, y: -30 }, stiffness: 0.9, ownedBy: 'both' },
  { id: 'joint_f2_left', bodyA: 'beam_floor2', bodyB: 'col_left', pointA: { x: -SPAN_W / 2 + 10, y: 0 }, pointB: { x: 27, y: 10 }, stiffness: 0.9, ownedBy: 'both' },
  { id: 'joint_f2_right', bodyA: 'beam_floor2', bodyB: 'col_right', pointA: { x: SPAN_W / 2 - 10, y: 0 }, pointB: { x: -27, y: 10 }, stiffness: 0.9, ownedBy: 'both' },
  { id: 'joint_f1_left', bodyA: 'beam_floor1', bodyB: 'col_left', pointA: { x: -SPAN_W / 2 + 10, y: 0 }, pointB: { x: 27, y: 50 }, stiffness: 0.9, ownedBy: 'both' },
  { id: 'joint_f1_right', bodyA: 'beam_floor1', bodyB: 'col_right', pointA: { x: SPAN_W / 2 - 10, y: 0 }, pointB: { x: -27, y: 50 }, stiffness: 0.9, ownedBy: 'both' },

  // Platforms pinned to their beam (keeps them from sliding off during idle settle).
  { id: 'joint_plat1', bodyA: 'platform_floor1', bodyB: 'beam_floor1', stiffness: 0.85, ownedBy: 'both' },
  { id: 'joint_plat2', bodyA: 'platform_floor2', bodyB: 'beam_floor2', stiffness: 0.85, ownedBy: 'both' },
  { id: 'joint_plat3', bodyA: 'platform_floor3', bodyB: 'beam_floor3', stiffness: 0.85, ownedBy: 'both' },
  // Cantilevered past the end of beam_floor2 with nothing underneath it, so — like the columns —
  // it needs two anchor points or it just hinges/swings around a single pivot (section 34).
  { id: 'joint_walkway_top', bodyA: 'walkway_floor2', bodyB: 'col_right', pointA: { x: -150, y: -8 }, pointB: { x: 27, y: 2 }, stiffness: 0.85, ownedBy: 'both' },
  { id: 'joint_walkway_bottom', bodyA: 'walkway_floor2', bodyB: 'col_right', pointA: { x: -150, y: 8 }, pointB: { x: 27, y: 18 }, stiffness: 0.85, ownedBy: 'both' },

  // Counterweight cable.
  { id: 'joint_cw_top', bodyA: 'cable_counterweight', bodyB: 'beam_floor2', pointA: { x: 0, y: -10 }, pointB: { x: 60, y: 18 }, stiffness: 0.9, ownedBy: 'bodyA' },
  { id: 'joint_cw_ball', bodyA: 'cable_counterweight', bodyB: 'counterweight_ball', pointA: { x: 0, y: 10 }, stiffness: 0.9, ownedBy: 'bodyA' },

  // Crane assembly.
  { id: 'joint_crane_base_l', bodyA: 'crane_mast', bodyB: 'world', pointA: { x: -18, y: 321 }, pointB: { x: 1600 - 18, y: GROUND_Y - 4 }, stiffness: 1, ownedBy: 'bodyA' },
  { id: 'joint_crane_base_r', bodyA: 'crane_mast', bodyB: 'world', pointA: { x: 18, y: 321 }, pointB: { x: 1600 + 18, y: GROUND_Y - 4 }, stiffness: 1, ownedBy: 'bodyA' },
  // Two points (not one) so the boom — cantilevered far past the mast on one side — doesn't
  // tip over its narrow contact patch the same way the walkway did.
  { id: 'joint_crane_boom_a', bodyA: 'crane_boom', bodyB: 'crane_mast', pointA: { x: 130, y: -10 }, pointB: { x: -12, y: -325 }, stiffness: 0.95, ownedBy: 'both' },
  { id: 'joint_crane_boom_b', bodyA: 'crane_boom', bodyB: 'crane_mast', pointA: { x: 130, y: 10 }, pointB: { x: 12, y: -325 }, stiffness: 0.95, ownedBy: 'both' },
  { id: 'joint_crane_cable_top', bodyA: 'crane_cable', bodyB: 'crane_boom', pointA: { x: 0, y: -75 }, pointB: { x: -150, y: 14 }, stiffness: 0.9, ownedBy: 'bodyA' },
  { id: 'joint_crane_cable_hook', bodyA: 'crane_cable', bodyB: 'crane_hook', pointA: { x: 0, y: 75 }, stiffness: 0.9, ownedBy: 'bodyA' },
  { id: 'joint_crane_hook_load', bodyA: 'crane_hook', bodyB: 'crane_load', stiffness: 0.9, ownedBy: 'bodyA' },
];

const decor: DecorSpec[] = [
  { id: 'decor_sky', x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, shape: { kind: 'rectangle', width: WORLD_WIDTH, height: WORLD_HEIGHT }, assetId: 'background_sky_industrial_placeholder', color: '#1b2230', strokeColor: '#1b2230', layer: 'far' },
  { id: 'decor_truck', x: 250, y: GROUND_Y - 45, shape: { kind: 'rectangle', width: 220, height: 90 }, assetId: 'prop_truck_placeholder', color: '#4a6d8c', strokeColor: '#2c4256', layer: 'near' },
  { id: 'decor_pipes', x: 1550, y: GROUND_Y - 220, shape: { kind: 'rectangle', width: 90, height: 380 }, assetId: 'environment_decor_pipes_placeholder', color: '#5c6570', strokeColor: '#3a4149', layer: 'near' },
  { id: 'decor_sign', x: 900, y: 90, shape: { kind: 'rectangle', width: 160, height: 90 }, assetId: 'environment_decor_sign_placeholder', color: '#e8482c', strokeColor: '#8f2515', layer: 'near' },

  // --- Weak-point / structural accents (MEGA_ASSET_PACK_v1) — purely visual, no physics body.
  // Communicate "this looks important" per section 8 without any on-screen "SHOOT HERE" text.
  { id: 'accent_brace_left', x: COL_LEFT_X + 44, y: GROUND_Y - 68, shape: { kind: 'rectangle', width: 92, height: 69 }, assetId: 'structure_brace_triangular_placeholder', color: '#5c6570', strokeColor: '#3a4149', layer: 'accent' },
  { id: 'accent_brace_right', x: COL_RIGHT_X - 44, y: GROUND_Y - 68, shape: { kind: 'rectangle', width: 92, height: 69 }, assetId: 'structure_brace_triangular_placeholder', color: '#5c6570', strokeColor: '#3a4149', layer: 'accent', flipX: true },
  { id: 'accent_hinge_left', x: COL_LEFT_X + 37, y: FLOOR2_Y, shape: { kind: 'rectangle', width: 42, height: 50 }, assetId: 'weak_hinge_heavy_placeholder', color: '#6b6f76', strokeColor: '#33363b', layer: 'accent' },
  { id: 'accent_hinge_right', x: COL_RIGHT_X - 37, y: FLOOR2_Y, shape: { kind: 'rectangle', width: 42, height: 50 }, assetId: 'weak_hinge_heavy_placeholder', color: '#6b6f76', strokeColor: '#33363b', layer: 'accent', flipX: true },
  { id: 'accent_junction_roof', x: COL_RIGHT_X - 27, y: ROOF_Y, shape: { kind: 'rectangle', width: 44, height: 44 }, assetId: 'weak_junction_core_placeholder', color: '#6b6f76', strokeColor: '#33363b', layer: 'accent' },
];

export const THE_TOWER: TowerLevelData = {
  name: LEVEL_NAME,
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  groundY: GROUND_Y,
  launcherOrigin: { x: 110, y: 745 },
  pieces,
  constraints,
  decor,
};

export interface BuiltTower {
  pieces: Map<string, StructuralPiece>;
  groundBody: Matter.Body;
  totalStructuralValue: number;
  data: TowerLevelData;
}

/** Instantiates THE_TOWER into a fresh PhysicsWorld. Call again after PhysicsWorld.reset() for RETRY. */
export function buildTheTower(physics: PhysicsWorld): BuiltTower {
  const pieceMap = new Map<string, StructuralPiece>();
  const bodyMap = new Map<string, Matter.Body>();

  const groundBody = Matter.Bodies.rectangle(WORLD_WIDTH / 2, GROUND_Y + 100, WORLD_WIDTH + 400, 200, {
    isStatic: true,
    friction: 0.9,
    label: 'ground',
  });
  physics.addBody(groundBody);

  // World bounds walls (invisible) so stray debris doesn't fall forever / fly off-screen.
  const leftWall = Matter.Bodies.rectangle(-40, WORLD_HEIGHT / 2, 80, WORLD_HEIGHT * 3, { isStatic: true, label: 'wall' });
  const rightWall = Matter.Bodies.rectangle(WORLD_WIDTH + 40, WORLD_HEIGHT / 2, 80, WORLD_HEIGHT * 3, { isStatic: true, label: 'wall' });
  physics.addBody(leftWall);
  physics.addBody(rightWall);

  let totalStructuralValue = 0;

  for (const spec of THE_TOWER.pieces) {
    const mat = getMaterial(spec.material);
    const body =
      spec.shape.kind === 'rectangle'
        ? Matter.Bodies.rectangle(spec.x, spec.y, spec.shape.width, spec.shape.height, {
            angle: spec.angle ?? 0,
            density: mat.density,
            friction: spec.restsOnGround ? Math.max(mat.friction, 0.85) : mat.friction,
            restitution: mat.restitution,
            label: spec.id,
          })
        : Matter.Bodies.circle(spec.x, spec.y, spec.shape.radius, {
            angle: spec.angle ?? 0,
            density: mat.density,
            friction: mat.friction,
            restitution: mat.restitution,
            label: spec.id,
          });

    physics.addBody(body);
    bodyMap.set(spec.id, body);

    const piece = new StructuralPiece({
      id: spec.id,
      body,
      visual: { assetId: spec.assetId, shape: spec.shape },
      material: spec.material,
      role: spec.role,
      structuralValue: spec.structuralValue,
      toughness: mat.toughness,
      isExplosive: spec.isExplosive,
      isCable: spec.isCable,
    });
    pieceMap.set(spec.id, piece);
    totalStructuralValue += spec.structuralValue;
  }

  for (const cSpec of THE_TOWER.constraints) {
    const bodyA = bodyMap.get(cSpec.bodyA);
    if (!bodyA) continue;
    const isWorldB = cSpec.bodyB === 'world';
    const bodyB = isWorldB ? undefined : bodyMap.get(cSpec.bodyB);
    if (!isWorldB && !bodyB) continue;

    const constraint = Matter.Constraint.create({
      bodyA,
      pointA: cSpec.pointA ?? { x: 0, y: 0 },
      bodyB,
      pointB: isWorldB ? cSpec.pointB ?? { x: 0, y: 0 } : cSpec.pointB ?? { x: 0, y: 0 },
      stiffness: cSpec.stiffness,
      length: cSpec.length,
      damping: cSpec.damping ?? 0.15,
      label: cSpec.id,
    });
    physics.addConstraint(constraint);

    const pieceA = pieceMap.get(cSpec.bodyA);
    const pieceB = bodyB ? pieceMap.get(cSpec.bodyB) : undefined;
    if (cSpec.ownedBy === 'bodyA' || cSpec.ownedBy === 'both') pieceA?.constraints.push(constraint);
    if (cSpec.ownedBy === 'bodyB' || cSpec.ownedBy === 'both') pieceB?.constraints.push(constraint);
  }

  return { pieces: pieceMap, groundBody, totalStructuralValue, data: THE_TOWER };
}
