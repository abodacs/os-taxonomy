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
export const FUNNEL_R_MAX = 125; // maximum radius at the top; keeps the canopy beside the editorial copy
export const FUNNEL_R_FLOOR = 8; // small minimum so age-4 isn't a single point
export const FUNNEL_EXPONENT = 1.2; // smooth funnel power curve
export const FUNNEL_AGE_MIN = 4;
// The source taxonomy's ageRangeStart tops out at 13 while its ranges extend
// through 15. Treat that top band as the specialization canopy so the full
// dataset uses the available vertical volume.
export const FUNNEL_AGE_MAX = 13;

/**
 * Radial distance from the central Y-axis as a function of vertical position.
 * Uses a power law so the funnel tapers smoothly: nearly cylindrical near the
 * base, flaring outward toward the top. A small floor keeps the youngest nodes
 * from collapsing to a single point while still reading as a narrow base.
 *
 *   r(y) = R_floor + (R_max - R_floor) * (y_local / H)^1.2
 *
 * where y_local is the height measured from the bottom of the funnel.
 */
export function funnelRadius(y: number): number {
  const yLocal = Math.max(0, y - FUNNEL_Y_MIN); // 0 at bottom, H at top
  const t = yLocal / FUNNEL_HEIGHT;
  return FUNNEL_R_FLOOR + (FUNNEL_R_MAX - FUNNEL_R_FLOOR) * Math.pow(t, FUNNEL_EXPONENT);
}

export function funnelYForAge(age: number): number {
  const t = Math.max(0, Math.min(1, (age - FUNNEL_AGE_MIN) / (FUNNEL_AGE_MAX - FUNNEL_AGE_MIN)));
  return FUNNEL_Y_MIN + t * FUNNEL_HEIGHT;
}
