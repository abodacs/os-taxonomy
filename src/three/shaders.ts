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
  attribute float aMilestone;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vMilestone;
  varying float vSize;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vSelected = aSelected;
    vMilestone = aMilestone;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);

    float size = aSize * (450.0 / dist) * uZoom * uScale;

    if (aSize > 0.0) {
      // A small, consistent emphasis for the selected node only. The
      // attribute already carries the bulk of the size change, so this
      // is just a nudge (was 1.5x which combined with the attribute to
      // make selection wildly oversized).
      if (aSelected == 1.0) {
        size *= 1.15;
      }

      // Milestone nodes get a larger minimum on-screen size so they stay
      // visible when zoomed out and read as the "important" anchors.
      float minPx = aMilestone > 0.5 ? 9.5 : 6.5;
      if (size < minPx) {
        size = minPx;
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
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vMilestone;
  varying float vSize;

  void main() {
    // Map point-sprite coords to [-1, 1] so the disc is a unit circle.
    vec2 pc = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pc, pc);
    // Milestones render a thin pulsing halo just outside the unit disc,
    // so expand the discard boundary for them only.
    float maxR2 = vMilestone > 0.5 ? 1.56 : 1.0; // 1.25^2
    if (r2 > maxR2) {
      discard;
    }

    // --- FAKE SPHERE: reconstruct the surface normal of a camera-facing
    // hemisphere. z = sqrt(1 - r^2) turns the flat disc into a smooth
    // spherical dome, giving each node 3D form at zero geometry cost.
    float nz = sqrt(max(0.0, 1.0 - r2));
    vec3 N = vec3(pc.x, pc.y, nz);

    // Fixed screen-space light (upper-left, toward camera). Billboards
    // always face the camera, so this keeps the highlight consistent on
    // every node - exactly like the lit reference spheres.
    vec3 L = normalize(vec3(-0.45, 0.55, 0.85));

    // Diffuse + ambient so the shadowed side stays readable, not black.
    float diffuse = max(dot(N, L), 0.0);
    float ambient = 0.45;
    vec3 lit = vColor * (ambient + diffuse * 0.75);

    // Specular hotspot (Blinn-Phong): the glossy white dot of a solid sphere.
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 52.0);
    lit += vec3(1.0) * spec * 1.0;

    // Rim definition: brighten the silhouette edge so overlapping nodes
    // stop melting into each other (the source of the "cloudy" haze).
    float rim = pow(1.0 - nz, 2.8);
    lit += vColor * rim * 0.4;

    // Extra glow for the actively selected node (vSelected ~= 1.0).
    // Boosted so the selected node reads clearly via color/brightness
    // rather than relying on an oversized scale.
    float selectedBoost = step(0.5, vSelected) * (1.0 - step(1.5, vSelected));
    lit += vColor * selectedBoost * 0.7;
    // Prerequisite-path nodes (vSelected ~= 2.0) get a gentler lift so
    // the connected trail stays vivid against the dimmed background.
    float pathBoost = step(1.5, vSelected) * (1.0 - step(2.5, vSelected));
    lit += vColor * pathBoost * 0.25;

    // Anti-aliased silhouette so the sphere edge is smooth, not crusty.
    float aa = smoothstep(1.0, 0.86, r2);
    lit *= aa;

    // Milestone halo: a slow pulsing ring just outside the sphere, drawn
    // only for milestone nodes. Cheap visual cue for high-value nodes.
    if (vMilestone > 0.5 && r2 > 0.82) {
      float ring = smoothstep(0.82, 0.92, r2) * (1.0 - smoothstep(0.96, 1.25, sqrt(r2)));
      float pulse = 0.5 + 0.5 * sin(uTime * 1.8);
      lit += vColor * ring * (0.45 + 0.35 * pulse);
    }

    // Solid opaque spheres: dim by mixing toward the canvas background
    // color (keeps depth-write correctness, no alpha-blend clouding).
    vec3 bgColor = vec3(0.035, 0.043, 0.067); // matches #090b11
    vec3 finalColor = mix(bgColor, lit, vAlpha);
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const PARTICLE_VERTEX_SHADER = `
  uniform float uZoom;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);
    float size = aSize * (350.0 / dist) * uZoom;
    vSize = size;
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const PARTICLE_FRAGMENT_SHADER = `
  uniform float uGlobalAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
  void main() {
    vec2 pc = gl_PointCoord - vec2(0.5, 0.5);
    float dist = length(pc);
    if (dist > 0.5) {
      discard;
    }
    // Crisp, solid vector-style edges without cloudy fade
    gl_FragColor = vec4(vColor, vAlpha * uGlobalAlpha);
  }
`;
