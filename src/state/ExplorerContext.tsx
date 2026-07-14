import {
  createContext,
  useMemo,
  useState,
  use,
  type ReactNode,
} from "react";
import { Topic } from "../types";
import {
  topicsList,
  topicsMap,
  curriculaList,
} from "../dataLoader";
import { SUBJECT_COLORS, subjectColor as subjectColorUtil } from "../theme/subjectColors";

// ---------------------------------------------------------------------------
// Explorer state / actions / meta interface
//
// Per the vercel-composition-patterns skill: the provider is the only place
// that knows HOW state is managed (useState here). UI components consume the
// context interface only, so the same UI works with any provider that
// implements this contract.
// ---------------------------------------------------------------------------

export type HudTab = "inspect" | "search" | "standards" | "pathways";

/** The current state of the explorer — read-only from the UI's perspective. */
export interface ExplorerState {
  /** Selected concept for the inspector / 3D highlight. */
  activeTopic: Topic | null;
  /**
   * Subjects hidden from the 3D graph. Derived from `isolatedSubject` — when
   * a subject is soloed, every other subject is hidden so only that subject's
   * nodes (and the edges between them) remain. `null` → all subjects shown.
   * Kept as a field so the 3D canvas contract is unchanged.
   */
  hiddenSubjects: Set<string>;
  /** The subject currently isolated in the 3D graph, or null to show all. */
  isolatedSubject: string | null;
  /** Active sidebar tab. */
  activeHudTab: HudTab;
  /** Auto-rotate toggle for the 3D graph. */
  autoRotate: boolean;
  // --- Catalog tab ---
  catalogSearchTerm: string;
  catalogSelectedSubject: string;
  catalogSelectedAge: number | "";
  // --- Standards tab ---
  selectedCurriculumSlug: string;
  standardsSearchTerm: string;
  expandedStandardKey: string | null;
  // --- Inspect tab ephemeral UI ---
  checkedEvidence: Record<string, boolean>;
  childName: string;
}

/** Actions that mutate explorer state. */
export interface ExplorerActions {
  selectTopic: (topic: Topic) => void;
  deselectTopic: () => void;
  /** Solo a subject (isolate its nodes + internal edges) or restore all. */
  soloSubject: (subject: string) => void;
  setHudTab: (tab: HudTab) => void;
  toggleAutoRotate: () => void;
  resetView: () => void;
  setCatalogSearchTerm: (value: string) => void;
  setCatalogSelectedSubject: (value: string) => void;
  setCatalogSelectedAge: (value: number | "") => void;
  selectCurriculum: (slug: string) => void;
  setStandardsSearchTerm: (value: string) => void;
  setExpandedStandardKey: (key: string | null) => void;
  toggleEvidence: (index: number) => void;
  setChildName: (value: string) => void;
}

/** Stable, non-reactive metadata derived from state. */
export interface ExplorerMeta {
  /** Subject color lookup (palette + fallback). */
  subjectColor: (subject: string) => string;
  /** All known subject names (the palette keys). */
  subjectNames: string[];
}

export interface ExplorerContextValue {
  state: ExplorerState;
  actions: ExplorerActions;
  meta: ExplorerMeta;
  // Derived data — only shared derivations live here. Tab-private derivations
  // (learningPathway, parentCluster, formattedAssessmentPrompt,
  // standardMappedTopics) are computed locally in the panel that needs them,
  // so the provider doesn't know about each tab's needs and panels don't
  // re-render when an unrelated derivation changes.
  derived: {
    subjectStats: { name: string; count: number; color: string }[];
    filteredCatalogTopics: Topic[];
    curriculaList: Curriculum[];
    activeCurriculum: Curriculum | undefined;
    filteredStandards: Standard[];
  };
}

// Type aliases for the derived fields that reference loader types.
type Curriculum = (typeof curriculaList)[number];
type Standard = Curriculum["topics"][number];

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

const DEFAULT_TOPIC_ID = "mt_N8CpN1EJrP"; // "Building sentences"

