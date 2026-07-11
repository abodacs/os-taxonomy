import { useMemo } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useExplorer } from "../../state/ExplorerContext";
import { topicsList } from "../../dataLoader";

const PANEL_ID = "sidebar-panel-standards";

/**
 * Standards tab — curriculum alignment index. Browse 7 curricula and their
 * standards, expand a standard to see mapped micro-topics, and select a
 * mapped topic to inspect it. All data flows through ExplorerContext (one
 * gateway); standardMappedTopics is computed locally since only this panel
 * needs it.
 */
export function StandardsPanel() {
  const {
    state: {
      selectedCurriculumSlug,
      standardsSearchTerm,
      expandedStandardKey,
    },
    actions: {
      selectCurriculum,
      setStandardsSearchTerm,
      setExpandedStandardKey,
      selectTopic,
    },
    derived: {
      curriculaList,
      activeCurriculum,
      filteredStandards,
    },
  } = useExplorer();

  const standardMappedTopics = useMemo(() => {
    if (!expandedStandardKey) return [];
    return topicsList.filter((t) => t.standards.includes(expandedStandardKey));
  }, [expandedStandardKey]);

  return (
    <div
      id={PANEL_ID}
      role="tabpanel"
      aria-labelledby="sidebar-tab-standards"
      tabIndex={0}
      className="space-y-4 focus-visible:outline-none"
    >
      {/* Standards config filter panel */}
      <div className="space-y-3 bg-[#02040a] p-3.5 rounded-xl border border-white/5">
        <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Curriculum Alignment Index
        </h4>

        {/* Select curriculum slug buttons */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select curriculum">
          {curriculaList.map((curr) => (
            <button
              key={curr.slug}
              onClick={() => selectCurriculum(curr.slug)}
              aria-pressed={selectedCurriculumSlug === curr.slug}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                selectedCurriculumSlug === curr.slug
                  ? "bg-white text-slate-950 border-white"
                  : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {curr.slug.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Standards search box */}
        <div className="relative">
          <label htmlFor="standards-search-input" className="sr-only">
            Search standard code or text
          </label>
          <Search
            className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="standards-search-input"
            type="text"
            placeholder="Search standard code or text..."
            value={standardsSearchTerm}
            onChange={(e) => setStandardsSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-white/10 rounded-lg text-xs placeholder:text-slate-500 text-white focus:outline-none focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

        {/* Brief Curriculum Summary info */}
        {activeCurriculum && (
          <div className="text-[11px] text-slate-400 border-t border-white/5 pt-2 flex flex-col gap-0.5 leading-snug">
            <span className="font-bold text-slate-200">
              {activeCurriculum.name}
            </span>
            <span>
              Organization: {activeCurriculum.organization} · Region:{" "}
              {activeCurriculum.region}
            </span>
            <span className="text-emerald-400 font-semibold font-mono">
              {activeCurriculum.topicCount} Codified Standards
            </span>
          </div>
        )}
      </div>

      {/* Standards scroll list */}
      <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 custom-scrollbar">
        {filteredStandards.length === 0 ? (
          <p className="text-center py-6 text-slate-400 italic">
            No standards found matching search.
          </p>
        ) : (
          filteredStandards.slice(0, 40).map((std) => {
            const isExpanded = expandedStandardKey === std.key;
            const title = std.data?.title || "Standard Description";
            const desc = std.data?.description || "";
            const panelId = `standard-panel-${std.key}`;

            return (
              <div
                key={std.key}
                className={`rounded-xl border bg-[#0d1222]/40 transition-all ${
                  isExpanded
                    ? "border-indigo-500/60 bg-[#121930]/40"
                    : "border-white/5"
                }`}
              >
                <button
                  onClick={() =>
                    setExpandedStandardKey(isExpanded ? null : std.key)
                  }
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="w-full text-left p-3 flex items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
                >
                  <div className="space-y-1">
                    <span className="font-mono text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {std.code}
                    </span>
                    <h5 className="font-semibold text-slate-200 text-xs leading-snug line-clamp-1 mt-1">
                      {title}
                    </h5>
                  </div>
                  <span className="shrink-0 pt-1 text-slate-400" aria-hidden="true">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>

                {isExpanded && (
                  <div
                    id={panelId}
                    className="px-3 pb-3 pt-1 border-t border-white/5 text-[11px] text-slate-300 space-y-3"
                  >
                    {desc && (
                      <p className="bg-slate-950 p-2.5 rounded border border-white/5 leading-relaxed font-serif italic text-slate-300">
                        &ldquo;{desc}&rdquo;
                      </p>
                    )}

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
                        Mapped Micro-Topics ({standardMappedTopics.length})
                      </span>
                      {standardMappedTopics.length === 0 ? (
                        <p className="text-slate-500 italic text-[11px]">
                          No direct concepts mapped.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5">
                          {standardMappedTopics.map((topic) => (
                            <button
                              key={topic.id}
                              onClick={() => selectTopic(topic)}
                              className="text-left p-2 rounded bg-slate-950 border border-white/5 hover:border-white/20 transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            >
                              <span className="font-semibold text-slate-200 truncate pr-2">
                                {topic.name}
                              </span>
                              <span className="font-mono text-[11px] text-rose-300 shrink-0 font-bold">
                                Age {topic.ageRangeStart}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {filteredStandards.length > 40 && (
          <p className="text-center text-[11px] text-slate-400 pt-2 font-mono">
            Showing first 40 standards. Narrow search.
          </p>
        )}
      </div>
    </div>
  );
}
