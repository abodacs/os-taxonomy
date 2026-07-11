/**
 * Bottom-right overlay: a mono-font pill reminding users how to operate the
 * 3D graph. Decorative — the canvas itself carries an accessible text
 * alternative, and these controls are also documented in the sidebar.
 */
export function NavHint() {
  return (
    <div
      aria-hidden="true"
      className="text-[11px] text-slate-400 font-mono tracking-wide bg-slate-950/40 px-3 py-1.5 rounded-full border border-white/5 self-start md:self-auto backdrop-blur-xs"
    >
      Drag to spin | Scroll to zoom | Tap a dot
    </div>
  );
}
