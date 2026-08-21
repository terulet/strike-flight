/**
 * Surfaces — each one changes HOW the object travels, never whether the challenge
 * is winnable (launch speed is calibrated per challenge, see physics/calibration.js).
 *
 *   mu          kinetic friction coefficient (Coulomb, mass independent)
 *   drag        viscous coefficient (N per m/s) — divided by mass, so heavy objects shrug it off
 *   windowScale widens/narrows the reachable landing window => difficulty identity
 *   travelBase  distance (m) covered at zero power. Bigger = longer, slower, tenser slide
 *   creep       purely cosmetic: how grainy the sliding sound is
 */
export const SURFACES = [
  {
    id: 'wood',
    name: 'WOOD',
    mu: 0.152,
    drag: 0.10,
    windowScale: 1.0,
    travelBase: 0.17,
    color: '#6b4b30',
    colorTop: '#8a6440',
    grain: '#4d3522',
    accent: '#d2a06a',
    noise: 0.55,
    pitch: 1.0,
  },
  {
    id: 'ice',
    name: 'ICE',
    mu: 0.060,
    drag: 0.045,
    windowScale: 1.18,
    travelBase: 0.24,
    color: '#2c5f78',
    colorTop: '#7fd2f0',
    grain: '#1b4358',
    accent: '#8fe6ff',
    noise: 0.18,
    pitch: 1.55,
  },
  {
    id: 'rubber',
    name: 'RUBBER',
    mu: 0.265,
    drag: 0.22,
    windowScale: 0.86,
    travelBase: 0.14,
    color: '#2a2c32',
    colorTop: '#43464e',
    grain: '#191a1e',
    accent: '#9aa2b1',
    noise: 0.85,
    pitch: 0.62,
  },
  {
    id: 'metal',
    name: 'METAL',
    mu: 0.098,
    drag: 0.07,
    windowScale: 1.08,
    travelBase: 0.21,
    color: '#4a4f58',
    colorTop: '#767d88',
    grain: '#343840',
    accent: '#cfd8e3',
    noise: 0.30,
    pitch: 1.28,
  },
  {
    id: 'sand',
    name: 'SAND',
    mu: 0.205,
    drag: 0.24,
    windowScale: 0.94,
    travelBase: 0.15,
    color: '#7a6742',
    colorTop: '#b39a63',
    grain: '#5d4d31',
    accent: '#e2c98d',
    noise: 1.0,
    pitch: 0.80,
  },
];

export const SURFACE_BY_ID = Object.freeze(
  SURFACES.reduce((acc, s) => ((acc[s.id] = s), acc), {})
);

export function getSurface(id) {
  return SURFACE_BY_ID[id] || SURFACES[0];
}
