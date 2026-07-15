import { useExplorer } from "../../state/ExplorerContext";
import { SUBJECT_COLORS } from "../../theme/subjectColors";

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

  const statsBySubject = new Map(subjectStats.map((subject) => [subject.name, subject]));
  const orderedStats = Object.keys(SUBJECT_COLORS)
    .map((name) => statsBySubject.get(name))
    .filter((subject): subject is (typeof subjectStats)[number] => Boolean(subject));

  return (
    <div className="bg-[#0b0e14]/82 border border-white/10 rounded-2xl p-4 md:w-[476px] max-w-full">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase">
          Subjects · click to toggle
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {isolatedSubject ? "isolated" : `${subjectStats.length}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {orderedStats.map((sub) => {
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
              className={`flex items-center justify-between px-2 py-1 rounded-md text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isSoloed
                  ? "bg-white/[0.07]"
                  : "opacity-75 hover:bg-white/[0.04] hover:opacity-100"
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: sub.color,
                    // Dim the dot for non-isolated subjects so the isolated
                    // one reads as the active selection against a quiet field.
                    opacity: isSoloed || !isolatedSubject ? 1 : 0.5,
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
