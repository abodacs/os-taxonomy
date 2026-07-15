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
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col font-sans relative overflow-hidden">
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-indigo-500 focus:text-white focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* The specimen owns the full viewport. The inspector is an overlay so
          opening it never changes the graph's camera framing or composition. */}
      <div className="flex-1 relative min-h-screen">
        <main
          id="main-content"
          className="w-full h-[72vh] min-h-[620px] lg:h-screen relative flex flex-col justify-between p-4 md:p-6"
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

        {/* Right Side: floating HUD inspector */}
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
