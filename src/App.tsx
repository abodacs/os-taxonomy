import { ExplorerProvider, useExplorer } from "./state/ExplorerContext";
import ThreeDGraphCanvas from "./components/ThreeDGraphCanvas";
import { BrandOverlay } from "./components/overlays/BrandOverlay";
import { SubjectLegend } from "./components/overlays/SubjectLegend";
import { NavHint } from "./components/overlays/NavHint";
import { Sidebar } from "./components/sidebar/Sidebar";
import { InspectPanel } from "./components/sidebar/InspectPanel";
import { CatalogPanel } from "./components/sidebar/CatalogPanel";
import { StandardsPanel } from "./components/sidebar/StandardsPanel";
import { PathwayPanel } from "./components/sidebar/PathwayPanel";

/**
 * The active sidebar panel. Reads `activeHudTab` from context and renders the
 * matching explicit-variant panel (rule 3.1) — no boolean mode props, no
 * conditional chain inside a single component.
 */
function ActivePanel() {
  const {
    state: { activeHudTab },
  } = useExplorer();

  switch (activeHudTab) {
    case "inspect":
      return <InspectPanel />;
    case "search":
      return <CatalogPanel />;
    case "standards":
      return <StandardsPanel />;
    case "pathways":
      return <PathwayPanel />;
  }
}

/**
 * Explorer — the composed UI. State is lifted into ExplorerProvider (rule 2.3);
 * every child reads from context, so none of them need props for shared state.
 */
function Explorer() {
  const {
    state: { activeTopic, hiddenSubjects, autoRotate },
    actions: { selectTopic, deselectTopic, toggleAutoRotate, resetView },
  } = useExplorer();

  return (
    <div className="min-h-screen bg-[#03060f] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Background ambient radial glowing spots for visual luxury */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[150px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[150px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-indigo-500 focus:text-white focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Main Grid: Left area for immersive 3D graph + overlays, Right area for the HUD Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative">
        <main
          id="main-content"
          className="lg:col-span-8 h-[60vh] lg:h-screen relative flex flex-col justify-between p-4 md:p-6 border-b lg:border-b-0 lg:border-r border-white/5"
        >
          {/* Top-Left Overlay Panel */}
          <BrandOverlay />

          {/* Core Centerpiece: Interactive 3D Canvas */}
          <div className="absolute inset-0 z-0">
            <ThreeDGraphCanvas
              activeTopic={activeTopic}
              onSelectTopic={selectTopic}
              onDeselectTopic={deselectTopic}
              hiddenSubjects={hiddenSubjects}
              autoRotate={autoRotate}
              onToggleAutoRotate={toggleAutoRotate}
              onResetView={resetView}
            />
          </div>

          {/* Bottom Overlays */}
          <div className="z-10 flex flex-col md:flex-row md:items-end justify-between gap-4 mt-auto">
            <SubjectLegend />
            <NavHint />
          </div>
        </main>

        {/* Right Side: Premium HUD Sidebar Inspector */}
        <Sidebar>
          <Sidebar.Tabs />
          <Sidebar.Body>
            <ActivePanel />
          </Sidebar.Body>
          <Sidebar.Footer />
        </Sidebar>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ExplorerProvider>
      <Explorer />
    </ExplorerProvider>
  );
}
