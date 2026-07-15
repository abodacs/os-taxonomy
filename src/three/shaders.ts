// GLSL shaders for the 3D graph. Pure strings — no React, no Three.js types.
// Extracted from ThreeDGraphCanvas so the shader code is navigable and
// diffable without scrolling through 1800 lines of component logic.

export const POINTS_VERTEX_SHADER = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aSelected;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vSize;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vSelected = aSelected;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);

    // Perspective-scaled sprites keep the specimen readable without turning
    // every node into the same screen-space circle.
    float size = aSize * (640.0 / max(dist, 1.0));

    if (aSize > 0.0 && aAlpha > 0.01) {
      // Small emphasis nudge for the selected node only.
      if (aSelected > 0.5 && aSelected < 1.5) {
        size *= 1.15;
      }

      size = clamp(size, 3.0, 20.0);
    } else {
      size = 0.0;
    }

    vSize = size;
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const POINTS_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vSize;

  void main() {
    // Map point-sprite coords to [-1, 1] so the disc is a unit circle.
    vec2 pc = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pc, pc);
    if (r2 > 1.0) {
      discard;
    }

    // Crisp circular sprite with a restrained antialiased edge.
    float alpha = smoothstep(1.0, 0.84, r2);

    // Flat solid fill — no glow core, no halo. Selection is conveyed by the
    // double-ring outline + size lift, not by shader brightness.
    gl_FragColor = vec4(vColor, alpha * vAlpha);
  }
`;
