import { Sparkles } from "lucide-react";

/**
 * Top-left overlay: the MARBLE wordmark, tagline, and a hint pointing users to
 * the interactive 3D graph. Purely presentational.
 */
export function BrandOverlay() {
  return (
    <div className="z-10 max-w-lg space-y-2 pointer-events-auto bg-[#03060f]/60 backdrop-blur-md p-4 rounded-2xl border border-white/5">
      <div className="flex items-center gap-2.5">
        <span className="font-display font-black tracking-widest text-2xl bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 bg-clip-text text-transparent">
          MARBLE
        </span>
        <span className="text-[11px] tracking-widest text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase">
          • US/UK CURRICULUM · AGES 4-15
        </span>
      </div>

      <h2 className="font-serif italic text-2xl md:text-3xl font-normal text-white leading-tight">
        "Everything a child learns."
      </h2>

      <p className="text-xs text-slate-400 leading-relaxed">
        1,590 concepts and 3,221 connections across 8 subjects, from Math and
        Science to Computing and Life Skills.
      </p>

      <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Tap any dot to
        see everything a learner must master before it.
      </p>
    </div>
  );
}
