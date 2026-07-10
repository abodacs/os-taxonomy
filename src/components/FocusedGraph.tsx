import { useMemo } from "react";
import { Topic } from "../types";
import { getDirectPrerequisites, getDirectUnlocks } from "../dataLoader";
import { ArrowLeft, ArrowRight, Network } from "lucide-react";

interface FocusedGraphProps {
  topic: Topic;
  onSelectTopic: (topic: Topic) => void;
}

export default function FocusedGraph({ topic, onSelectTopic }: FocusedGraphProps) {
  // Get direct connections
  const prereqs = useMemo(() => getDirectPrerequisites(topic.id), [topic.id]);
  const unlocks = useMemo(() => getDirectUnlocks(topic.id), [topic.id]);

  // Color mapping based on subject
  const getSubjectColor = (subject: string) => {
    switch (subject) {
      case "Science":
        return { bg: "bg-emerald-50", border: "border-emerald-300 text-emerald-700", dot: "bg-emerald-500" };
      case "Mathematics":
        return { bg: "bg-blue-50", border: "border-blue-300 text-blue-700", dot: "bg-blue-500" };
      case "English":
        return { bg: "bg-indigo-50", border: "border-indigo-300 text-indigo-700", dot: "bg-indigo-500" };
      case "History":
        return { bg: "bg-amber-50", border: "border-amber-300 text-amber-700", dot: "bg-amber-500" };
      case "Personal & Social Development":
        return { bg: "bg-purple-50", border: "border-purple-300 text-purple-700", dot: "bg-purple-500" };
      case "Life Skills":
        return { bg: "bg-rose-50", border: "border-rose-300 text-rose-700", dot: "bg-rose-500" };
      case "Computing":
        return { bg: "bg-cyan-50", border: "border-cyan-300 text-cyan-700", dot: "bg-cyan-500" };
      default:
        return { bg: "bg-slate-50", border: "border-slate-300 text-slate-700", dot: "bg-slate-500" };
    }
  };

  const centerColor = getSubjectColor(topic.subject);

  // SVG dimensions & grid layout
  const width = 800;
  const height = 400;
  const paddingX = 60;
  const centerX = width / 2;
  const centerY = height / 2;

  // Compute node coordinates
  const prereqNodes = useMemo(() => {
    const count = prereqs.length;
    if (count === 0) return [];
    const startY = count === 1 ? centerY : centerY - (100 * (count - 1)) / 2;
    return prereqs.map((p, i) => ({
      ...p,
      x: paddingX + 120,
      y: count === 1 ? centerY : startY + i * 90,
    }));
  }, [prereqs, centerY]);

  const unlockNodes = useMemo(() => {
    const count = unlocks.length;
    if (count === 0) return [];
    const startY = count === 1 ? centerY : centerY - (100 * (count - 1)) / 2;
    return unlocks.map((u, i) => ({
      ...u,
      x: width - paddingX - 120,
      y: count === 1 ? centerY : startY + i * 90,
    }));
  }, [unlocks, centerY, width]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm overflow-hidden" id="focused-graph">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-800 text-lg">Interactive Local Graph</h3>
            <p className="text-xs text-slate-500">Prerequisites unlock topics from left to right. Tap any node to pivot.</p>
          </div>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span>
            <span>Prerequisites</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
            <span>Active Topic</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-300 inline-block"></span>
            <span>Unlocks</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <div className="min-w-[800px] h-[400px] relative select-none">
          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
              </marker>
              <marker
                id="arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
              </marker>
            </defs>

            {/* Paths from Prerequisites to Active Node */}
            {prereqNodes.map((p, i) => {
              // Cubic bezier curves
              const x1 = p.x + 110;
              const y1 = p.y;
              const x2 = centerX - 120;
              const y2 = centerY;
              const controlX1 = x1 + 40;
              const controlY1 = y1;
              const controlX2 = x2 - 40;
              const controlY2 = y2;
              const d = `M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`;

              return (
                <g key={`edge-pre-${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={p.dependency.strength === "hard" ? "#cbd5e1" : "#e2e8f0"}
                    strokeWidth={p.dependency.strength === "hard" ? 2 : 1}
                    strokeDasharray={p.dependency.strength === "soft" ? "4,4" : undefined}
                    markerEnd="url(#arrow)"
                  />
                  {/* Label for dependency reason */}
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fill="#64748b"
                    className="text-[10px] font-medium"
                    style={{ pointerEvents: "auto", cursor: "help" }}
                  >
                    <title>{p.dependency.reason}</title>
                    {p.dependency.strength === "hard" ? "requires" : "recommends"}
                  </text>
                </g>
              );
            })}

            {/* Paths from Active Node to Unlocks */}
            {unlockNodes.map((u, i) => {
              const x1 = centerX + 120;
              const y1 = centerY;
              const x2 = u.x - 110;
              const y2 = u.y;
              const controlX1 = x1 + 40;
              const controlY1 = y1;
              const controlX2 = x2 - 40;
              const controlY2 = y2;
              const d = `M ${x1} ${y1} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${x2} ${y2}`;

              return (
                <g key={`edge-un-${i}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={u.dependency.strength === "hard" ? "#a5b4fc" : "#e0e7ff"}
                    strokeWidth={u.dependency.strength === "hard" ? 2 : 1}
                    strokeDasharray={u.dependency.strength === "soft" ? "4,4" : undefined}
                    markerEnd="url(#arrow-active)"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fill="#6366f1"
                    className="text-[10px] font-medium"
                    style={{ pointerEvents: "auto", cursor: "help" }}
                  >
                    <title>{u.dependency.reason}</title>
                    {u.dependency.strength === "hard" ? "unlocks" : "supports"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Center (Selected Topic) Node */}
          <div
            style={{ left: centerX - 110, top: centerY - 45 }}
            className={`absolute w-[220px] h-[90px] rounded-xl border-2 p-3 flex flex-col justify-between cursor-default transition-all duration-300 shadow-md ${centerColor.bg} ${centerColor.border} ring-4 ring-indigo-50`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Active Topic
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white font-medium border border-slate-100">
                Age {topic.ageRangeStart}-{topic.ageRangeEnd}
              </span>
            </div>
            <h4 className="font-display font-bold text-slate-800 text-xs line-clamp-2 leading-tight">
              {topic.name}
            </h4>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${centerColor.dot}`}></span>
              <span className="text-[10px] font-medium text-slate-500 truncate">{topic.subject}</span>
            </div>
          </div>

          {/* Prerequisite Nodes (Left Column) */}
          {prereqNodes.length === 0 ? (
            <div
              style={{ left: paddingX + 20, top: centerY - 30 }}
              className="absolute w-[180px] h-[60px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50/50 rounded-xl px-4 text-center"
            >
              <div className="text-slate-400">
                <p className="text-[10px] font-medium">No prerequisites</p>
                <p className="text-[8px]">This is an introductory concept!</p>
              </div>
            </div>
          ) : (
            prereqNodes.map((p) => {
              const pColor = getSubjectColor(p.topic.subject);
              return (
                <button
                  key={p.topic.id}
                  onClick={() => onSelectTopic(p.topic)}
                  style={{ left: p.x - 110, top: p.y - 40 }}
                  className={`absolute w-[220px] h-[80px] rounded-xl border text-left p-2.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow-md bg-white border-slate-200 hover:border-slate-400`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" /> Prereq ({p.dependency.strength})
                    </span>
                    <span className="text-[9px] font-mono font-semibold px-1 py-0.2 bg-slate-100 rounded text-slate-600">
                      Y{p.topic.ageRangeStart}
                    </span>
                  </div>
                  <h4 className="font-display font-semibold text-slate-700 text-xs line-clamp-2 leading-tight w-full hover:text-indigo-600">
                    {p.topic.name}
                  </h4>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${pColor.dot}`}></span>
                    <span className="text-[9px] text-slate-500 truncate">{p.topic.subject}</span>
                  </div>
                </button>
              );
            })
          )}

          {/* Unlock Nodes (Right Column) */}
          {unlockNodes.length === 0 ? (
            <div
              style={{ left: width - paddingX - 200, top: centerY - 30 }}
              className="absolute w-[180px] h-[60px] flex items-center justify-center border border-dashed border-slate-300 bg-slate-50/50 rounded-xl px-4 text-center"
            >
              <div className="text-slate-400">
                <p className="text-[10px] font-medium">No downstream topics</p>
                <p className="text-[8px]">This is a terminal target skill!</p>
              </div>
            </div>
          ) : (
            unlockNodes.map((u) => {
              const uColor = getSubjectColor(u.topic.subject);
              return (
                <button
                  key={u.topic.id}
                  onClick={() => onSelectTopic(u.topic)}
                  style={{ left: u.x - 110, top: u.y - 40 }}
                  className={`absolute w-[220px] h-[80px] rounded-xl border text-left p-2.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm hover:shadow-md bg-white border-indigo-100 hover:border-indigo-400`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className="text-[9px] font-medium text-indigo-400 flex items-center gap-1">
                      Unlocks ({u.dependency.strength}) <ArrowRight className="w-3 h-3" />
                    </span>
                    <span className="text-[9px] font-mono font-semibold px-1 py-0.2 bg-indigo-50 rounded text-indigo-600">
                      Y{u.topic.ageRangeStart}
                    </span>
                  </div>
                  <h4 className="font-display font-semibold text-slate-700 text-xs line-clamp-2 leading-tight w-full hover:text-indigo-600">
                    {u.topic.name}
                  </h4>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${uColor.dot}`}></span>
                    <span className="text-[9px] text-slate-500 truncate">{u.topic.subject}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
