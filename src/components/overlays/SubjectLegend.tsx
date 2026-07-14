import { useExplorer } from "../../state/ExplorerContext";

/**
 * Bottom-left overlay: the subject legend. Each subject is a toggle button
 * that, when clicked, ISOLATES that subject in the 3D graph — only its nodes
 * and the edges between them remain visible. Clicking the already-isolated
 * subject restores all subjects. State is conveyed via `aria-pressed` (not
 * just visual styling) for assistive tech.
 */
export function SubjectLegend() {
  const {
    state: { isolatedSubject },
    actions: { soloSubject },
    derived: { subjectStats },
  } = useExplorer();

  return (
    <div className="bg-[#0b0e14]/70 backdrop-blur-md border border-white/8 rounded-xl p-4 max-w-sm w-full">
      <div className="flex items-center justify-between mb-2.5 border-b border-white/5 pb-1.5">
        <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">
          Subjects
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {isolatedSubject ? "isolated" : `${subjectStats.length}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {subjectStats.map((sub) => {
          const isSoloed = isolatedSubject === sub.name;
          return (
            <button
              key={sub.name}
              onClick={() => soloSubject(sub.name)}
              aria-pressed={isSoloed}
              aria-label={`${sub.name}: ${sub.count} topics. ${
                isSoloed
                  ? "Currently isolated. Click to show all subjects."
                  : "Click to isolate this subject."
              }`}
              className={`flex items-center justify-between px-2 py-1.5 rounded-md border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isSoloed
                  ? "bg-white/[0.06] border-white/25"
                  : "bg-white/[0.03] border-white/8 opacity-70 hover:opacity-100 hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: sub.color,
                    // Dim the dot for non-isolated subjects so the isolated
                    // one reads as the active selection against a quiet field.
                    opacity: isSoloed ? 1 : 0.5,
                  }}
                />
                <span
                  className={`truncate font-medium text-[11px] ${
                    isSoloed ? "text-slate-100" : "text-slate-300"
                  }`}
                >
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
