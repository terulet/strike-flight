/**
 * How to place a real production PNG onto a piece whose physics collider was tuned first and
 * whose art (MEGA_ASSET_PACK_v1) wasn't necessarily drawn at the same aspect ratio (section 2 of
 * INTEGRATION_GUIDE.md: scale the visual, never resize the collider to fit the artwork).
 *
 * - 'width'  — match the collider's width, keep the art's aspect ratio, let height overflow.
 *              Used for tall art on a physically-thin horizontal collider (beams, walkways).
 * - 'height' — match the collider's height, keep aspect, let width overflow.
 *              Used for wide/pedestal-shaped art on a physically-slender vertical collider (columns).
 * - 'stretch' — fill the collider bounds exactly (only where the art's own aspect is already close).
 * - 'fixed'  — ignore the collider size entirely; draw at an explicit world-unit size. Used for
 *              small mechanical details (crane hook) and decor accents with no collider at all.
 */
export type SpriteFitMode = 'width' | 'height' | 'stretch' | 'fixed';

export interface SpriteFitConfig {
  mode: SpriteFitMode;
  /** Fraction (0..1) of the drawn sprite's own height that sits above its anchor point. Default 0.5 (center). */
  pivotY?: number;
  pivotX?: number;
  /** Extra rotation (radians) baked into the art itself (e.g. a horizontal cable asset used vertically). */
  rotationOffset?: number;
  /** True when rotationOffset is ±90°: the collider's width/height must swap before fitting,
   *  since the canvas rotation alone doesn't change which collider axis the art's own width targets. */
  swapAxesForFit?: boolean;
  /** Only for mode 'fixed': explicit render size in world-units. */
  fixedSize?: { width: number; height: number };
  /** Multiplies the computed size — for art that should read larger/smaller than a literal fit. */
  scale?: number;
}

const HALF_PI = Math.PI / 2;

/** Keyed by assetId. Anything not listed here falls back to a centered 'stretch' (old placeholder behavior). */
export const SPRITE_FITS: Record<string, SpriteFitConfig> = {
  structure_column_concrete_placeholder: { mode: 'height', pivotY: 0.5 },
  structure_column_steel_placeholder: { mode: 'height', pivotY: 0.5 },
  structure_beam_metal_placeholder: { mode: 'width', pivotY: 0.42 },
  structure_platform_walkway_placeholder: { mode: 'width', pivotY: 0.38 },
  break_glass_panel_placeholder: { mode: 'stretch' },
  mach_crane_hook_placeholder: { mode: 'fixed', fixedSize: { width: 70, height: 70 }, pivotY: 0.12 },
  weak_tension_cable_placeholder: { mode: 'width', rotationOffset: HALF_PI, swapAxesForFit: true },
  weak_hinge_heavy_placeholder: { mode: 'stretch' },
  weak_junction_core_placeholder: { mode: 'stretch' },
  structure_brace_triangular_placeholder: { mode: 'stretch' },
  projectile_impact_core_placeholder: { mode: 'height', scale: 2.2 },
  projectile_drill_spike_placeholder: { mode: 'height', scale: 2.6, rotationOffset: -0.47 },
};

export function getSpriteFit(assetId: string): SpriteFitConfig {
  return SPRITE_FITS[assetId] ?? { mode: 'stretch' };
}
