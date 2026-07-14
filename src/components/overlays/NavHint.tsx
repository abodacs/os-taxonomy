/**
 * Bottom-right overlay: a mono-font pill reminding users how to operate the
 * 3D graph. Decorative — the canvas itself carries an accessible text
 * alternative, and these controls are also documented in the sidebar.
 */
export function NavHint() {
  return (
    <div
      aria-hidden="true"
      className="text-[10px] text-slate-500 font-mono tracking-wide bg-[#0b0e14]/60 px-3 py-1.5 rounded-full border border-white/5 self-start md:self-auto backdrop-blur-xs"
    >
      Drag to orbit · Scroll to zoom · Click a node to inspect
    </div>
  );
}
