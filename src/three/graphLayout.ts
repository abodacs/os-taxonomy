// Graph layout math for the 3D taxonomy graph. Extracted from
// ThreeDGraphCanvas so the layout algorithm is navigable without scrolling
// through component logic. Pure functions — no React, no Three.js.

/**
 * Jagged thunder/lightning path offset based on vertical coordinate Y.
 * Produces a stable deterministic zig-zag that forms the central "spine"
 * of the graph. Each subject's nodes spiral around this spine.
 */
export function getLightningOffset(y: number) {
  const segmentSize = 30.0;
  const segment = Math.floor((y + 120) / segmentSize);
  const t = ((y + 120) % segmentSize) / segmentSize;

  // Stable deterministic vertices for a lightning zig-zag
  const getVertex = (seg: number) => {
    const x = Math.sin(seg * 2.7) * 12.0 + Math.cos(seg * 5.4) * 3.5;
    const z = Math.cos(seg * 3.9) * 12.0 + Math.sin(seg * 7.1) * 3.5;
    return { x, z };
  };

  const p0 = getVertex(segment);
  const p1 = getVertex(segment + 1);

  // Linear interpolation to form the jagged lightning skeleton
  const dx = p0.x + (p1.x - p0.x) * t;
  const dz = p0.z + (p1.z - p0.z) * t;

  return { x: dx, z: dz };
}
