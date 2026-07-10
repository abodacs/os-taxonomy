import { useState, useMemo } from "react";
import { Topic } from "../types";
import { curriculaList, topicsList } from "../dataLoader";
import { Award, BookOpen, Search, ChevronDown, ChevronUp, MapPin } from "lucide-react";

interface StandardsBrowserProps {
  onSelectTopic: (topic: Topic) => void;
  activeTopicId: string | null;
}

export default function StandardsBrowser({ onSelectTopic, activeTopicId }: StandardsBrowserProps) {
  const [selectedCurriculumSlug, setSelectedCurriculumSlug] = useState(curriculaList[0]?.slug || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStandardKey, setSelectedStandardKey] = useState<string | null>(null);

  // Selected Curriculum
  const activeCurriculum = useMemo(() => {
    return curriculaList.find(c => c.slug === selectedCurriculumSlug);
  }, [selectedCurriculumSlug]);

  // Filtered standards
  const filteredStandards = useMemo(() => {
    if (!activeCurriculum) return [];
    return activeCurriculum.topics.filter(s => {
      const name = s.name || "";
      const desc = s.description || (s as any).data?.description || "";
      const matchText = `${s.code} ${name} ${desc}`.toLowerCase();
      return searchTerm.trim() === "" || matchText.includes(searchTerm.toLowerCase());
    });
  }, [activeCurriculum, searchTerm]);

  // Expand standard details and show matching micro-topics
  const handleToggleStandard = (key: string) => {
    setSelectedStandardKey(prev => (prev === key ? null : key));
  };

  // Find all micro-topics that reference this standard key
  const matchingTopicsForSelectedStandard = useMemo(() => {
    if (!selectedStandardKey) return [];
    return topicsList.filter(t => t.standards.includes(selectedStandardKey));
  }, [selectedStandardKey]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5" id="standards-browser">
      <div className="flex items-center gap-2.5 mb-2 border-b border-slate-100 pb-3">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
          <Award className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-slate-800 text-lg">Standards Alignment Index</h3>
          <p className="text-xs text-slate-500">
            Browse standards and find the exact micro-topics designed to teach them.
          </p>
        </div>
      </div>

      {/* Curriculum select and Search bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {curriculaList.map(curr => (
            <button
              key={curr.slug}
              onClick={() => {
                setSelectedCurriculumSlug(curr.slug);
                setSelectedStandardKey(null);
                setSearchTerm("");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedCurriculumSlug === curr.slug
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60"
              }`}
            >
              {curr.slug.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search standard code or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Curriculum Information Box */}
      {activeCurriculum && (
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-xs">
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-800 font-display text-sm leading-tight">
              {activeCurriculum.name}
            </h4>
            <p className="text-slate-500 font-medium leading-normal">
              {activeCurriculum.organization} · Version: {activeCurriculum.version}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] sm:shrink-0">
            <span className="flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded bg-white text-slate-500 border border-slate-100">
              <MapPin className="w-3 h-3 text-slate-400" /> {activeCurriculum.region}
            </span>
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
              {activeCurriculum.topicCount} Codified Standards
            </span>
          </div>
        </div>
      )}

      {/* Standards List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 border border-slate-100 rounded-2xl p-4 bg-slate-50/25">
        {filteredStandards.length === 0 ? (
          <p className="text-center py-8 text-xs text-slate-400 italic">No standards match your filter criteria.</p>
        ) : (
          filteredStandards.slice(0, 50).map((std) => {
            const isExpanded = selectedStandardKey === std.key;
            const title = std.name || (std as any).data?.title || "Standard description";
            const desc = std.description || (std as any).data?.description || "";
            const keyStage = (std as any).data?.keyStage || (std as any).data?.domain || "General Subject";

            return (
              <div
                key={std.key}
                className={`border rounded-xl bg-white overflow-hidden transition-all ${
                  isExpanded ? "border-indigo-200 ring-2 ring-indigo-50" : "border-slate-200/60 hover:border-slate-300"
                }`}
              >
                {/* Header row */}
                <div
                  onClick={() => handleToggleStandard(std.key)}
                  className="px-4 py-3 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/40">
                        {std.code}
                      </span>
                      {keyStage && (
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          {keyStage}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-700 line-clamp-1 mt-1.5">
                      {title}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded panel details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-600 space-y-4 pt-3">
                    {/* Verbatim description */}
                    {desc && (
                      <div className="space-y-1">
                        <p className="font-semibold text-[10px] uppercase tracking-wider text-slate-400">Verbatim Standard</p>
                        <p className="bg-white p-3 rounded-lg border border-slate-200/60 leading-relaxed text-slate-700">
                          {desc}
                        </p>
                      </div>
                    )}

                    {/* Matching Micro-topics */}
                    <div className="space-y-2.5">
                      <p className="font-bold text-[10px] uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Mapped Micro-Topics ({matchingTopicsForSelectedStandard.length})
                      </p>
                      {matchingTopicsForSelectedStandard.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px] pl-1">
                          No direct micro-topics mapped to this specific sub-code yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {matchingTopicsForSelectedStandard.map(topic => (
                            <button
                              key={topic.id}
                              onClick={() => onSelectTopic(topic)}
                              className={`text-left p-2.5 rounded-lg border text-xs bg-white cursor-pointer transition-all hover:border-indigo-300 hover:shadow-xs flex flex-col justify-between ${
                                activeTopicId === topic.id ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200/80"
                              }`}
                            >
                              <div className="flex items-start justify-between w-full mb-1">
                                <span className="font-mono text-[9px] font-bold text-slate-400">{topic.id}</span>
                                <span className="text-[9px] font-semibold text-indigo-500 bg-indigo-50 px-1 py-0.2 rounded font-mono">
                                  Y{topic.ageRangeStart}
                                </span>
                              </div>
                              <h5 className="font-display font-bold text-slate-850 line-clamp-1 leading-snug">
                                {topic.name}
                              </h5>
                              <p className="text-[10px] text-slate-500 line-clamp-1 truncate mt-0.5">{topic.subject}</p>
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
        {filteredStandards.length > 50 && (
          <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
            Showing first 50 results. Use the search box to refine your selection.
          </p>
        )}
      </div>
    </div>
  );
}
