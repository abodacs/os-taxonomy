import { useMemo } from "react";
import { manifest } from "../dataLoader";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { BookOpen, Network, Layers, Sparkles, Award } from "lucide-react";

interface OverviewDashboardProps {
  onSelectSubject: (subject: string) => void;
  selectedSubject: string;
}

export default function OverviewDashboard({ onSelectSubject, selectedSubject }: OverviewDashboardProps) {
  // Stats
  const stats = useMemo(() => {
    return [
      { 
        label: "Micro-Topics", 
        value: manifest.counts.topics.toLocaleString(), 
        desc: "Individual teachable skills",
        icon: BookOpen,
        color: "bg-blue-50 text-blue-600 border-blue-100" 
      },
      { 
        label: "Prerequisite Edges", 
        value: manifest.counts.dependencies.toLocaleString(), 
        desc: "Graph pathways mapped",
        icon: Network,
        color: "bg-indigo-50 text-indigo-600 border-indigo-100" 
      },
      { 
        label: "Standards Aligned", 
        value: manifest.counts.curriculumStandards.toLocaleString(), 
        desc: "Aligned to national curricula",
        icon: Award,
        color: "bg-emerald-50 text-emerald-600 border-emerald-100" 
      },
      { 
        label: "Domain Summaries", 
        value: manifest.counts.clusters.toLocaleString(), 
        desc: "Parent-friendly descriptions",
        icon: Layers,
        color: "bg-amber-50 text-amber-600 border-amber-100" 
      }
    ];
  }, []);

  // Format data for Recharts subject count
  const chartData = useMemo(() => {
    const counts = manifest.counts.topicsBySubject as Record<string, number>;
    return Object.entries(counts)
      .map(([subject, count]) => ({
        subject,
        count,
        percentage: ((count / manifest.counts.topics) * 100).toFixed(1) + "%",
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  // Subject theme colors matching getSubjectColor
  const getSubjectColorHex = (subject: string) => {
    switch (subject) {
      case "Science": return "#10b981"; // emerald
      case "Mathematics": return "#3b82f6"; // blue
      case "English": return "#6366f1"; // indigo
      case "History": return "#f59e0b"; // amber
      case "Personal & Social Development": return "#8b5cf6"; // purple
      case "Life Skills": return "#f43f5e"; // rose
      case "Computing": return "#06b6d4"; // cyan
      default: return "#64748b"; // slate
    }
  };

  return (
    <div className="space-y-6" id="overview-dashboard">
      {/* Hero Welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-sm border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-3 bg-indigo-500/20 text-indigo-200 text-xs px-3 py-1 rounded-full w-max border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Structured Learning Graph · {manifest.taxonomyVersion} Release</span>
          </div>
          <h2 className="font-display font-bold text-2xl md:text-3xl leading-tight">
            Explore the Universe of Primary Learning
          </h2>
          <p className="text-slate-300 text-sm mt-3 leading-relaxed">
            The Marble Skill Taxonomy maps out exactly what children learn in their primary & elementary years. Decomposed into 1,590 fine-grained micro-topics, sequenced in a prerequisite dependency DAG, and aligned with international standards.
          </p>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
            <div className={`p-3 rounded-xl border ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                {stat.label}
              </p>
              <h3 className="font-display font-bold text-slate-800 text-xl md:text-2xl mt-0.5 leading-none">
                {stat.value}
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-none">{stat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart & Subject Quick Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Subject distribution chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="font-display font-semibold text-slate-800">
              Taxonomy Subject Density
            </h3>
            <p className="text-xs text-slate-500">
              Relative weight and count of topics mapped out for each domain area.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="subject"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }}
                  width={150}
                />
                <Tooltip
                  cursor={{ fill: "rgba(226, 232, 240, 0.4)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as { subject: string; count: number; percentage: string };
                      return (
                        <div className="bg-slate-900 text-white rounded-xl px-3 py-2 shadow-lg border border-slate-800 text-xs">
                          <p className="font-semibold">{data.subject}</p>
                          <p className="text-slate-300 mt-0.5">
                            {data.count} Topics ({data.percentage})
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={16}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getSubjectColorHex(entry.subject)}
                      className="cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={() => onSelectSubject(entry.subject)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick subject shortcuts */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-display font-semibold text-slate-800">
              Subjects Quick Filter
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Jump directly to any subject area to browse and filter matching skills.
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {chartData.map((item) => {
                const isSelected = selectedSubject === item.subject;
                const dotColor = getSubjectColorHex(item.subject);
                return (
                  <button
                    key={item.subject}
                    onClick={() => onSelectSubject(item.subject)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition-all text-left ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm font-semibold"
                        : "bg-slate-50/50 border-slate-100 hover:bg-slate-100/50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      ></span>
                      <span>{item.subject}</span>
                    </div>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-slate-800 text-white" : "bg-white text-slate-500 border border-slate-100"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {selectedSubject && (
            <button
              onClick={() => onSelectSubject("")}
              className="mt-4 w-full text-center py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Clear Subject Selection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
