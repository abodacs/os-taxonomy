import { useState, useMemo } from "react";
import { Topic } from "../types";
import { standardsMap, getClusterSummary } from "../dataLoader";
import { CheckCircle2, Award, ClipboardCheck, Sparkles, ChevronDown, ChevronUp, Network, Map } from "lucide-react";

interface TopicDetailsProps {
  topic: Topic;
  onPivotView: (tab: "graph" | "pathway") => void;
}

export default function TopicDetails({ topic, onPivotView }: TopicDetailsProps) {
  const [childName, setChildName] = useState("Alex");
  const [expandedStandards, setExpandedStandards] = useState<Record<string, boolean>>({});

  // Fetch cluster summary for parent context
  const cluster = useMemo(() => {
    return getClusterSummary(topic.subject, topic.domain, topic.ageRangeStart);
  }, [topic.subject, topic.domain, topic.ageRangeStart]);

  // Expand standard detail
  const toggleStandard = (key: string) => {
    setExpandedStandards(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Substitute name placeholder in assessment prompt
  const formattedPrompt = useMemo(() => {
    if (!topic.assessmentPrompt) return "";
    return topic.assessmentPrompt.replace(/\{\{\s*name\s*\}\}/g, childName || "your child");
  }, [topic.assessmentPrompt, childName]);

  // Retrieve matching standard details
  const matchedStandards = useMemo(() => {
    return topic.standards.map(key => {
      const match = standardsMap.get(key);
      if (match) {
        return {
          key,
          code: match.standard.code,
          name: match.standard.name,
          description: match.standard.description || (match.standard as any).data?.description,
          curriculum: match.curriculum.name,
          region: match.curriculum.region,
          found: true,
        };
      }
      return {
        key,
        code: key.split(":")[1] || key,
        name: "Standard detail unavailable",
        description: "Verify code details against your curriculum index.",
        curriculum: key.split(":")[0]?.toUpperCase() || "Unknown Curriculum",
        region: "",
        found: false,
      };
    });
  }, [topic.standards]);

  const getSubjectAccent = (subject: string) => {
    switch (subject) {
      case "Science": return "border-emerald-500 text-emerald-600 bg-emerald-50";
      case "Mathematics": return "border-blue-500 text-blue-600 bg-blue-50";
      case "English": return "border-indigo-500 text-indigo-600 bg-indigo-50";
      case "History": return "border-amber-500 text-amber-600 bg-amber-50";
      case "Personal & Social Development": return "border-purple-500 text-purple-600 bg-purple-50";
      case "Life Skills": return "border-rose-500 text-rose-600 bg-rose-50";
      case "Computing": return "border-cyan-500 text-cyan-600 bg-cyan-50";
      default: return "border-slate-500 text-slate-600 bg-slate-50";
    }
  };

  const accent = getSubjectAccent(topic.subject);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6" id="topic-details">
      {/* Header section */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${accent}`}>
              {topic.subject}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {topic.domain}
            </span>
          </div>
          <h3 className="font-display font-bold text-slate-800 text-xl leading-snug">
            {topic.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            ID: {topic.id} {topic.centrality && `· Node Centrality: ${topic.centrality.toFixed(3)}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-display font-bold px-3 py-1 bg-slate-100 rounded-xl text-slate-700 border border-slate-200/40">
            Suggested Age: {topic.ageRangeStart} - {topic.ageRangeEnd}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {topic.type} Skill
          </span>
        </div>
      </div>

      {/* Description & Parents cluster summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Concept Description
          </h4>
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            {topic.description}
          </p>
        </div>

        {cluster && (
          <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-4 space-y-2">
            <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Parent Perspective
            </h4>
            <p className="text-xs text-amber-900 leading-relaxed">
              {cluster.summary}
            </p>
          </div>
        )}
      </div>

      {/* Mastery Evidence Criteria */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mastery Evidence Criteria
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topic.evidence.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 bg-slate-50/60 border border-slate-100 p-3 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-700 leading-normal">{ev}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Assessment prompt */}
      {topic.assessmentPrompt && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-indigo-400" /> Informal Assessment Check
            </h4>
            {/* Input to change name */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Child's Name:</span>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="Alex"
                className="w-16 px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-200 leading-relaxed italic">
            "{formattedPrompt}"
          </p>
        </div>
      )}

      {/* Navigation Pivot Links */}
      <div className="flex flex-wrap items-center gap-3 border-t border-b border-slate-100 py-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Pivots:
        </span>
        <button
          onClick={() => onPivotView("graph")}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer"
        >
          <Network className="w-3.5 h-3.5" />
          <span>Local Graph View</span>
        </button>
        <button
          onClick={() => onPivotView("pathway")}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-xl transition-all cursor-pointer"
        >
          <Map className="w-3.5 h-3.5" />
          <span>Prerequisite Roadmap</span>
        </button>
      </div>

      {/* Curriculum standards alignment */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-500" /> Curriculum Standards Alignment
        </h4>
        {matchedStandards.length === 0 ? (
          <p className="text-xs text-slate-500 italic bg-slate-50/50 rounded-xl p-3 border border-slate-100">
            This micro-topic represents an integrated cognitive bridge skill, and is not explicitly codified as a standalone item in the selected primary standards.
          </p>
        ) : (
          <div className="space-y-2">
            {matchedStandards.map((std, index) => {
              const isOpen = !!expandedStandards[std.key];
              return (
                <div key={index} className="border border-slate-200/60 rounded-xl overflow-hidden bg-white">
                  <div 
                    onClick={() => toggleStandard(std.key)}
                    className="flex items-center justify-between px-4 py-3 bg-slate-50/40 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {std.curriculum} {std.region && `(${std.region})`}
                      </p>
                      <h5 className="font-mono text-xs font-semibold text-slate-800 mt-0.5">
                        {std.code}
                      </h5>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                        Details
                      </span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-600 bg-slate-50/30 leading-relaxed">
                      {std.name && <p className="font-semibold text-slate-800 mb-1">{std.name}</p>}
                      <p className="whitespace-pre-wrap">{std.description || "No full-text description available."}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
