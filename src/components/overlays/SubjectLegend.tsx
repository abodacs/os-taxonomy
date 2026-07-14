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
    <div className="bg-[#0b0e14]/70 backdrop-blur-md border border-white/8 rounded-xl p-4 max-w-sm w-full">
      <div className="flex items-center justify-between mb-2.5 border-b border-white/5 pb-1.5">
        <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">
          Subjects
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {subjectStats.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
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
              className={`flex items-center justify-between px-2 py-1.5 rounded-md border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isHidden
                  ? "bg-transparent border-white/5 opacity-40 hover:opacity-60"
                  : "bg-white/[0.03] border-white/8 hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: sub.color,
                  }}
                />
                <span className="truncate font-medium text-[11px] text-slate-300">
                  {sub.name}
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-500 shrink-0 pl-1">
                {sub.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
