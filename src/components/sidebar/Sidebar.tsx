import {
  useRef,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { Compass, Search, Award, GraduationCap } from "lucide-react";
import { useExplorer, type HudTab } from "../../state/ExplorerContext";

// ---------------------------------------------------------------------------
// Compound Sidebar component (vercel-composition-patterns rules 1.2 & 3.2)
//
// Consumers compose the pieces they need via the Sidebar namespace object:
//
//   <Sidebar>
//     <Sidebar.Tabs />
//     <Sidebar.Body>...</Sidebar.Body>
//     <Sidebar.Footer />
//   </Sidebar>
//
// Subcomponents read shared state from ExplorerContext — no prop drilling.
// ---------------------------------------------------------------------------

const TAB_ORDER: HudTab[] = ["inspect", "search", "standards", "pathways"];

const TAB_META: Record<
  HudTab,
  { label: string; icon: ReactNode }
> = {
  inspect: { label: "Inspect", icon: <Compass className="w-4 h-4" /> },
  search: { label: "Catalog", icon: <Search className="w-4 h-4" /> },
  standards: { label: "Standards", icon: <Award className="w-4 h-4" /> },
  pathways: { label: "Pathway", icon: <GraduationCap className="w-4 h-4" /> },
};

function SidebarShell({ children }: { children: ReactNode }) {
  return (
    <aside
      className="relative z-30 p-4 md:p-6 flex flex-col min-h-[42vh] lg:min-h-0 lg:h-[calc(100vh-2rem)] lg:w-[352px] lg:absolute lg:right-4 lg:top-4 overflow-hidden bg-[#0b0e14]/92 backdrop-blur-xl border border-white/10 lg:rounded-2xl shadow-2xl shadow-black/20"
      aria-label="Explorer details"
    >
      {children}
    </aside>
  );
}

function Tabs() {
  const {
    state: { activeHudTab },
    actions: { setHudTab },
  } = useExplorer();

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const focusTab = (tab: HudTab) => {
    setHudTab(tab);
    tabRefs.current[tab]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tab: HudTab) => {
    const idx = TAB_ORDER.indexOf(tab);
    let next: HudTab | null = null;

    if (e.key === "ArrowRight") {
      next = TAB_ORDER[(idx + 1) % TAB_ORDER.length];
    } else if (e.key === "ArrowLeft") {
      next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length];
    } else if (e.key === "Home") {
      next = TAB_ORDER[0];
    } else if (e.key === "End") {
      next = TAB_ORDER[TAB_ORDER.length - 1];
    }

    if (next) {
      e.preventDefault();
      focusTab(next);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Explorer views"
      className="grid grid-cols-4 gap-1 bg-[#02040a] p-1 rounded-xl border border-white/5 shrink-0"
    >
      {TAB_ORDER.map((tab) => {
        const isActive = activeHudTab === tab;
        const { label, icon } = TAB_META[tab];
        const panelId = `sidebar-panel-${tab}`;
        return (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[tab] = el;
            }}
            role="tab"
            id={`sidebar-tab-${tab}`}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setHudTab(tab)}
            onKeyDown={(e) => handleKeyDown(e, tab)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[11px] font-bold tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              isActive
                ? "bg-gradient-to-b from-slate-800 to-slate-900 border border-white/10 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span aria-hidden="true" className="mb-1">
              {icon}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Divider line */}
      <div className="h-px bg-white/5 my-4 shrink-0" />
      {/* Active Tab Panel Body - scrollable */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs custom-scrollbar">
        {children}
      </div>
    </>
  );
}

function Footer() {
  return (
    <div className="border-t border-white/5 pt-3.5 mt-4 text-[11px] text-slate-400 leading-normal font-mono shrink-0">
      <p className="truncate">Marble Skill Taxonomy v1 · Open License</p>
      <p className="truncate">Licensed under ODbL 1.0 & CC BY-SA 4.0</p>
    </div>
  );
}

/** Compound Sidebar — compose via Sidebar.Tabs / Sidebar.Body / Sidebar.Footer. */
export const Sidebar = Object.assign(SidebarShell, {
  Tabs,
  Body,
  Footer,
});
