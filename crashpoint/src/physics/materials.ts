import type { MaterialId } from '../core/types';

/** Physical properties (feed Matter.js body) + structural properties (feed DamageSystem). */
export interface MaterialProfile {
  id: MaterialId;
  density: number; // Matter.js density (mass = density * area)
  friction: number;
  restitution: number;
  /** Damage points the piece can absorb before breaking. Bigger = tougher. */
  toughness: number;
  /** Multiplier applied to incoming impact damage (frailty). Glass shatters on almost anything. */
  fragility: number;
  color: string; // placeholder fill color
  strokeColor: string;
  breaksInstantly: boolean; // glass-style: any qualifying hit breaks it immediately
}

export const MATERIALS: Record<MaterialId, MaterialProfile> = {
  wood: {
    id: 'wood',
    density: 0.0012,
    friction: 0.6,
    restitution: 0.15,
    toughness: 26,
    fragility: 1.2,
    color: '#b6743a',
    strokeColor: '#7a4a20',
    breaksInstantly: false,
  },
  metal: {
    id: 'metal',
    density: 0.0028,
    friction: 0.5,
    restitution: 0.1,
    toughness: 60,
    fragility: 0.7,
    color: '#8b97a3',
    strokeColor: '#4d565e',
    breaksInstantly: false,
  },
  concrete: {
    id: 'concrete',
    density: 0.0035,
    friction: 0.8,
    restitution: 0.05,
    toughness: 90,
    fragility: 0.55,
    color: '#9a978d',
    strokeColor: '#5c5a52',
    breaksInstantly: false,
  },
  glass: {
    id: 'glass',
    density: 0.0009,
    friction: 0.2,
    restitution: 0.02,
    toughness: 6,
    fragility: 3.0,
    color: '#7fd8e8',
    strokeColor: '#3f97a8',
    breaksInstantly: true,
  },
  cable: {
    id: 'cable',
    density: 0.0006,
    friction: 0.3,
    restitution: 0,
    toughness: 18,
    fragility: 1.6,
    color: '#2b2f36',
    strokeColor: '#111318',
    breaksInstantly: false,
  },
  explosive: {
    id: 'explosive',
    density: 0.0015,
    friction: 0.5,
    restitution: 0.1,
    toughness: 12,
    fragility: 1.8,
    color: '#e8482c',
    strokeColor: '#8f2515',
    breaksInstantly: false,
  },
};

export function getMaterial(id: MaterialId): MaterialProfile {
  return MATERIALS[id];
}
