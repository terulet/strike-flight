import type Matter from 'matter-js';

/**
 * Visual/physical separation (section 42): the physics body never reads sprite dimensions,
 * and the renderer never reads physics internals directly — both read this shared descriptor.
 */
export type ShapeDescriptor =
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'circle'; radius: number };

export interface VisualSprite {
  /** Placeholder asset id (see AssetManifest). Swappable later without touching gameplay code. */
  assetId: string;
  shape: ShapeDescriptor;
}

/** Base fields shared by every simulated object (structural piece or projectile). */
export interface GameEntity {
  id: string;
  body: Matter.Body;
  visual: VisualSprite;
}