export function ExplorerProvider({ children }: { children: ReactNode }) {
  const defaultTopic = useMemo(
    () => topicsMap.get(DEFAULT_TOPIC_ID) || topicsList[0],
    []
  );

  const [activeTopic, setActiveTopic] = useState<Topic | null>(
    defaultTopic || null
  );
  // The subject currently isolated in the graph (or null = all subjects shown).
  // `hiddenSubjects` is derived from this in the value memo below so the 3D
  // canvas contract (which consumes `hiddenSubjects`) stays unchanged.
  const [isolatedSubject, setIsolatedSubject] = useState<string | null>(null);
  const [activeHudTab, setActiveHudTab] = useState<HudTab>("inspect");
  const [autoRotate, setAutoRotate] = useState(false);

  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [catalogSelectedSubject, setCatalogSelectedSubject] = useState("");
  const [catalogSelectedAge, setCatalogSelectedAge] = useState<number | "">("");

  const [selectedCurriculumSlug, setSelectedCurriculumSlug] = useState(
    curriculaList[0]?.slug || ""
  );
  const [standardsSearchTerm, setStandardsSearchTerm] = useState("");
  const [expandedStandardKey, setExpandedStandardKey] = useState<
    string | null
  >(null);

  const [checkedEvidence, setCheckedEvidence] = useState<
    Record<string, boolean>
  >({});
  const [childName, setChildName] = useState("Alex");

  // --- Actions -------------------------------------------------------------
  // selectTopic also clears the evidence checklist. This REPLACES the previous
  // useEffect(() => setCheckedEvidence({}), [activeTopic]) — the skill calls
  // out "useEffect to sync state up" as an anti-pattern (rule 2.3). The
  // invariant "checked evidence resets when the topic changes" now lives in
  // the single place that changes the topic, not in a derived effect.
  const selectTopic = (topic: Topic) => {
    setActiveTopic(topic);
    setActiveHudTab("inspect");
    setCheckedEvidence({});
  };

  const deselectTopic = () => setActiveTopic(null);

  // Solo: clicking a subject isolates it (every other subject becomes hidden);
  // clicking the already-soloed subject again restores all subjects. Clicking a
  // different subject switches the solo. This is what "click show nodes and
  // related edges only" means — once isolated, the 3D canvas naturally shows
  // only that subject's nodes and the edges between them (its edge filter keeps
  // an edge only when both endpoints are visible).
  const soloSubject = (subject: string) => {
    setIsolatedSubject((prev) => (prev === subject ? null : subject));
  };

  const setHudTab = (tab: HudTab) => setActiveHudTab(tab);
  const toggleAutoRotate = () => setAutoRotate((v) => !v);
  const resetView = () => setAutoRotate(false);

  // selectCurriculum pairs slug selection with collapsing the expanded
  // standard — these must stay together, so the invariant lives in the
  // action, not at the call site (matching the selectTopic precedent).
  const selectCurriculum = (slug: string) => {
    setSelectedCurriculumSlug(slug);
    setExpandedStandardKey(null);
  };

  const toggleEvidence = (index: number) => {
    setCheckedEvidence((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // --- Derived data --------------------------------------------------------
  // The effective hidden-subjects set the 3D canvas consumes. When a subject is
  // isolated, every other subject is hidden; otherwise nothing is hidden.
  const hiddenSubjects = useMemo(() => {
    if (!isolatedSubject) return new Set<string>();
    return new Set(
      Object.keys(SUBJECT_COLORS).filter((s) => s !== isolatedSubject)
    );
  }, [isolatedSubject]);

  const subjectStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const t of topicsList) {
      stats[t.subject] = (stats[t.subject] || 0) + 1;
    }
    return Object.entries(stats)
      .map(([name, count]) => ({
        name,
        count,
        color: subjectColorUtil(name),
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  const filteredCatalogTopics = useMemo(() => {
    return topicsList.filter((t) => {
      const matchesSearch =
        catalogSearchTerm.trim() === "" ||
        t.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
        t.description
          .toLowerCase()
          .includes(catalogSearchTerm.toLowerCase()) ||
        t.domain.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(catalogSearchTerm.toLowerCase());

      const matchesSubject =
        catalogSelectedSubject === "" || t.subject === catalogSelectedSubject;
      const matchesAge =
        catalogSelectedAge === "" ||
        (t.ageRangeStart <= catalogSelectedAge &&
          t.ageRangeEnd >= catalogSelectedAge);

      return matchesSearch && matchesSubject && matchesAge;
    });
  }, [catalogSearchTerm, catalogSelectedSubject, catalogSelectedAge]);

  const activeCurriculum = useMemo(
    () => curriculaList.find((c) => c.slug === selectedCurriculumSlug),
    [selectedCurriculumSlug]
  );

  const filteredStandards = useMemo(() => {
    if (!activeCurriculum) return [];
    return activeCurriculum.topics.filter((s) => {
      const title = s.data?.title || "";
      const desc = s.data?.description || "";
      const matchText = `${s.code} ${title} ${desc}`.toLowerCase();
      return (
        standardsSearchTerm.trim() === "" ||
        matchText.includes(standardsSearchTerm.toLowerCase())
      );
    });
  }, [activeCurriculum, standardsSearchTerm]);

  // --- Value ---------------------------------------------------------------
  const value = useMemo<ExplorerContextValue>(
    () => ({
      state: {
        activeTopic,
        hiddenSubjects,
        isolatedSubject,
        activeHudTab,
        autoRotate,
        catalogSearchTerm,
        catalogSelectedSubject,
        catalogSelectedAge,
        selectedCurriculumSlug,
        standardsSearchTerm,
        expandedStandardKey,
        checkedEvidence,
        childName,
      },
      actions: {
        selectTopic,
        deselectTopic,
        soloSubject,
        setHudTab,
        toggleAutoRotate,
        resetView,
        setCatalogSearchTerm,
        setCatalogSelectedSubject,
        setCatalogSelectedAge,
        selectCurriculum,
        setStandardsSearchTerm,
        setExpandedStandardKey,
        toggleEvidence,
        setChildName,
      },
      meta: {
        subjectColor: subjectColorUtil,
        subjectNames: Object.keys(SUBJECT_COLORS),
      },
      derived: {
        subjectStats,
        filteredCatalogTopics,
        curriculaList,
        activeCurriculum,
        filteredStandards,
      },
    }),
    [
      activeTopic,
      isolatedSubject,
      hiddenSubjects,
      activeHudTab,
      autoRotate,
      catalogSearchTerm,
      catalogSelectedSubject,
      catalogSelectedAge,
      selectedCurriculumSlug,
      standardsSearchTerm,
      expandedStandardKey,
      checkedEvidence,
      childName,
      subjectStats,
      filteredCatalogTopics,
      activeCurriculum,
      filteredStandards,
    ]
  );

  return (
    <ExplorerContext value={value}>{children}</ExplorerContext>
  );
}

/** Consume the explorer context. React 19 `use()` (rule 4.1). */
export function useExplorer(): ExplorerContextValue {
  const ctx = use(ExplorerContext);
  if (!ctx) {
    throw new Error(
      "useExplorer must be used within an <ExplorerProvider>"
    );
  }
  return ctx;
}
