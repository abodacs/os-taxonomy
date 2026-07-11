import { useMemo } from "react";
import {
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Tag,
  CheckSquare,
  Square,
} from "lucide-react";
import { useExplorer } from "../../state/ExplorerContext";
import { getClusterSummary } from "../../dataLoader";

const PANEL_ID = "sidebar-panel-inspect";

/**
 * Inspect tab — details for the active topic: subject pill, description,
 * parent context summary, mastery evidence checklist, and an editable
 * assessment prompt. Tab-private derivations (parentCluster,
 * formattedAssessmentPrompt) are computed locally so the provider doesn't
 * need to know about this tab's needs.
 */
export function InspectPanel() {
  const {
    state: { activeTopic, checkedEvidence, childName },
    actions: { toggleEvidence, setChildName },
    meta: { subjectColor },
  } = useExplorer();

  const parentCluster = useMemo(() => {
    if (!activeTopic) return undefined;
    return getClusterSummary(
      activeTopic.subject,
      activeTopic.domain,
      activeTopic.ageRangeStart
    );
  }, [activeTopic]);

  const formattedAssessmentPrompt = useMemo(() => {
    if (!activeTopic?.assessmentPrompt) return "";
    return activeTopic.assessmentPrompt.replace(
      /\{\{\s*name\s*\}\}/g,
      childName || "the learner"
    );
  }, [activeTopic, childName]);

  return (
    <div
      id={PANEL_ID}
      role="tabpanel"
      aria-labelledby="sidebar-tab-inspect"
      tabIndex={0}
      className="space-y-4 focus-visible:outline-none"
    >
      {activeTopic ? (
        <>
          {/* Top Subject/Name pill */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase border"
                style={{
                  borderColor: `${subjectColor(activeTopic.subject)}30`,
                  color: subjectColor(activeTopic.subject),
                  backgroundColor: `${subjectColor(activeTopic.subject)}10`,
                }}
              >
                {activeTopic.subject}
              </span>
              <span className="text-[11px] text-slate-300 font-mono tracking-wider">
                {activeTopic.domain}
              </span>
            </div>

            <h3 className="font-display font-extrabold text-white text-lg md:text-xl leading-snug">
              {activeTopic.name}
            </h3>

            <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-300 pt-0.5">
              <span>
                Age:{" "}
                <strong className="text-rose-300 font-semibold">
                  {activeTopic.ageRangeStart}-{activeTopic.ageRangeEnd}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                ID:{" "}
                <strong className="text-indigo-300">{activeTopic.id}</strong>
              </span>
            </div>
          </div>

          {/* Concept Description */}
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 space-y-1.5">
            <h4 className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
              Skill Description
            </h4>
            <p className="text-xs text-slate-200 leading-relaxed">
              {activeTopic.description}
            </p>
          </div>

          {/* Parent perspective summary */}
          {parentCluster && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3.5 space-y-1.5">
              <h4 className="text-[11px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Parent
                Context Summary
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-normal">
                {parentCluster.summary}
              </p>
            </div>
          )}

          {/* Mastery Criteria Evidence Checklist */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-slate-300 tracking-wider uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />{" "}
              Evidence required for mastery
            </h4>

            <div className="space-y-1.5">
              {activeTopic.evidence.map((ev, i) => {
                const isChecked = !!checkedEvidence[i];
                const checkboxId = `evidence-${activeTopic.id}-${i}`;
                return (
                  <div
                    key={i}
                    className={`w-full text-left flex items-start gap-2.5 bg-[#0d1222]/80 border p-2.5 rounded-xl transition-all hover:bg-[#121930] ${
                      isChecked
                        ? "border-emerald-500/30"
                        : "border-white/5 hover:border-white/10"
                    }`}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEvidence(i)}
                      className="sr-only"
                    />
                    <label
                      htmlFor={checkboxId}
                      className="flex items-start gap-2.5 cursor-pointer flex-1"
                    >
                      <span className="shrink-0 mt-0.5 text-slate-400" aria-hidden="true">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </span>
                      <span
                        className={`text-[11px] leading-relaxed transition-colors ${
                          isChecked
                            ? "text-slate-400 line-through"
                            : "text-slate-200 font-medium"
                        }`}
                      >
                        {ev}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Assessment Prompt */}
          {activeTopic.assessmentPrompt && (
            <div className="bg-slate-950 border border-white/5 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-[11px] font-bold text-pink-400 tracking-wider uppercase flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" aria-hidden="true" /> Quick
                  Assessment Check
                </h4>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <label
                    htmlFor="child-name-input"
                    className="text-slate-400 font-mono"
                  >
                    Child name:
                  </label>
                  <input
                    id="child-name-input"
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 w-20 text-white font-bold text-[11px] focus:outline-none focus:border-pink-500 focus-visible:ring-1 focus-visible:ring-pink-500 transition-colors"
                    placeholder="Alex"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed font-serif italic bg-white/5 p-3 rounded-lg border border-white/5">
                &ldquo;{formattedAssessmentPrompt}&rdquo;
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <HelpCircle
            className="w-10 h-10 mx-auto text-slate-500 mb-2"
            aria-hidden="true"
          />
          <p>
            Select a concept on the 3D graph to inspect its details, mastery
            criteria, and assessment steps.
          </p>
        </div>
      )}
    </div>
  );
}
