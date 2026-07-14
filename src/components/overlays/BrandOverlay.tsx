/**
 * Top-left overlay: a minimalist serif wordmark with a single colored dot,
 * plus a thin tagline. Purely presentational — the "earns."-style aesthetic:
 * elegant serif, a single accent dot, no heavy container.
 */
export function BrandOverlay() {
  return (
    <div className="z-10 max-w-lg pointer-events-auto px-1 py-1">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: "#60a5fa" }}
          aria-hidden="true"
        />
        <span
          className="text-2xl text-slate-100 tracking-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          marble
        </span>
        <span className="text-[10px] tracking-widest text-slate-500 font-mono uppercase pl-1">
          US/UK · AGES 4–15
        </span>
      </div>

      <p
        className="text-slate-400 leading-snug mt-1.5 max-w-xs"
        style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "15px" }}
      >
        Everything a child learns — 1,590 concepts and 3,221 connections across 8 subjects.
      </p>
    </div>
  );
}
