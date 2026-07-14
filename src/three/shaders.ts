// GLSL shaders for the 3D graph. Pure strings — no React, no Three.js types.
// Extracted from ThreeDGraphCanvas so the shader code is navigable and
// diffable without scrolling through 1800 lines of component logic.

export const POINTS_VERTEX_SHADER = `
  uniform float uZoom;
  uniform float uScale;

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

    float size = aSize * (450.0 / dist) * uZoom * uScale;

    if (aSize > 0.0 && aAlpha > 0.01) {
      // Small emphasis nudge for the selected node only.
      if (aSelected > 0.5 && aSelected < 1.5) {
        size *= 1.15;
      }

      // Keep nodes visible when zoomed out.
      if (size < 5.0) {
        size = 5.0;
      }
    } else {
      size = 0.0;
    }

    vSize = size;
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const POINTS_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uReducedMotion;
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

    // Clean, soft, anti-aliased circular dot — no fake-sphere lighting, no
    // specular hotspot, no rim. A smooth radial falloff gives the glowing
    // vector-dot aesthetic. Additive blending makes overlaps glow elegantly.
    float alpha = smoothstep(1.0, 0.55, r2);

    // Subtle bright core so the dot reads as a luminous point, not a flat disc.
    float core = smoothstep(0.45, 0.0, r2) * 0.35;
    vec3 col = vColor + vColor * core;

    // Gentle pulse for the primary selected node so it draws the eye without
    // a heavy halo. Disabled under prefers-reduced-motion (the selection ring
    // + size/opacity lift still convey selection without oscillation).
    float selPulse = 0.0;
    if (vSelected > 0.5 && vSelected < 1.5) {
      selPulse = (0.12 + 0.08 * sin(uTime * 2.4)) * (1.0 - uReducedMotion);
    }
    col += vColor * selPulse;

    gl_FragColor = vec4(col, alpha * vAlpha);
  }
`;
