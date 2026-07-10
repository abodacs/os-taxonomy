import { useState, useMemo, useEffect } from "react";
import { Topic } from "./types";
import { 
  topicsList, 
  topicsMap, 
  getTransitivePrerequisites, 
  curriculaList, 
  getClusterSummary 
} from "./dataLoader";
import ThreeDGraphCanvas, { SUBJECT_COLORS } from "./components/ThreeDGraphCanvas";
import { 
  Search, 
  Award, 
  Sparkles, 
  HelpCircle, 
  GraduationCap, 
  Compass, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  CheckSquare, 
  Square,
  Tag
} from "lucide-react";

export default function App() {
  // Selected concept for inspector. Default to 'mt_N8CpN1EJrP' (Building sentences)
  const defaultTopic = useMemo(() => {
    return topicsMap.get("mt_N8CpN1EJrP") || topicsList[0];
  }, []);

  const [activeTopic, setActiveTopic] = useState<Topic | null>(defaultTopic || null);
  
  // Hidden subjects for the 3D graph filtering
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());

  // HUD Sidebar current tab
  const [activeHudTab, setActiveHudTab] = useState<"inspect" | "search" | "standards" | "pathways">("inspect");

  // Auto-rotate toggle for the 3D graph (off by default for predictable reading)
  const [autoRotate, setAutoRotate] = useState(false);

  // Search & Catalog state
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [catalogSelectedSubject, setCatalogSelectedSubject] = useState("");
  const [catalogSelectedAge, setCatalogSelectedAge] = useState<number | "">("");

  // Standards tab state
  const [selectedCurriculumSlug, setSelectedCurriculumSlug] = useState(curriculaList[0]?.slug || "");
  const [standardsSearchTerm, setStandardsSearchTerm] = useState("");
  const [expandedStandardKey, setExpandedStandardKey] = useState<string | null>(null);

  // Evidence Checklist checked states
  const [checkedEvidence, setCheckedEvidence] = useState<Record<string, boolean>>({});

  // Assessment name customization
  const [childName, setChildName] = useState("Alex");

  // Reset checklist when topic changes
  useEffect(() => {
    setCheckedEvidence({});
  }, [activeTopic]);

  // Toggle subject visibility
  const handleToggleSubject = (subject: string) => {
    setHiddenSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  };

  // Select a topic and open the inspect tab
  const handleSelectTopic = (topic: Topic) => {
    setActiveTopic(topic);
    setActiveHudTab("inspect");
  };

  // Clear the active selection (used when clicking empty space in the 3D graph)
  const handleDeselectTopic = () => {
    setActiveTopic(null);
  };

  // Subject statistics for the legend
  const subjectStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const t of topicsList) {
      stats[t.subject] = (stats[t.subject] || 0) + 1;
    }
    return Object.entries(stats).map(([name, count]) => ({
      name,
      count,
      color: SUBJECT_COLORS[name] || "#cbd5e1"
    })).sort((a, b) => b.count - a.count);
  }, []);

  // Filtered topics for the Search/Catalog tab
  const filteredCatalogTopics = useMemo(() => {
    return topicsList.filter(t => {
      const matchesSearch = 
        catalogSearchTerm.trim() === "" ||
        t.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
        t.domain.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(catalogSearchTerm.toLowerCase());

      const matchesSubject = catalogSelectedSubject === "" || t.subject === catalogSelectedSubject;
      const matchesAge = catalogSelectedAge === "" || (t.ageRangeStart <= catalogSelectedAge && t.ageRangeEnd >= catalogSelectedAge);

      return matchesSearch && matchesSubject && matchesAge;
    });
  }, [catalogSearchTerm, catalogSelectedSubject, catalogSelectedAge]);

  // Get active curriculum
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
      return standardsSearchTerm.trim() === "" || matchText.includes(standardsSearchTerm.toLowerCase());
    });
  }, [activeCurriculum, standardsSearchTerm]);

  // Mapped topics for selected standard
  const standardMappedTopics = useMemo(() => {
    if (!expandedStandardKey) return [];
    return topicsList.filter(t => t.standards.includes(expandedStandardKey));
  }, [expandedStandardKey]);

  // Dynamic transitive pathway for the active topic
  const learningPathway = useMemo(() => {
    if (!activeTopic) return [];
    return getTransitivePrerequisites(activeTopic.id);
  }, [activeTopic]);

  // Cluster perspective for parent summary
  const parentCluster = useMemo(() => {
    if (!activeTopic) return null;
    return getClusterSummary(activeTopic.subject, activeTopic.domain, activeTopic.ageRangeStart);
  }, [activeTopic]);

  // Format assessment prompt with customized child name
  const formattedAssessmentPrompt = useMemo(() => {
    if (!activeTopic?.assessmentPrompt) return "";
    return activeTopic.assessmentPrompt.replace(/\{\{\s*name\s*\}\}/g, childName || "the learner");
  }, [activeTopic, childName]);

  return (
    <div className="min-h-screen bg-[#03060f] text-slate-100 flex flex-col font-sans relative overflow-hidden" id="app-root">
      {/* Background ambient radial glowing spots for visual luxury */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[150px] pointer-events-none" />

      {/* Main Grid: Left area for immersive 3D graph + overlays, Right area for the premium HUD Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative">
        
        {/* Left Side (Col-span-8): Immersive rotating 3D Canvas + Overlay Controls */}
        <div className="lg:col-span-8 h-[60vh] lg:h-screen relative flex flex-col justify-between p-4 md:p-6 border-b lg:border-b-0 lg:border-r border-white/5">
          
          {/* Top-Left Overlay Panel */}
          <div className="z-10 max-w-lg space-y-2 pointer-events-auto bg-[#03060f]/60 backdrop-blur-md p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2.5">
              <span className="font-display font-black tracking-widest text-2xl bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 bg-clip-text text-transparent">
                MARBLE
              </span>
              <span className="text-[10px] tracking-widest text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase">
                • US/UK CURRICULUM · AGES 4-15
              </span>
            </div>
            
            <h2 className="font-serif italic text-2xl md:text-3xl font-normal text-white leading-tight">
              "Everything a child learns."
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              1,590 concepts and 3,221 connections across 8 subjects, from Math and Science to Computing and Life Skills.
            </p>
            
            <p className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Tap any dot to see everything a learner must master before it.
            </p>
          </div>

          {/* Core Centerpiece: Interactive 3D Force-Directed-like Canvas */}
          <div className="absolute inset-0 z-0">
            <ThreeDGraphCanvas
              activeTopic={activeTopic}
              onSelectTopic={handleSelectTopic}
              onDeselectTopic={handleDeselectTopic}
              hiddenSubjects={hiddenSubjects}
              autoRotate={autoRotate}
              onToggleAutoRotate={() => setAutoRotate(v => !v)}
              onResetView={() => setAutoRotate(false)}
            />
          </div>

          {/* Bottom Overlays */}
          <div className="z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 mt-auto">
            
            {/* Bottom-Left Overlay: Interactive Legend Panel */}
            <div className="bg-[#070b19]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 max-w-sm w-full shadow-xl">
              <div className="flex items-center justify-between mb-2.5 border-b border-white/5 pb-1.5">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  SUBJECTS - CLICK TO TOGGLE
                </span>
                <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                  8 Subjects
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                {subjectStats.map(sub => {
                  const isHidden = hiddenSubjects.has(sub.name);
                  return (
                    <button
                      key={sub.name}
                      onClick={() => handleToggleSubject(sub.name)}
                      className={`flex items-center justify-between p-1.5 rounded-lg border text-left transition-all cursor-pointer ${
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
                            boxShadow: isHidden ? "none" : `0 0 6px ${sub.color}` 
                          }}
                        />
                        <span className="truncate font-medium text-[11px] text-slate-200">{sub.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0 font-semibold pl-1">
                        {sub.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom-Right Overlay: Navigation reminder */}
            <div className="text-[10px] text-slate-500 font-mono tracking-wide bg-slate-950/40 px-3 py-1.5 rounded-full border border-white/5 self-start md:self-auto backdrop-blur-xs">
              Drag to spin | Scroll to zoom | Tap a dot
            </div>

          </div>
        </div>

        {/* Right Side (Col-span-4): High-Contrast Premium HUD Sidebar Inspector */}
        <div className="lg:col-span-4 p-4 md:p-6 flex flex-col h-[calc(100vh-60vh)] lg:h-screen overflow-hidden bg-[#050914]/90 backdrop-blur-xl border-t lg:border-t-0 border-white/5">
          
          {/* Navigation tabs inside Inspector */}
          <div className="grid grid-cols-4 gap-1 bg-[#02040a] p-1 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => setActiveHudTab("inspect")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                activeHudTab === "inspect"
                  ? "bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="w-4 h-4 mb-1" />
              Inspect
            </button>
            <button
              onClick={() => setActiveHudTab("search")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                activeHudTab === "search"
                  ? "bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Search className="w-4 h-4 mb-1" />
              Catalog
            </button>
            <button
              onClick={() => setActiveHudTab("standards")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                activeHudTab === "standards"
                  ? "bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Award className="w-4 h-4 mb-1" />
              Standards
            </button>
            <button
              onClick={() => setActiveHudTab("pathways")}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                activeHudTab === "pathways"
                  ? "bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GraduationCap className="w-4 h-4 mb-1" />
              Pathway
            </button>
          </div>

          {/* Divider line */}
          <div className="h-px bg-white/5 my-4 shrink-0" />

          {/* Active Tab Panel Body - scrollable */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
            
            {/* TAB 1: INSPECTOR DETAILS */}
            {activeHudTab === "inspect" && (
              activeTopic ? (
                <div className="space-y-4">
                  
                  {/* Top Subject/Name pill */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border"
                        style={{ 
                          borderColor: `${SUBJECT_COLORS[activeTopic.subject]}30`,
                          color: SUBJECT_COLORS[activeTopic.subject],
                          backgroundColor: `${SUBJECT_COLORS[activeTopic.subject]}10` 
                        }}
                      >
                        {activeTopic.subject}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                        {activeTopic.domain}
                      </span>
                    </div>

                    <h3 className="font-display font-extrabold text-white text-lg md:text-xl leading-snug">
                      {activeTopic.name}
                    </h3>

                    <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
                      <span>Age: <strong className="text-rose-300 font-semibold">{activeTopic.ageRangeStart}-{activeTopic.ageRangeEnd}</strong></span>
                      <span>·</span>
                      <span>ID: <strong className="text-indigo-300">{activeTopic.id}</strong></span>
                    </div>
                  </div>

                  {/* Concept Description */}
                  <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 space-y-1.5">
                    <h4 className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">
                      Skill Description
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {activeTopic.description}
                    </p>
                  </div>

                  {/* Parent perspective summary */}
                  {parentCluster && (
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3.5 space-y-1.5">
                      <h4 className="text-[9px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Parent Context Summary
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed font-normal">
                        {parentCluster.summary}
                      </p>
                    </div>
                  )}

                  {/* Mastery Criteria Evidence Checklist */}
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Evidence required for mastery
                    </h4>
                    
                    <div className="space-y-1.5">
                      {activeTopic.evidence.map((ev, i) => {
                        const isChecked = !!checkedEvidence[i];
                        return (
                          <button
                            key={i}
                            onClick={() => setCheckedEvidence(prev => ({ ...prev, [i]: !prev[i] }))}
                            className="w-full text-left flex items-start gap-2.5 bg-[#0d1222]/80 border border-white/5 p-2.5 rounded-xl transition-all hover:bg-[#121930] hover:border-white/10"
                          >
                            <span className="shrink-0 mt-0.5 text-slate-400">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-500" />
                              )}
                            </span>
                            <span className={`text-[11px] leading-relaxed transition-colors ${isChecked ? "text-slate-400 line-through" : "text-slate-200 font-medium"}`}>
                              {ev}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Assessment Prompt */}
                  {activeTopic.assessmentPrompt && (
                    <div className="bg-slate-950 border border-white/5 rounded-xl p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-[9px] font-bold text-pink-400 tracking-wider uppercase flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" /> Quick Assessment Check
                        </h4>
                        
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-slate-500 font-mono">CHILD NAME:</span>
                          <input
                            type="text"
                            value={childName}
                            onChange={(e) => setChildName(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded px-1 py-0.5 w-16 text-white font-bold text-[10px] focus:outline-none focus:border-pink-500 transition-colors"
                            placeholder="Alex"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed font-serif italic bg-white/5 p-3 rounded-lg border border-white/5">
                        "{formattedAssessmentPrompt}"
                      </p>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <HelpCircle className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p>Select a concept on the 3D graph to inspect its details, mastery criteria, and assessment steps.</p>
                </div>
              )
            )}

            {/* TAB 2: SEARCH & CATALOG */}
            {activeHudTab === "search" && (
              <div className="space-y-4">
                
                {/* Filters */}
                <div className="space-y-2 bg-[#02040a] p-3 rounded-xl border border-white/5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Catalog</h4>
                  
                  {/* Text search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search 1,590 micro-topics..."
                      value={catalogSearchTerm}
                      onChange={(e) => setCatalogSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs placeholder:text-slate-500 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Select subject and age filters */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={catalogSelectedSubject}
                      onChange={(e) => setCatalogSelectedSubject(e.target.value)}
                      className="bg-slate-900 border border-white/10 text-xs text-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">All Subjects</option>
                      {Object.keys(SUBJECT_COLORS).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>

                    <select
                      value={catalogSelectedAge}
                      onChange={(e) => setCatalogSelectedAge(e.target.value ? Number(e.target.value) : "")}
                      className="bg-slate-900 border border-white/10 text-xs text-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">All Ages</option>
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(a => (
                        <option key={a} value={a}>Age {a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* List items */}
                <div className="space-y-1.5 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                  {filteredCatalogTopics.length === 0 ? (
                    <p className="text-center py-6 text-slate-500 italic">No topics match your query.</p>
                  ) : (
                    filteredCatalogTopics.slice(0, 100).map(topic => {
                      const isSelected = activeTopic && activeTopic.id === topic.id;
                      const color = SUBJECT_COLORS[topic.subject] || "#94a3b8";
                      return (
                        <button
                          key={topic.id}
                          onClick={() => handleSelectTopic(topic)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
                            isSelected 
                              ? "bg-slate-800/80 border-indigo-500 shadow-md ring-1 ring-indigo-500" 
                              : "bg-[#0d1222]/50 border-white/5 hover:border-white/10 hover:bg-[#121930]"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[8px] font-mono text-slate-500">{topic.id}</span>
                            <span 
                              className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border"
                              style={{ 
                                borderColor: `${color}30`,
                                color: color,
                                backgroundColor: `${color}10` 
                              }}
                            >
                              {topic.subject}
                            </span>
                          </div>
                          
                          <h4 className="font-semibold text-slate-200 text-xs leading-snug line-clamp-1">
                            {topic.name}
                          </h4>

                          <p className="text-[10px] text-slate-400 line-clamp-1">
                            Age: {topic.ageRangeStart} · {topic.domain}
                          </p>
                        </button>
                      );
                    })
                  )}

                  {filteredCatalogTopics.length > 100 && (
                    <p className="text-center text-[10px] text-slate-500 py-2">
                      Showing first 100 of {filteredCatalogTopics.length} topics. Narrow down search.
                    </p>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: STANDARDS ALIGNMENT INDEX */}
            {activeHudTab === "standards" && (
              <div className="space-y-4">
                
                {/* Standards config filter panel */}
                <div className="space-y-3 bg-[#02040a] p-3.5 rounded-xl border border-white/5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Curriculum Alignment Index</h4>
                  
                  {/* Select curriculum slug buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {curriculaList.map(curr => (
                      <button
                        key={curr.slug}
                        onClick={() => {
                          setSelectedCurriculumSlug(curr.slug);
                          setExpandedStandardKey(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
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
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search standard code or text..."
                      value={standardsSearchTerm}
                      onChange={(e) => setStandardsSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-white/10 rounded-lg text-xs placeholder:text-slate-500 text-white focus:outline-none"
                    />
                  </div>

                  {/* Brief Curriculum Summary info */}
                  {activeCurriculum && (
                    <div className="text-[10px] text-slate-400 border-t border-white/5 pt-2 flex flex-col gap-0.5 leading-snug">
                      <span className="font-bold text-slate-200">{activeCurriculum.name}</span>
                      <span>Organization: {activeCurriculum.organization} · Region: {activeCurriculum.region}</span>
                      <span className="text-emerald-400 font-semibold font-mono">{activeCurriculum.topicCount} Codified Standards</span>
                    </div>
                  )}
                </div>

                {/* Standards scroll list */}
                <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                  {filteredStandards.length === 0 ? (
                    <p className="text-center py-6 text-slate-500 italic">No standards found matching search.</p>
                  ) : (
                    filteredStandards.slice(0, 40).map(std => {
                      const isExpanded = expandedStandardKey === std.key;
                      const title = std.name || "Standard Description";
                      const desc = std.description || "";
                      
                      return (
                        <div 
                          key={std.key}
                          className={`rounded-xl border bg-[#0d1222]/40 transition-all ${
                            isExpanded ? "border-indigo-500/60 bg-[#121930]/40" : "border-white/5"
                          }`}
                        >
                          <button
                            onClick={() => setExpandedStandardKey(isExpanded ? null : std.key)}
                            className="w-full text-left p-3 flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <span className="font-mono text-[9px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                {std.code}
                              </span>
                              <h5 className="font-semibold text-slate-200 text-xs leading-snug line-clamp-1 mt-1">
                                {title}
                              </h5>
                            </div>
                            <span className="shrink-0 pt-1 text-slate-400">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-white/5 text-[11px] text-slate-300 space-y-3">
                              {desc && (
                                <p className="bg-slate-950 p-2.5 rounded border border-white/5 leading-relaxed font-serif italic text-slate-300">
                                  "{desc}"
                                </p>
                              )}

                              <div className="space-y-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 block">
                                  Mapped Micro-Topics ({standardMappedTopics.length})
                                </span>
                                {standardMappedTopics.length === 0 ? (
                                  <p className="text-slate-500 italic text-[10px]">No direct concepts mapped.</p>
                                ) : (
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {standardMappedTopics.map(topic => (
                                      <button
                                        key={topic.id}
                                        onClick={() => handleSelectTopic(topic)}
                                        className="text-left p-2 rounded bg-slate-950 border border-white/5 hover:border-white/20 transition-all flex items-center justify-between"
                                      >
                                        <span className="font-semibold text-slate-200 truncate pr-2">{topic.name}</span>
                                        <span className="font-mono text-[9px] text-rose-300 shrink-0 font-bold">Age {topic.ageRangeStart}</span>
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
                    <p className="text-center text-[10px] text-slate-500 pt-2 font-mono">
                      Showing first 40 standards. Narrow search.
                    </p>
                  )}
                </div>

              </div>
            )}

            {/* TAB 4: PREREQUISITE SEQUENTIAL PATHWAY */}
            {activeHudTab === "pathways" && (
              <div className="space-y-4">
                
                {activeTopic ? (
                  <div className="space-y-3">
                    
                    {/* Header context card */}
                    <div className="bg-[#02040a] p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">LEARNING PATHWAY FOR</span>
                      <h4 className="font-bold text-white text-xs">{activeTopic.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                        Trace back bottom-up to build prerequisite knowledge. Solve dependencies sequentially:
                      </p>
                    </div>

                    {/* Step by step linear timeline */}
                    <div className="relative border-l border-white/10 ml-3.5 pl-4 space-y-4 py-2">
                      
                      {learningPathway.length === 0 ? (
                        <div className="text-slate-500 text-[11px] leading-relaxed italic pl-1">
                          No prerequisites detected. This represents an absolute fundamental starting concept!
                        </div>
                      ) : (
                        learningPathway.map(({ topic, distance }, idx) => {
                          const isCurrent = activeTopic && activeTopic.id === topic.id;
                          const subjectColor = SUBJECT_COLORS[topic.subject] || "#94a3b8";
                          return (
                            <div key={topic.id} className="relative">
                              
                              {/* Step circle */}
                              <span 
                                className="absolute -left-[24.5px] top-0 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-mono text-white font-bold transition-all"
                                style={{ 
                                  backgroundColor: isCurrent ? "#ffffff" : "#050914",
                                  borderColor: subjectColor,
                                  boxShadow: `0 0 5px ${subjectColor}`
                                }}
                              >
                                {learningPathway.length - idx}
                              </span>

                              {/* Skill details box */}
                              <button
                                onClick={() => handleSelectTopic(topic)}
                                className="w-full text-left p-2.5 rounded-xl border bg-slate-900/40 border-white/5 hover:bg-slate-900/80 hover:border-white/10 transition-all flex flex-col gap-0.5"
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-mono text-[8px] text-slate-500">Distance: -{distance} levels</span>
                                  <span className="text-[8px] font-bold text-rose-300 font-mono">Age {topic.ageRangeStart}</span>
                                </div>
                                <span className="font-semibold text-slate-200 text-xs leading-snug line-clamp-1">
                                  {topic.name}
                                </span>
                                <span className="text-[9px] text-slate-500 line-clamp-1 truncate">
                                  {topic.subject} · {topic.domain}
                                </span>
                              </button>

                            </div>
                          );
                        })
                      )}

                      {/* Final destination node */}
                      <div className="relative">
                        <span 
                          className="absolute -left-[24.5px] top-0 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                        >
                          ★
                        </span>
                        
                        <div className="p-2.5 rounded-xl border border-white/10 bg-indigo-500/10 text-left flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-400">TARGET CONCEPT</span>
                            <span className="text-[8px] font-bold text-rose-300 font-mono">Age {activeTopic.ageRangeStart}</span>
                          </div>
                          <span className="font-bold text-indigo-200 text-xs line-clamp-1">
                            {activeTopic.name}
                          </span>
                        </div>
                      </div>

                    </div>

                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-12">Select a topic to generate learning pathways.</p>
                )}

              </div>
            )}

          </div>

          {/* Sidebar Footer Credit */}
          <div className="border-t border-white/5 pt-3.5 mt-4 text-[9px] text-slate-500 leading-normal font-mono shrink-0">
            <p className="truncate">Marble Skill Taxonomy v1 · Open License</p>
            <p className="truncate">Licensed under ODbL 1.0 & CC BY-SA 4.0</p>
          </div>

        </div>

      </div>
    </div>
  );
}
