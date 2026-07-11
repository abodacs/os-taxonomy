// Subject color palette — the single source of truth for subject colors.
// Shared by the 3D canvas (node shading, edges, selection halo) and the
// React sidebar/overlays (pills, legend dots, pathway markers).
//
// Vibrant neon/pastel HUD palette designed to pop on the dark canvas.
export const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "#00f0ff", // Cyber Neon Cyan
  Science: "#39ff14", // Electric Neon Green
  English: "#ff007f", // Vibrant Hot Pink
  History: "#ff9e00", // Vivid Neon Amber/Orange
  "Personal & Social Development": "#cc00ff", // Intense Laser Purple
  Computing: "#00ffd0", // Electric Turquoise/Teal
  "Life Skills": "#ffe600", // Intense Cyber Yellow
  "Learning to Learn": "#6366f1", // Luminous Indigo
};

// Fallback color for any subject not in the palette.
export const SUBJECT_COLOR_FALLBACK = "#94a3b8";

/**
 * Look up a subject's color, falling back to SUBJECT_COLOR_FALLBACK for unknown
 * subjects. This is the single source of the `|| FALLBACK` idiom — every
 * consumer (3D canvas, React sidebar, overlays) should call this instead of
 * indexing SUBJECT_COLORS directly, so the fallback never diverges.
 */
export function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || SUBJECT_COLOR_FALLBACK;
}
