// GLSL shaders for the 3D graph. Pure strings — no React, no Three.js types.
// Extracted from ThreeDGraphCanvas so the shader code is navigable and
// diffable without scrolling through 1800 lines of component logic.
//
// Point sprites are sized in CSS pixels here and scaled to device pixels via
// the uPixelRatio uniform (kept in sync with renderer.getPixelRatio() by the
// canvas component), so discs keep their on-screen size and hierarchy across
// 1x/2x DPR displays and browser zoom levels.

export const POINTS_VERTEX_SHADER = `
  uniform float uPixelRatio;

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

    // Perspective-scaled sprites keep the specimen readable without turning
    // every node into the same screen-space circle.
    float size = aSize * (640.0 / max(dist, 1.0));

    if (aSize > 0.0 && aAlpha > 0.01) {
      // Clamp in CSS pixels, then scale to framebuffer pixels: gl_PointSize
      // is in device pixels, so without the ratio a 2x DPR screen (or 200%
      // browser zoom) would render every disc half its intended size.
      size = clamp(size, 3.0, 20.0) * uPixelRatio;
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
  varying float vSize;

  void main() {
    // Map point-sprite coords to [-1, 1] so the disc is a unit circle.
    vec2 pc = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pc, pc);
    if (r2 > 1.0) {
      discard;
    }

    // Antialiasing scaled to physical pixels: vSize is the sprite's
    // device-pixel diameter, so the disc radius is vSize * 0.5 device px and
    // one device pixel spans 2.0 / vSize in disc units. A fixed ~1px band is
    // invisible on large discs yet fully smooths the smallest ones, at any
    // zoom level or devicePixelRatio.
    float aaBand = 2.0 / max(vSize, 1.0);
    float alpha = 1.0 - smoothstep(1.0 - aaBand, 1.0, sqrt(r2));

    // Flat solid fill — no glow core, no halo. Selection is conveyed by the
    // ring outline + size lift, not by shader brightness.
    gl_FragColor = vec4(vColor, alpha * vAlpha);

    // aColor arrives in Three's linear-sRGB working space; encode to the
    // renderer's output space so discs match the DOM's subject palette
    // instead of reading darker and muddier than their hex values.
    #include <colorspace_fragment>
  }
`;
