// Graph layout math for the 3D taxonomy graph. Extracted from
// ThreeDGraphCanvas so the layout algorithm is navigable without scrolling
// through component logic. Pure functions — no React, no Three.js.

/**
 * Layout constants for the tapered funnel. Nodes are arranged vertically by
 * age (Y axis) and radially (X & Z) using cylindrical coordinates where the
 * maximum radius is a power-law function of height, creating a smooth
 * tapered funnel that is narrow at the foundation (age 4) and wide at the
 * specialization canopy (age 15+).
 */
export const FUNNEL_HEIGHT = 240; // total vertical span (y: -120 .. +120)
export const FUNNEL_Y_MIN = -120; // bottom (age 4)
export const FUNNEL_Y_MAX = 120; // top (age 15)
export const FUNNEL_R_MAX = 165; // maximum radius at the top
export const FUNNEL_R_FLOOR = 8; // small minimum so age-4 isn't a single point
export const FUNNEL_EXPONENT = 1.2; // r(y) = R_max * (y_local/H)^1.2

/**
 * Radial distance from the central Y-axis as a function of vertical position.
 * Uses a power law so the funnel tapers smoothly: nearly cylindrical near the
 * base, flaring outward toward the top. A small floor keeps the youngest nodes
 * from collapsing to a single point while still reading as a narrow base.
 *
 *   r(y) = R_floor + R_max * (y_local / H)^1.2
 *
 * where y_local is the height measured from the bottom of the funnel.
 */
export function funnelRadius(y: number): number {
  const yLocal = Math.max(0, y - FUNNEL_Y_MIN); // 0 at bottom, H at top
  const t = yLocal / FUNNEL_HEIGHT;
  return FUNNEL_R_FLOOR + FUNNEL_R_MAX * Math.pow(t, FUNNEL_EXPONENT);
}
