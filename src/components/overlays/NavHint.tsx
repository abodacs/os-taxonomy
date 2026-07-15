/**
 * Bottom-right overlay: a mono-font pill reminding users how to operate the
 * 3D graph. Decorative — the canvas itself carries an accessible text
 * alternative, and these controls are also documented in the sidebar.
 */
export function NavHint() {
  return (
    <div
      aria-hidden="true"
      className="hidden sm:block text-[10px] text-slate-500 font-mono tracking-wide self-start md:self-auto"
    >
      Drag to spin · Right-drag to pan · Scroll to zoom · Tap a dot · Double-click to reset
    </div>
  );
}
