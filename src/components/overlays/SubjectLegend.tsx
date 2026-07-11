import { useExplorer } from "../../state/ExplorerContext";

/**
 * Bottom-left overlay: the subject legend. Each subject is a toggle button
 * that shows/hides that subject's nodes in the 3D graph. State is conveyed
 * via `aria-pressed` (not just visual opacity) for assistive tech.
 */
export function SubjectLegend() {
  const {
    state: { hiddenSubjects },
    actions: { toggleSubject },
    derived: { subjectStats },
  } = useExplorer();

  return (
    <div className="bg-[#070b19]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 max-w-sm w-full shadow-xl">
      <div className="flex items-center justify-between mb-2.5 border-b border-white/5 pb-1.5">
        <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
          Subjects — click to toggle
        </span>
        <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
          {subjectStats.length} Subjects
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {subjectStats.map((sub) => {
          const isHidden = hiddenSubjects.has(sub.name);
          return (
            <button
              key={sub.name}
              onClick={() => toggleSubject(sub.name)}
              aria-pressed={!isHidden}
              aria-label={`${sub.name}: ${sub.count} topics. ${
                isHidden ? "Currently hidden. Click to show." : "Currently shown. Click to hide."
              }`}
              className={`flex items-center justify-between p-1.5 rounded-lg border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isHidden
                  ? "bg-slate-950/20 border-white/5 opacity-40 hover:opacity-60"
                  : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: sub.color,
                    boxShadow: isHidden ? "none" : `0 0 6px ${sub.color}`,
                  }}
                />
                <span className="truncate font-medium text-[11px] text-slate-200">
                  {sub.name}
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 shrink-0 font-semibold pl-1">
                {sub.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
