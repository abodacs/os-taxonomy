import { Search } from "lucide-react";
import { useExplorer } from "../../state/ExplorerContext";

const PANEL_ID = "sidebar-panel-search";

/**
 * Catalog tab — search and filter all 1,590 micro-topics. Selecting a result
 * sets it as the active topic and switches to the Inspect tab.
 */
export function CatalogPanel() {
  const {
    state: {
      catalogSearchTerm,
      catalogSelectedSubject,
      catalogSelectedAge,
      activeTopic,
    },
    actions: {
      setCatalogSearchTerm,
      setCatalogSelectedSubject,
      setCatalogSelectedAge,
      selectTopic,
    },
    meta: { subjectColor, subjectNames },
    derived: { filteredCatalogTopics },
  } = useExplorer();

  return (
    <div
      id={PANEL_ID}
      role="tabpanel"
      aria-labelledby="sidebar-tab-search"
      tabIndex={0}
      className="space-y-4 focus-visible:outline-none"
    >
      {/* Filters */}
      <div className="space-y-2 bg-[#02040a] p-3 rounded-xl border border-white/5">
        <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Search Catalog
        </h4>

        {/* Text search */}
        <div className="relative">
          <label htmlFor="catalog-search-input" className="sr-only">
            Search micro-topics
          </label>
          <Search
            className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="catalog-search-input"
            type="text"
            placeholder="Search 1,590 micro-topics..."
            value={catalogSearchTerm}
            onChange={(e) => setCatalogSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs placeholder:text-slate-500 text-white focus:outline-none focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>

        {/* Select subject and age filters */}
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor="catalog-subject-select" className="sr-only">
            Filter by subject
          </label>
          <select
            id="catalog-subject-select"
            value={catalogSelectedSubject}
            onChange={(e) => setCatalogSelectedSubject(e.target.value)}
            className="bg-slate-900 border border-white/10 text-xs text-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          >
            <option value="">All Subjects</option>
            {subjectNames.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          <label htmlFor="catalog-age-select" className="sr-only">
            Filter by age
          </label>
          <select
            id="catalog-age-select"
            value={catalogSelectedAge}
            onChange={(e) =>
              setCatalogSelectedAge(e.target.value ? Number(e.target.value) : "")
            }
            className="bg-slate-900 border border-white/10 text-xs text-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
          >
            <option value="">All Ages</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((a) => (
              <option key={a} value={a}>
                Age {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List items */}
      <div className="space-y-1.5 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 custom-scrollbar">
        {filteredCatalogTopics.length === 0 ? (
          <p className="text-center py-6 text-slate-400 italic">
            No topics match your query.
          </p>
        ) : (
          filteredCatalogTopics.slice(0, 100).map((topic) => {
            const isSelected = activeTopic && activeTopic.id === topic.id;
            const color = subjectColor(topic.subject);
            return (
              <button
                key={topic.id}
                onClick={() => selectTopic(topic)}
                aria-pressed={!!isSelected}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  isSelected
                    ? "bg-slate-800/80 border-indigo-500 shadow-md ring-1 ring-indigo-500"
                    : "bg-[#0d1222]/50 border-white/5 hover:border-white/10 hover:bg-[#121930]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-mono text-slate-400">
                    {topic.id}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                    style={{
                      borderColor: `${color}30`,
                      color: color,
                      backgroundColor: `${color}10`,
                    }}
                  >
                    {topic.subject}
                  </span>
                </div>

                <h4 className="font-semibold text-slate-200 text-xs leading-snug line-clamp-1">
                  {topic.name}
                </h4>

                <p className="text-[11px] text-slate-400 line-clamp-1">
                  Age: {topic.ageRangeStart} · {topic.domain}
                </p>
              </button>
            );
          })
        )}

        {filteredCatalogTopics.length > 100 && (
          <p className="text-center text-[11px] text-slate-400 py-2">
            Showing first 100 of {filteredCatalogTopics.length} topics. Narrow
            down search.
          </p>
        )}
      </div>
    </div>
  );
}
