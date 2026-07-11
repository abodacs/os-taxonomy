import { useMemo } from "react";
import { useExplorer } from "../../state/ExplorerContext";
import { getTransitivePrerequisites } from "../../dataLoader";

const PANEL_ID = "sidebar-panel-pathways";

/**
 * Pathway tab — a vertical timeline of the active topic's transitive
 * prerequisite chain, ending in the target concept. Selecting a step
 * re-targets the pathway to that topic. The pathway derivation is local to
 * this panel — it's only needed here, so the provider doesn't carry it.
 */
export function PathwayPanel() {
  const {
    state: { activeTopic },
    actions: { selectTopic },
    meta: { subjectColor },
  } = useExplorer();

  const learningPathway = useMemo(() => {
    if (!activeTopic) return [];
    return getTransitivePrerequisites(activeTopic.id);
  }, [activeTopic]);

  return (
    <div
      id={PANEL_ID}
      role="tabpanel"
      aria-labelledby="sidebar-tab-pathways"
      tabIndex={0}
      className="space-y-4 focus-visible:outline-none"
    >
      {activeTopic ? (
        <div className="space-y-3">
          {/* Header context card */}
          <div className="bg-[#02040a] p-3 rounded-xl border border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase block mb-0.5">
              Learning pathway for
            </span>
            <h4 className="font-bold text-white text-xs">{activeTopic.name}</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Trace back bottom-up to build prerequisite knowledge. Solve
              dependencies sequentially:
            </p>
          </div>

          {/* Step by step linear timeline */}
          <div
            className="relative border-l border-white/10 ml-3.5 pl-4 space-y-4 py-2"
            role="list"
          >
            {learningPathway.length === 0 ? (
              <div className="text-slate-400 text-[11px] leading-relaxed italic pl-1">
                No prerequisites detected. This represents an absolute
                fundamental starting concept!
              </div>
            ) : (
              learningPathway.map(({ topic, distance }, idx) => {
                const isCurrent =
                  activeTopic && activeTopic.id === topic.id;
                const subjectColorValue = subjectColor(topic.subject);
                return (
                  <div key={topic.id} className="relative" role="listitem">
                    {/* Step circle */}
                    <span
                      className="absolute -left-[24.5px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-mono text-white font-bold transition-all"
                      style={{
                        backgroundColor: isCurrent ? "#ffffff" : "#050914",
                        borderColor: subjectColorValue,
                        boxShadow: `0 0 5px ${subjectColorValue}`,
                      }}
                      aria-hidden="true"
                    >
                      {learningPathway.length - idx}
                    </span>

                    {/* Skill details box */}
                    <button
                      onClick={() => selectTopic(topic)}
                      aria-pressed={isCurrent}
                      className="w-full text-left p-2.5 rounded-xl border bg-slate-900/40 border-white/5 hover:bg-slate-900/80 hover:border-white/10 transition-all flex flex-col gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono text-[11px] text-slate-400">
                          Distance: -{distance} levels
                        </span>
                        <span className="text-[11px] font-bold text-rose-300 font-mono">
                          Age {topic.ageRangeStart}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-200 text-xs leading-snug line-clamp-1">
                        {topic.name}
                      </span>
                      <span className="text-[11px] text-slate-400 line-clamp-1 truncate">
                        {topic.subject} · {topic.domain}
                      </span>
                    </button>
                  </div>
                );
              })
            )}

            {/* Final destination node */}
            <div className="relative" role="listitem">
              <span
                className="absolute -left-[24.5px] top-0 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                aria-hidden="true"
              >
                ★
              </span>

              <div className="p-2.5 rounded-xl border border-white/10 bg-indigo-500/10 text-left flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                    Target concept
                  </span>
                  <span className="text-[11px] font-bold text-rose-300 font-mono">
                    Age {activeTopic.ageRangeStart}
                  </span>
                </div>
                <span className="font-bold text-indigo-200 text-xs line-clamp-1">
                  {activeTopic.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-400 py-12">
          Select a topic to generate learning pathways.
        </p>
      )}
    </div>
  );
}
