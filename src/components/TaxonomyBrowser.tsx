import { useState, useMemo } from "react";
import { Topic } from "../types";
import { topicsList, clustersList, getDirectPrerequisites } from "../dataLoader";
import { Search, SlidersHorizontal, BookOpen, Layers, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface TaxonomyBrowserProps {
  onSelectTopic: (topic: Topic) => void;
  activeTopicId: string | null;
  selectedSubject: string;
  onSelectSubject: (subject: string) => void;
}

export default function TaxonomyBrowser({ 
  onSelectTopic, 
  activeTopicId, 
  selectedSubject, 
  onSelectSubject 
}: TaxonomyBrowserProps) {
  // Local state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedAge, setSelectedAge] = useState<number | "">("");
  const [currentPage, setCurrentPage] = useState(1);
  const [browserMode, setBrowserMode] = useState<"topics" | "clusters">("topics");

  const itemsPerPage = 12;

  // Color mapping based on subject
  const getSubjectColor = (subject: string) => {
    switch (subject) {
      case "Science": return { bg: "bg-emerald-50", border: "border-emerald-200 text-emerald-800", dot: "bg-emerald-500" };
      case "Mathematics": return { bg: "bg-blue-50", border: "border-blue-200 text-blue-800", dot: "bg-blue-500" };
      case "English": return { bg: "bg-indigo-50", border: "border-indigo-200 text-indigo-800", dot: "bg-indigo-500" };
      case "History": return { bg: "bg-amber-50", border: "border-amber-200 text-amber-800", dot: "bg-amber-500" };
      case "Personal & Social Development": return { bg: "bg-purple-50", border: "border-purple-200 text-purple-800", dot: "bg-purple-500" };
      case "Life Skills": return { bg: "bg-rose-50", border: "border-rose-200 text-rose-800", dot: "bg-rose-500" };
      case "Computing": return { bg: "bg-cyan-50", border: "border-cyan-200 text-cyan-800", dot: "bg-cyan-500" };
      default: return { bg: "bg-slate-50", border: "border-slate-200 text-slate-800", dot: "bg-slate-500" };
    }
  };

  // Get list of all unique subjects
  const subjects = useMemo(() => {
    const subs = new Set(topicsList.map(t => t.subject));
    return Array.from(subs).sort();
  }, []);

  // Get list of unique domains based on chosen subject
  const domains = useMemo(() => {
    const list = selectedSubject 
      ? topicsList.filter(t => t.subject === selectedSubject)
      : topicsList;
    const doms = new Set(list.map(t => t.domain));
    return Array.from(doms).sort();
  }, [selectedSubject]);

  // Handle subject change
  const handleSubjectChange = (subj: string) => {
    onSelectSubject(subj);
    setSelectedDomain(""); // reset domain
    setCurrentPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    onSelectSubject("");
    setSelectedDomain("");
    setSelectedAge("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // Filter topics
  const filteredTopics = useMemo(() => {
    return topicsList.filter(t => {
      const matchesSearch = 
        searchTerm.trim() === "" ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.standards.some(std => std.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesSubject = selectedSubject === "" || t.subject === selectedSubject;
      const matchesDomain = selectedDomain === "" || t.domain === selectedDomain;
      const matchesAge = selectedAge === "" || (selectedAge >= t.ageRangeStart && selectedAge <= t.ageRangeEnd);

      return matchesSearch && matchesSubject && matchesDomain && matchesAge;
    });
  }, [searchTerm, selectedSubject, selectedDomain, selectedAge]);

  // Filter clusters
  const filteredClusters = useMemo(() => {
    return clustersList.filter(c => {
      const matchesSearch = 
        searchTerm.trim() === "" ||
        c.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSubject = selectedSubject === "" || c.subject === selectedSubject;
      const matchesDomain = selectedDomain === "" || c.domain === selectedDomain;
      const matchesAge = selectedAge === "" || c.ageBand.includes(String(selectedAge));

      return matchesSearch && matchesSubject && matchesDomain && matchesAge;
    });
  }, [searchTerm, selectedSubject, selectedDomain, selectedAge]);

  // Paginated topics
  const paginatedTopics = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTopics.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTopics, currentPage]);

  // Paginated clusters
  const paginatedClusters = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredClusters.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredClusters, currentPage]);

  const totalPages = useMemo(() => {
    const listLength = browserMode === "topics" ? filteredTopics.length : filteredClusters.length;
    return Math.max(1, Math.ceil(listLength / itemsPerPage));
  }, [filteredTopics, filteredClusters, browserMode]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-5" id="taxonomy-browser">
      {/* Search and view toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Toggle between Topics and Clusters */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-max">
          <button
            onClick={() => { setBrowserMode("topics"); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              browserMode === "topics" 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Micro-Topics ({filteredTopics.length})</span>
          </button>
          <button
            onClick={() => { setBrowserMode("clusters"); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              browserMode === "clusters" 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Domain Clusters ({filteredClusters.length})</span>
          </button>
        </div>

        {/* Universal search bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              browserMode === "topics" 
                ? "Search name, standards, description..." 
                : "Search domain, description summaries..."
            }
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Filters section */}
      <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold mr-2">
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
        </div>

        {/* Subject Filter */}
        <div className="flex flex-col gap-1">
          <select
            value={selectedSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Subjects</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Domain Filter */}
        <div className="flex flex-col gap-1">
          <select
            value={selectedDomain}
            onChange={(e) => { setSelectedDomain(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[200px]"
          >
            <option value="">All Domains</option>
            {domains.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Age Filter */}
        <div className="flex flex-col gap-1">
          <select
            value={selectedAge}
            onChange={(e) => { setSelectedAge(e.target.value ? Number(e.target.value) : ""); setCurrentPage(1); }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Any Age (4-12)</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(age => (
              <option key={age} value={age}>Age {age}</option>
            ))}
          </select>
        </div>

        {/* Reset button */}
        {(selectedSubject !== "" || selectedDomain !== "" || selectedAge !== "" || searchTerm !== "") && (
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors ml-auto cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Main Grid View */}
      {browserMode === "topics" ? (
        paginatedTopics.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No matching topics found</p>
            <p className="text-xs mt-1">Try adjusting your filters or refining your search keywords.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedTopics.map((t) => {
              const colors = getSubjectColor(t.subject);
              const isActive = activeTopicId === t.id;
              const directPrereqs = getDirectPrerequisites(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTopic(t)}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
                    isActive 
                      ? "bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-50" 
                      : "bg-white border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div>
                    {/* Header elements */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${colors.border}`}>
                        {t.subject}
                      </span>
                      <span className="text-[10px] font-mono font-medium text-slate-400">
                        Age {t.ageRangeStart}-{t.ageRangeEnd}
                      </span>
                    </div>

                    <h4 className="font-display font-semibold text-slate-800 text-xs line-clamp-2 leading-snug group-hover:text-indigo-600">
                      {t.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {t.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-3 text-[10px]">
                    <span className="text-slate-400 font-medium">{t.domain}</span>
                    <div className="flex items-center gap-2">
                      {directPrereqs.length > 0 && (
                        <span className="font-mono text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.2 rounded">
                          {directPrereqs.length} prereq{directPrereqs.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {t.standards.length > 0 && (
                        <span className="font-mono text-indigo-500 font-semibold bg-indigo-50 px-1.5 py-0.2 rounded">
                          {t.standards.length} aligned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Clusters Mode View */
        paginatedClusters.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No matching clusters found</p>
            <p className="text-xs mt-1">Try resetting your filters or narrowing down subjects.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedClusters.map((c, i) => {
              const colors = getSubjectColor(c.subject);
              return (
                <div
                  key={i}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${colors.border}`}>
                        {c.subject}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        Age Band {c.ageBand}
                      </span>
                    </div>
                    <h4 className="font-display font-semibold text-slate-800 text-sm mb-2">
                      {c.domain}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      "{c.summary}"
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Parent-Friendly Guide
                    </span>
                    <button
                      onClick={() => {
                        // Clear specific filters and filter to this subject/domain
                        onSelectSubject(c.subject);
                        setSelectedDomain(c.domain);
                        setBrowserMode("topics");
                        setCurrentPage(1);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      View Micro-Topics →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Showing Page <span className="font-semibold text-slate-800">{currentPage}</span> of{" "}
            <span className="font-semibold text-slate-800">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
