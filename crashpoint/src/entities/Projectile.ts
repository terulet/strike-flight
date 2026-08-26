import type Matter from 'matter-js';
import type { ProjectileId } from '../core/types';
import type { GameEntity, VisualSprite } from './GameEntity';

export interface ProjectileConfig {
  id: ProjectileId;
  label: string;
  description: string;
  radius: number; // px (placeholder scale, see docs/SCALE.md)
  density: number;
  restitution: number;
  friction: number;
  /** Multiplies raw impact speed before it's applied as damage — "how hard it hits". */
  forceMultiplier: number;
  /** Drill Spike: keeps momentum through light pieces instead of bouncing off. */
  piercing: boolean;
  /** Pulse Orb: on trigger, applies a radial impulse + damage falloff around itself. */
  pulse: { radius: number; impulse: number } | null;
  assetId: string;
  color: string;
}

export const PROJECTILES: Record<ProjectileId, ProjectileConfig> = {
  impact_core: {
    id: 'impact_core',
    label: 'IMPACT CORE',
    description: 'Bola pesada. Máxima transferencia de fuerza bruta.',
    radius: 16,
    density: 0.012,
    restitution: 0.25,
    friction: 0.4,
    forceMultiplier: 1.35,
    piercing: false,
    pulse: null,
    assetId: 'projectile_impact_core_placeholder',
    color: '#e8482c',
  },
  drill_spike: {
    id: 'drill_spike',
    label: 'DRILL SPIKE',
    description: 'Perforante. Concentra daño y atraviesa piezas ligeras.',
    radius: 8,
    density: 0.02,
    restitution: 0.05,
    friction: 0.1,
    forceMultiplier: 1.1,
    piercing: true,
    pulse: null,
    assetId: 'projectile_drill_spike_placeholder',
    color: '#f2c14e',
  },
  pulse_orb: {
    id: 'pulse_orb',
    label: 'PULSE ORB',
    description: 'Onda de choque al impactar. Desplaza y desestabiliza.',
    radius: 12,
    density: 0.007,
    restitution: 0.4,
    friction: 0.3,
    forceMultiplier: 0.5,
    piercing: false,
    pulse: { radius: 170, impulse: 0.055 },
    assetId: 'projectile_pulse_orb_placeholder',
    color: '#5ad1ff',
  },
};

export class Projectile implements GameEntity {
  id: string;
  body: Matter.Body;
  visual: VisualSprite;
  config: ProjectileConfig;
  hasPulsed = false;
  spawnedAtMs: number;

  constructor(id: string, body: Matter.Body, config: ProjectileConfig, spawnedAtMs: number) {
    this.id = id;
    this.body = body;
    this.config = config;
    this.visual = { assetId: config.assetId, shape: { kind: 'circle', radius: config.radius } };
    this.spawnedAtMs = spawnedAtMs;
  }
}
