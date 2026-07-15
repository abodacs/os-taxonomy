// Subject color palette — the single source of truth for subject colors.
// Shared by the 3D canvas (node shading, edges, selection halo) and the React
// sidebar/overlays (pills, legend dots, pathway markers).
//
// Professional diverging palette: muted blues (foundational/cold) → sky blue
// (active mid) → off-white/cream (primary highlights) → muted rose/coral
// (specialized/warm paths). Replaces the previous neon HUD palette for a
// minimalist, self-illuminated vector-network aesthetic.
export const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "#60a5fa", // Sky blue (active mid)
  Science: "#1d4ed8", // Deep blue (cold/foundational)
  English: "#fb7185", // Muted rose (warm)
  History: "#fef3c7", // Cream (primary highlight)
  "Personal & Social Development": "#ef4444", // Coral red (warm/specialized)
  Computing: "#2563eb", // Royal blue
  "Life Skills": "#f8fafc", // Off-white (primary highlight)
  "Learning to Learn": "#93c5fd", // Pale sky blue
};

// Fallback color for any subject not in the palette.
export const SUBJECT_COLOR_FALLBACK = "#94a3b8";

// State-based palette for selection visualization (not subject-bound).
// Used by the 3D canvas to color nodes/edges by their role in the selected
// prerequisite + sequel sub-DAG.
export const STATE_COLORS = {
  dimmed: "#1e293b", // Unrelated nodes (dark slate blue)
  branch: "#60a5fa", // Active prerequisite/sequel path (sky blue)
  primary: "#f8fafc", // Selected node / primary focus (off-white)
  terminal: "#fb7185", // Deepest terminal branches (muted rose)
} as const;

/**
 * Look up a subject's color, falling back to SUBJECT_COLOR_FALLBACK for unknown
 * subjects. This is the single source of the `|| FALLBACK` idiom — every
 * consumer (3D canvas, React sidebar, overlays) should call this instead of
 * indexing SUBJECT_COLORS directly, so the fallback never diverges.
 */
export function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || SUBJECT_COLOR_FALLBACK;
}
