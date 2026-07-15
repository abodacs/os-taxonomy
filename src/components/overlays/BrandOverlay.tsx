/**
 * Top-left overlay: a minimalist serif wordmark with a single colored dot,
 * plus a thin tagline. Purely presentational — the "earns."-style aesthetic:
 * elegant serif, a single accent dot, no heavy container.
 */
export function BrandOverlay() {
  return (
    <div className="z-10 max-w-[690px] pointer-events-auto px-1 py-1 md:pt-2">
      <div className="text-[26px] font-black tracking-[-0.08em] leading-none text-slate-100 uppercase">
        Marble
      </div>

      <div className="mt-[205px] md:mt-[205px] max-w-[680px]">
        <h1
          className="text-[clamp(2.75rem,4.2vw,4.4rem)] leading-[0.98] tracking-[-0.045em] text-slate-50"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Everything a child learns<span className="text-red-500">.</span>
        </h1>
        <p className="mt-5 max-w-[410px] text-[13px] font-semibold leading-6 text-slate-100">
          The open map of primary school, built from the US and UK curricula.
        </p>
        <p className="mt-1 max-w-[470px] text-[12px] leading-6 text-slate-300">
          <span className="font-semibold text-slate-100">1590</span> concepts and <span className="font-semibold text-slate-100">3221</span> prerequisite links, from first words to algebra. Every link says what must come first, and why. <span className="font-semibold text-slate-100">Tap any dot</span> to see everything a learner must master before it.
        </p>
        <p className="mt-2 max-w-[430px] text-[11px] leading-5 text-slate-400">
          Assembled from 7 curriculum frameworks by our AI agents, reviewed by our team, and now open source for anyone to build on.
        </p>
        <div className="mt-5 flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
          <a href="https://github.com/abodacs/os-taxonomy" target="_blank" rel="noreferrer" className="rounded-full border border-slate-600 px-4 py-2 text-slate-200 transition-colors hover:border-slate-300 hover:text-white">
            View on GitHub
          </a>
          <span>Open data · ODbL 1.0</span>
        </div>
      </div>
    </div>
  );
}
