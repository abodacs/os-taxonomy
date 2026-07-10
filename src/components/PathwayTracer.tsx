import { useMemo } from "react";
import { Topic } from "../types";
import { getTransitivePrerequisites, dependenciesList, topicsMap } from "../dataLoader";
import { Footprints, Map } from "lucide-react";

interface PathwayTracerProps {
  topic: Topic;
  onSelectTopic: (topic: Topic) => void;
}

export default function PathwayTracer({ topic, onSelectTopic }: PathwayTracerProps) {
  // Compute transitive prerequisites
  const rawPrereqs = useMemo(() => getTransitivePrerequisites(topic.id), [topic.id]);

  // We want to sort the prerequisite list from "most fundamental" (deepest distance, youngest age)
  // to "closest prerequisites" (shallowest distance, oldest age).
  const sortedPrereqs = useMemo(() => {
    return [...rawPrereqs].sort((a, b) => {
      // First, sort by ageRangeStart ascending
      if (a.topic.ageRangeStart !== b.topic.ageRangeStart) {
        return a.topic.ageRangeStart - b.topic.ageRangeStart;
      }
      // Then, sort by distance descending (larger distance means deeper in the prerequisite tree)
      return b.distance - a.distance;
    });
  }, [rawPrereqs]);

  // Find reasons for connecting edges
  // We can look up the dependencies that link each step to other steps in our sub-graph,
  // or to the target topic.
  const edgeReasons = useMemo(() => {
    const reasons: Record<string, { targetName: string; reason: string; strength: string }[]> = {};
    const allTopicIdsInPath = new Set([...sortedPrereqs.map(p => p.topic.id), topic.id]);

    for (const dep of dependenciesList) {
      if (allTopicIdsInPath.has(dep.topicId) && allTopicIdsInPath.has(dep.prerequisiteId)) {
        const targetTopic = topicsMap.get(dep.topicId);
        if (targetTopic) {
          if (!reasons[dep.prerequisiteId]) {
            reasons[dep.prerequisiteId] = [];
          }
          reasons[dep.prerequisiteId].push({
            targetName: targetTopic.name,
            reason: dep.reason,
            strength: dep.strength,
          });
        }
      }
    }
    return reasons;
  }, [sortedPrereqs, topic.id]);

  const getSubjectBadgeColor = (subject: string) => {
    switch (subject) {
      case "Science":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Mathematics":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "English":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "History":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Personal & Social Development":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Life Skills":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "Computing":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm" id="pathway-tracer">
      <div className="flex items-center gap-2.5 mb-5 border-b border-slate-100 pb-3">
        <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
          <Map className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-slate-800 text-lg">Prerequisite Learning Map</h3>
          <p className="text-xs text-slate-500">
            A step-by-step master plan of {sortedPrereqs.length + 1} micro-topics ordered from foundational fundamentals to final concept.
          </p>
        </div>
      </div>

      {sortedPrereqs.length === 0 ? (
        <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <Footprints className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h4 className="font-semibold text-slate-700 text-sm">No prerequisite path needed</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            "{topic.name}" has no prior requirements in the taxonomy! Learners can jump straight into this concept with standard age-level readiness.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-indigo-100 ml-4 space-y-6 py-2">
          {/* Loop over step-by-step prerequisites */}
          {sortedPrereqs.map((step, index) => {
            const reasons = edgeReasons[step.topic.id] || [];
            return (
              <div key={step.topic.id} className="relative group">
                {/* Visual marker */}
                <span className="absolute -left-[31px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-indigo-400 text-[10px] font-bold text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                  {index + 1}
                </span>

                <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 transition-all hover:bg-slate-50 hover:border-indigo-100 hover:shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getSubjectBadgeColor(step.topic.subject)}`}>
                        {step.topic.subject}
                      </span>
                      <span className="text-xs font-medium text-slate-400">
                        {step.topic.domain}
                      </span>
                    </div>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white font-medium text-slate-500 border border-slate-100">
                      Typical Age: {step.topic.ageRangeStart} - {step.topic.ageRangeEnd}
                    </span>
                  </div>

                  <h4 
                    onClick={() => onSelectTopic(step.topic)}
                    className="font-display font-semibold text-slate-800 text-sm hover:text-indigo-600 cursor-pointer inline-block leading-snug"
                  >
                    {step.topic.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-3">
                    {step.topic.description}
                  </p>

                  {/* Reasons why this is needed downstream */}
                  {reasons.length > 0 && (
                    <div className="mt-3 bg-white/90 border border-slate-100 rounded-lg p-2.5 text-xs space-y-2">
                      <p className="font-medium text-slate-500 text-[10px] uppercase tracking-wider">
                        Why this is a crucial step:
                      </p>
                      {reasons.map((r, ri) => (
                        <div key={ri} className="flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0"></span>
                          <p className="text-slate-600 leading-normal">
                            <span className="font-semibold text-slate-700">Enables "{r.targetName}":</span>{" "}
                            <span className="italic">"{r.reason}"</span>{" "}
                            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-slate-100 rounded text-slate-500 capitalize">
                              {r.strength}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Final Destination Step */}
          <div className="relative group">
            <span className="absolute -left-[31px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 border-2 border-indigo-600 text-[10px] font-bold text-white shadow-sm">
              ★
            </span>

            <div className="bg-indigo-50/50 border border-indigo-100/80 rounded-xl p-4 ring-2 ring-indigo-50">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getSubjectBadgeColor(topic.subject)}`}>
                    {topic.subject}
                  </span>
                  <span className="text-xs font-medium text-indigo-500">
                    {topic.domain}
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-white font-medium text-indigo-600 border border-indigo-100 shadow-xs">
                  Target Concept · Age {topic.ageRangeStart} - {topic.ageRangeEnd}
                </span>
              </div>

              <h4 className="font-display font-bold text-slate-850 text-sm">
                Target: {topic.name}
              </h4>
              <p className="text-xs text-slate-700 mt-1 font-medium">
                {topic.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
