import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Play, Pause, LocateFixed } from "lucide-react";
import { Topic } from "../types";
import {
  topicsList,
  dependenciesList,
  getTransitivePrerequisites,
  getTransitiveSequels,
  prereqAdjacencyList,
  unlockAdjacencyList,
} from "../dataLoader";
import { SUBJECT_COLORS, subjectColor, STATE_COLORS } from "../theme/subjectColors";
import {
  POINTS_VERTEX_SHADER,
  POINTS_FRAGMENT_SHADER,
} from "../three/shaders";
import { funnelRadius, FUNNEL_Y_MIN, FUNNEL_Y_MAX } from "../three/graphLayout";

interface ThreeDGraphCanvasProps {
  activeTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  onDeselectTopic?: () => void;
  hiddenSubjects: Set<string>;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onResetView: () => void;
}

// How long the cursor must rest on a node before the hover card appears.
const HOVER_DWELL_MS = 120;
// Gap between the anchor node and the hover card, in CSS pixels.
const TOOLTIP_GAP_PX = 14;
// Per-frame scale applied to the hover-card reveal — origin-aware, so the
// card grows out of the node it describes rather than from its own center.
const TOOLTIP_REVEAL_SCALE = 0.96;

// --- Camera / interaction constants (OrbitControls) ---
const DEFAULT_CAMERA_DISTANCE = 400;
const FRAMING_CAMERA_DISTANCE = 336; // matches the old targetZoom=2.2 visual
const CLICK_THRESHOLD_SQ = 36; // 6px displacement squared
const TAP_RADIUS_SQ_DESKTOP = 256; // 16px hover/click radius squared
const TAP_RADIUS_SQ_TOUCH = 1600; // 40px touch tap radius squared
const TAP_MAX_DURATION_MS = 350;

// Reduced-motion: once the user has seen one tooltip, subsequent hovers on
// adjacent nodes skip the dwell so the whole canvas feels instant. Reset on
// pointer leave so re-entering starts fresh.

/**
 * Frame-rate-independent exponential damping. Converts a "smoothing factor"
 * designed for 60fps (the old per-frame `+= (t-x)*k` lerps) into a lerp whose
 * effective duration is the same wall-clock time at any frame rate.
 *
 *   damp(cur, target, k60, dt)
 *
 * where k60 is the legacy 60fps factor (e.g. 0.08 → ~370ms to half) and dt is
 * the seconds elapsed since the last frame. At 60fps this is identical to the
 * old `cur += (target-cur)*k60`; at 120fps it advances half as far per frame,
 * so the animation takes the same real time and doesn't feel ~2× faster.
 */
function damp(current: number, target: number, k60: number, dt: number): number {
  return current + (target - current) * (1 - Math.pow(1 - k60, dt * 60));
}

// prefers-reduced-motion: checked once at setup. Auto-rotate and the two
// oscillating pulses (selection ring + shader selPulse) are gated on this;
// size/opacity transitions are kept because they aid comprehension, which is
// the reduced-motion best practice (fewer/gentler, not zero).
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// State colors as plain RGB float triples for fast per-node lerp.
const RGB_PRIMARY = new THREE.Color(STATE_COLORS.primary);
const RGB_BRANCH = new THREE.Color(STATE_COLORS.branch);
const RGB_TERMINAL = new THREE.Color(STATE_COLORS.terminal);

// Pure placement decision for the tooltip card: prefer above the anchor node,
// flip below if it would clip the top edge and there's room beneath, and clamp
// horizontally so it stays within the canvas. Has no DOM or ref dependencies —
// extracted from the render loop so it stays testable and the loop stays lean.
function placeTooltip(
  anchorX: number,
  anchorY: number,
  cardW: number,
  cardH: number,
  viewW: number,
  viewH: number
): { left: number; top: number; transform: string } {
  const placeBelow = anchorY - TOOLTIP_GAP_PX - cardH < 0
    && anchorY + TOOLTIP_GAP_PX + cardH <= viewH;
  const left = Math.max(cardW / 2, Math.min(viewW - cardW / 2, anchorX));
  return {
    left,
    top: anchorY + (placeBelow ? TOOLTIP_GAP_PX : -TOOLTIP_GAP_PX),
    transform: placeBelow ? "translate(-50%, 0%)" : "translate(-50%, -100%)"
  };
}

export default function ThreeDGraphCanvas({
  activeTopic,
  onSelectTopic,
  onDeselectTopic,
  hiddenSubjects,
  autoRotate,
  onToggleAutoRotate,
  onResetView
}: ThreeDGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Labels refs for absolute positioned HTML HUD elements
  const labelBottomRef = useRef<HTMLDivElement>(null);
  const labelMiddleRef = useRef<HTMLDivElement>(null);
  const labelTopRef = useRef<HTMLDivElement>(null);

  // Floating tooltip ref
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Sub-elements of the hover card, written imperatively each frame.
  const tooltipDotRef = useRef<HTMLSpanElement>(null);
  const tooltipMetaRef = useRef<HTMLSpanElement>(null);
  const tooltipTitleRef = useRef<HTMLDivElement>(null);
  const tooltipDescRef = useRef<HTMLDivElement>(null);

  // OrbitControls + interaction refs
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointerActiveRef = useRef(false);
  const onSelectTopicRef = useRef(onSelectTopic);
  const framingAnimRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetCamPos: THREE.Vector3;
    targetDist: number;
  }>({ active: false, targetPos: new THREE.Vector3(0, -25, 0), targetCamPos: new THREE.Vector3(0, 0, DEFAULT_CAMERA_DISTANCE), targetDist: DEFAULT_CAMERA_DISTANCE });

  const lastInteractionTime = useRef(Date.now());

  // Hover-intent dwell: record the candidate node + the timestamp it first
  // became a candidate, and only commit the hover after a short dwell. This
  // kills the text-strobe when sweeping a dense cluster without adding
  // perceptible latency on a real stop.
  const hoverDwellRef = useRef<{ id: string | null; since: number }>({ id: null, since: 0 });
  // Once a tooltip has shown this session, subsequent hovers on adjacent nodes
  // skip the dwell delay so the toolbar/canvas feels instant. Reset on
  // pointerleave so re-entering starts the first dwell again.
  const tooltipOpenedRef = useRef(false);

  // Hover state
  const [hoveredTopic, setHoveredTopic] = useState<Topic | null>(null);
  // Touch-pinned topic: the node a mobile tap selected. Unlike hover, this
  // persists until the next pan, empty-tap, or deselect.
  const [touchPinnedTopic, setTouchPinnedTopic] = useState<Topic | null>(null);

  // Calculate connection counts for centrality
  const nodeCentrality = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dep of dependenciesList) {
      counts.set(dep.topicId, (counts.get(dep.topicId) || 0) + 1);
      counts.set(dep.prerequisiteId, (counts.get(dep.prerequisiteId) || 0) + 1);
    }
    return counts;
  }, []);

  // Find unique domains per subject to create distinct sub-clusters
  const subjectDomains = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of topicsList) {
      if (!map[t.subject]) {
        map[t.subject] = [];
      }
      if (!map[t.subject].includes(t.domain)) {
        map[t.subject].push(t.domain);
      }
    }
    // Sort domains for stable index assignment
    for (const sub of Object.keys(map)) {
      map[sub].sort();
    }
    return map;
  }, []);

  // Pre-generate stable 3D coordinates for all nodes forming a tapered funnel.
  // Vertical (Y) = age progression; radial (X & Z) = power-law funnel so the
  // structure is narrow at the foundation (age 4) and flares toward the
  // specialization canopy (age 15+). Subject arms + spiral twist + domain
  // sub-sectors distribute nodes angularly around the central Y-axis.
  const nodes = useMemo(() => {
    return topicsList.map((topic, index) => {
      const age = topic.ageRangeStart || 4;

      // Vertical Y axis maps directly to age: bottom is age 4 (-120), top is age 15 (+120)
      const normalizedY = ((age - 4) / 11 - 0.5) * 240;

      // Subjects occupy distinct angular arms wrapping around the central axis
      const subjectsKeys = Object.keys(SUBJECT_COLORS);
      const subIdx = subjectsKeys.indexOf(topic.subject);
      const armAngle = subIdx !== -1 ? (subIdx / subjectsKeys.length) * Math.PI * 2 : 0;

      // Funnel twist: spiral as it goes up
      const spiralTurn = (age - 4) * 0.42;

      // Group domains into tight angular sub-clusters within the subject's arm
      const domainsListForSub = subjectDomains[topic.subject] || [];
      const domIdx = domainsListForSub.indexOf(topic.domain);
      const domAngleOffset = domainsListForSub.length > 1
        ? ((domIdx / (domainsListForSub.length - 1)) - 0.5) * 0.95
        : 0;

      const baseTheta = armAngle + spiralTurn + domAngleOffset;

      // Tapered funnel radius via power law: r(y) = R_floor + R_max * (y_local/H)^1.2
      const r = funnelRadius(normalizedY);

      // Modest deterministic jitter for organic clustering (cleaner than the
      // old lightning-spine offset — the funnel is axially symmetric).
      const dispersion = Math.max(0.6, (age - 4) * 0.9);
      const hashX = Math.sin(index * 17.5) * dispersion;
      const hashY = Math.cos(index * 29.2) * (dispersion * 0.18);
      const hashZ = Math.sin(index * 41.9) * dispersion;

      // Node sizing: centrality-scaled, but kept small/subtle for the
      // minimalist dot aesthetic (inactive nodes must read as tiny points).
      const connectionCount = nodeCentrality.get(topic.id) || 0;
      const baseRadius = 1.8 + Math.pow(connectionCount, 0.6) * 1.2;
      const isMilestone = connectionCount >= 8;

      return {
        topic,
        x: r * Math.cos(baseTheta) + hashX,
        y: normalizedY + hashY,
        z: r * Math.sin(baseTheta) + hashZ,
        color: subjectColor(topic.subject),
        baseRadius,
        isMilestone,
        age
      };
    });
  }, [nodeCentrality, subjectDomains]);

  // Map of active nodes (for fast O(1) checks)
  const activeNodesMap = useMemo(() => {
    const map = new Map<string, typeof nodes[0]>();
    for (const node of nodes) {
      if (!hiddenSubjects.has(node.topic.subject)) {
        map.set(node.topic.id, node);
      }
    }
    return map;
  }, [nodes, hiddenSubjects]);

  // Selected prerequisite + sequel sub-DAG, with role classification for the
  // diverging color story (white = primary focus, blue = active branch,
  // rose = deepest terminal branches). Also computes terminal leaf nodes.
  const selectionGraph = useMemo(() => {
    if (!activeTopic) {
      return {
        relatedIds: new Set<string>(),
        prereqIds: new Set<string>(),
        sequelIds: new Set<string>(),
        terminalIds: new Set<string>(),
      };
    }
    const prereqs = getTransitivePrerequisites(activeTopic.id);
    const sequels = getTransitiveSequels(activeTopic.id);
    const prereqIds = new Set(prereqs.map(p => p.topic.id));
    const sequelIds = new Set(sequels.map(s => s.topic.id));
    prereqIds.add(activeTopic.id);
    sequelIds.add(activeTopic.id);
    const relatedIds = new Set([...prereqIds, ...sequelIds]);

    // Terminal leaves: prereq nodes with no prerequisites of their own, and
    // sequel nodes that unlock nothing further. These are the "deepest
    // terminal branches" rendered in muted rose.
    const terminalIds = new Set<string>();
    for (const id of prereqIds) {
      if (id === activeTopic.id) continue;
      const deps = prereqAdjacencyList.get(id);
      if (!deps || deps.length === 0) terminalIds.add(id);
    }
    for (const id of sequelIds) {
      if (id === activeTopic.id) continue;
      const unlocks = unlockAdjacencyList.get(id);
      if (!unlocks || unlocks.length === 0) terminalIds.add(id);
    }

    return { relatedIds, prereqIds, sequelIds, terminalIds };
  }, [activeTopic]);

  // Fast id -> node lookup for selection ring tracking in the render loop.
  const nodeByTopicId = useMemo(() => {
    const map = new Map<string, typeof nodes[0]>();
    for (const node of nodes) map.set(node.topic.id, node);
    return map;
  }, [nodes]);

  // Screen space projected coordinates ref, updated on every frame
  const projectedCoordsRef = useRef<Array<{
    topic: Topic;
    sx: number;
    sy: number;
    zDepth: number;
    color: string;
    baseRadius: number;
    isMilestone: boolean;
  }>>([]);

  // WebGL stable object references for updates and cleanups
  const pointsGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const pointsMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const hardEdgesGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const softEdgesGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const backgroundSoftLinesRef = useRef<THREE.LineSegments | null>(null);
  const activeHardGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const activeSoftGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const activeSoftLinesRef = useRef<THREE.LineSegments | null>(null);
  const activeHardMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const activeSoftMaterialRef = useRef<THREE.LineDashedMaterial | null>(null);
  const hardEdgesMaterialRef = useRef<THREE.LineBasicMaterial | null>(null);
  const softEdgesMaterialRef = useRef<THREE.LineDashedMaterial | null>(null);
  const activeEdgesRef = useRef<Array<{
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    mid: { x: number; y: number; z: number };
    color: THREE.Color;
    subject: string;
  }>>([]);

  // Refs for core Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const graphGroupRef = useRef<THREE.Group | null>(null);
  // Double-ring selection outline: two concentric billboarded rings tracking
  // the selected node's world position. Parented to the scene (not graphGroup)
  // so they don't inherit graph rotation; repositioned imperatively.
  const selectionRingInnerRef = useRef<THREE.Mesh | null>(null);
  const selectionRingOuterRef = useRef<THREE.Mesh | null>(null);
  const selectionRingOpacityRef = useRef(0);

  // Mouse hover tracking (vsync-throttled hover)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Animated state refs for smooth transitions
  const animatedSizesRef = useRef<Float32Array | null>(null);
  const animatedAlphasRef = useRef<Float32Array | null>(null);
  const animatedSelectedRef = useRef<Float32Array | null>(null);
  const animatedColorsRef = useRef<Float32Array | null>(null);

  // Sync reactive properties into refs for render loop access without re-instantiation
  const activeTopicRef = useRef(activeTopic);
  const hoveredTopicRef = useRef(hoveredTopic);
  const touchPinnedTopicRef = useRef(touchPinnedTopic);
  const tooltipDimsRef = useRef<{ id: string; w: number; h: number } | null>(null);
  // Animated reveal scale for the hover card. Decays toward 1 (fully open)
  // over a few frames whenever a card is showing; resets to the reveal start
  // when the card hides so the next reveal grows out of its node again.
  const tooltipScaleRef = useRef(1);
  const hiddenSubjectsRef = useRef(hiddenSubjects);
  const nodesRef = useRef(nodes);
  const selectionGraphRef = useRef(selectionGraph);
  const autoRotateRef = useRef(autoRotate);
  const onDeselectRef = useRef(onDeselectTopic);
  const nodeByTopicIdRef = useRef<Map<string, typeof nodes[0]>>(new Map());

  useEffect(() => {
    activeTopicRef.current = activeTopic;
    hoveredTopicRef.current = hoveredTopic;
    touchPinnedTopicRef.current = touchPinnedTopic;
    hiddenSubjectsRef.current = hiddenSubjects;
    nodesRef.current = nodes;
    selectionGraphRef.current = selectionGraph;
    autoRotateRef.current = autoRotate;
    onDeselectRef.current = onDeselectTopic;
    nodeByTopicIdRef.current = nodeByTopicId;
    onSelectTopicRef.current = onSelectTopic;
  }, [activeTopic, hoveredTopic, touchPinnedTopic, hiddenSubjects, nodes, selectionGraph, autoRotate, onDeselectTopic, nodeByTopicId, onSelectTopic]);

  // Clear the touch-pinned card whenever the selection is cleared by any path
  useEffect(() => {
    if (activeTopic === null) setTouchPinnedTopic(null);
  }, [activeTopic]);

  // Precompute per-node subject colors as THREE.Color for the color lerp.
  const colorCache = useMemo(() => nodes.map(node => new THREE.Color(node.color)), [nodes]);

  // High-performance CPU update for size/alpha/color/selected attributes,
  // transitioning values smoothly. Colors lerp between the subject color
  // (default) and the state-based diverging palette (on selection).
  // `dt` is seconds since the last frame for frame-rate-independent damping;
  // when omitted (e.g. the one-shot useEffect kick on state change) a single
  // 60fps step is used, which is plenty for a kick.
  const updateNodeAttributes = (forceImmediate = false, dt?: number) => {
    const geometry = pointsGeometryRef.current;
    if (!geometry) return;

    const sizes = geometry.attributes.aSize.array as Float32Array;
    const alphas = geometry.attributes.aAlpha.array as Float32Array;
    const selectedAttr = geometry.attributes.aSelected.array as Float32Array;
    const colorAttr = geometry.attributes.aColor.array as Float32Array;

    const currentActiveTopic = activeTopicRef.current;
    const currentHiddenSubjects = hiddenSubjectsRef.current;
    const currentHoveredTopic = hoveredTopicRef.current;
    const currentSelection = selectionGraphRef.current;
    const currentNodes = nodesRef.current;

    const isTopicSelected = !!currentActiveTopic;

    if (!animatedSizesRef.current || animatedSizesRef.current.length !== currentNodes.length) {
      animatedSizesRef.current = new Float32Array(currentNodes.length);
      animatedAlphasRef.current = new Float32Array(currentNodes.length);
      animatedSelectedRef.current = new Float32Array(currentNodes.length);
      animatedColorsRef.current = new Float32Array(currentNodes.length * 3);
      forceImmediate = true;
    }

    const animatedSizes = animatedSizesRef.current;
    const animatedAlphas = animatedAlphasRef.current;
    const animatedSelected = animatedSelectedRef.current;
    const animatedColors = animatedColorsRef.current;
    if (!animatedSizes || !animatedAlphas || !animatedSelected || !animatedColors) return;

    const selId = currentActiveTopic?.id;

    currentNodes.forEach((node, i) => {
      const isHidden = currentHiddenSubjects.has(node.topic.subject);

      let targetSize = node.baseRadius * 1.0;
      let targetAlpha = 0.6; // Default medium opacity
      let targetSelected = 0.0;
      // Default color: the node's muted subject color.
      let tr = colorCache[i].r;
      let tg = colorCache[i].g;
      let tb = colorCache[i].b;

      if (isHidden) {
        targetSize = 0.0;
        targetAlpha = 0.0;
        targetSelected = 0.0;
      } else {
        if (isTopicSelected) {
          const isSelected = selId === node.topic.id;
          const isTerminal = currentSelection.terminalIds.has(node.topic.id);
          const isRelated = currentSelection.relatedIds.has(node.topic.id);

          if (isSelected) {
            targetSize = node.baseRadius * 1.7;
            targetAlpha = 1.0;
            targetSelected = 1.0;
            tr = RGB_PRIMARY.r; tg = RGB_PRIMARY.g; tb = RGB_PRIMARY.b;
          } else if (isTerminal) {
            targetSize = node.baseRadius * 1.25;
            targetAlpha = 1.0;
            targetSelected = 5.0;
            tr = RGB_TERMINAL.r; tg = RGB_TERMINAL.g; tb = RGB_TERMINAL.b;
          } else if (isRelated) {
            targetSize = node.baseRadius * 1.2;
            targetAlpha = 1.0;
            targetSelected = 2.0;
            tr = RGB_BRANCH.r; tg = RGB_BRANCH.g; tb = RGB_BRANCH.b;
          } else {
            // Unrelated: near-invisible per spec §7. The selected sub-DAG
            // (primary white / branch blue / terminal rose, all at full
            // opacity) pops against a near-empty field; the faint residual
            // keeps just enough of the surrounding web for spatial reference.
            targetSize = node.baseRadius * 0.7;
            targetAlpha = 0.05;
            targetSelected = 3.0;
            tr = colorCache[i].r * 0.15;
            tg = colorCache[i].g * 0.15;
            tb = colorCache[i].b * 0.15;
          }
        }

        // Hover preview: show the subject color at a lifted opacity + bigger,
        // regardless of selection state. Hover is a preview; click reveals the
        // full prerequisite + sequel path.
        if (currentHoveredTopic && node.topic.id === currentHoveredTopic.id) {
          targetSize *= 1.3;
          targetAlpha = Math.max(targetAlpha, 0.7);
          tr = colorCache[i].r;
          tg = colorCache[i].g;
          tb = colorCache[i].b;
        }
      }

      if (forceImmediate) {
        animatedSizes[i] = targetSize;
        animatedAlphas[i] = targetAlpha;
        animatedSelected[i] = targetSelected;
        animatedColors[i * 3] = tr;
        animatedColors[i * 3 + 1] = tg;
        animatedColors[i * 3 + 2] = tb;
      } else {
        // Frame-rate-independent damping (0.2 @ 60fps reference). Keeps node
        // size/opacity/color transitions at the same wall-clock speed on any
        // display refresh rate.
        const k = 1 - Math.pow(1 - 0.2, (dt ?? 1 / 60) * 60);
        animatedSizes[i] += (targetSize - animatedSizes[i]) * k;
        animatedAlphas[i] += (targetAlpha - animatedAlphas[i]) * k;
        animatedSelected[i] += (targetSelected - animatedSelected[i]) * k;
        animatedColors[i * 3] += (tr - animatedColors[i * 3]) * k;
        animatedColors[i * 3 + 1] += (tg - animatedColors[i * 3 + 1]) * k;
        animatedColors[i * 3 + 2] += (tb - animatedColors[i * 3 + 2]) * k;
      }

      sizes[i] = animatedSizes[i];
      alphas[i] = animatedAlphas[i];
      selectedAttr[i] = animatedSelected[i];
      colorAttr[i * 3] = animatedColors[i * 3];
      colorAttr[i * 3 + 1] = animatedColors[i * 3 + 1];
      colorAttr[i * 3 + 2] = animatedColors[i * 3 + 2];
    });

    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aSelected.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
  };

  useEffect(() => {
    updateNodeAttributes();
  }, [nodes, activeTopic, hoveredTopic, hiddenSubjects, selectionGraph]);

  // Update background connections when subject visibility filters change
  useEffect(() => {
    const hardGeometry = hardEdgesGeometryRef.current;
    const softGeometry = softEdgesGeometryRef.current;
    if (!hardGeometry || !softGeometry) return;

    const hardPositions: number[] = [];
    const softPositions: number[] = [];

    for (const dep of dependenciesList) {
      const fromNode = activeNodesMap.get(dep.prerequisiteId);
      const toNode = activeNodesMap.get(dep.topicId);
      if (fromNode && toNode) {
        if (dep.strength === "soft") {
          softPositions.push(fromNode.x, fromNode.y, fromNode.z);
          softPositions.push(toNode.x, toNode.y, toNode.z);
        } else {
          hardPositions.push(fromNode.x, fromNode.y, fromNode.z);
          hardPositions.push(toNode.x, toNode.y, toNode.z);
        }
      }
    }

    hardGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hardPositions, 3));
    softGeometry.setAttribute("position", new THREE.Float32BufferAttribute(softPositions, 3));
    if (backgroundSoftLinesRef.current) {
      backgroundSoftLinesRef.current.computeLineDistances();
    }
  }, [activeNodesMap]);

  // Determine the role color of an active edge (prereq -> topic), both of which
  // are in the selected related sub-DAG.
  const edgeRoleColor = (
    prereqId: string,
    topicId: string,
    selId: string,
    terminalIds: Set<string>
  ): THREE.Color => {
    if (topicId === selId) return RGB_PRIMARY.clone(); // primary focus path into selected
    if (terminalIds.has(prereqId) || terminalIds.has(topicId)) return RGB_TERMINAL.clone();
    return RGB_BRANCH.clone();
  };

  // Update active prerequisite + sequel path lines when selected topic changes.
  // Active edges are bowed quadratic-bezier polylines (sampled into short
  // segments) so the trail reads as a connected, separable path. Each edge is
  // colored by its role (white / blue / rose) via per-vertex colors.
  const CURVE_SEGMENTS = 12;
  useEffect(() => {
    const hardGeometry = activeHardGeometryRef.current;
    const softGeometry = activeSoftGeometryRef.current;
    const hardMaterial = activeHardMaterialRef.current;
    const softMaterial = activeSoftMaterialRef.current;
    if (!hardGeometry || !softGeometry || !hardMaterial || !softMaterial) return;

    const hardPositions: number[] = [];
    const hardColors: number[] = [];
    const softPositions: number[] = [];
    const softColors: number[] = [];
    const activeEdgesList: Array<{
      from: { x: number; y: number; z: number };
      to: { x: number; y: number; z: number };
      mid: { x: number; y: number; z: number };
      color: THREE.Color;
      subject: string;
    }> = [];

    if (activeTopic) {
      const selId = activeTopic.id;
      const { relatedIds, terminalIds } = selectionGraph;
      for (const dep of dependenciesList) {
        const isRelatedPath = relatedIds.has(dep.topicId) && relatedIds.has(dep.prerequisiteId);
        if (isRelatedPath) {
          const fromNode = activeNodesMap.get(dep.prerequisiteId);
          const toNode = activeNodesMap.get(dep.topicId);
          if (fromNode && toNode) {
            const fx = fromNode.x, fy = fromNode.y, fz = fromNode.z;
            const tx = toNode.x, ty = toNode.y, tz = toNode.z;

            const mx = (fx + tx) / 2;
            const my = (fy + ty) / 2;
            const mz = (fz + tz) / 2;
            const radialLen = Math.hypot(mx, mz) || 1;
            const edgeLen = Math.hypot(tx - fx, ty - fy, tz - fz);
            const bow = Math.min(14, edgeLen * 0.18);
            const midX = mx + (mx / radialLen) * bow;
            const midY = my;
            const midZ = mz + (mz / radialLen) * bow;

            const roleColor = edgeRoleColor(dep.prerequisiteId, dep.topicId, selId, terminalIds);
            activeEdgesList.push({
              from: { x: fx, y: fy, z: fz },
              to: { x: tx, y: ty, z: tz },
              mid: { x: midX, y: midY, z: midZ },
              color: roleColor,
              subject: fromNode.topic.subject
            });

            let px = fx, py = fy, pz = fz;
            const targetPos = dep.strength === "soft" ? softPositions : hardPositions;
            const targetCol = dep.strength === "soft" ? softColors : hardColors;
            for (let s = 1; s <= CURVE_SEGMENTS; s++) {
              const t = s / CURVE_SEGMENTS;
              const u = 1 - t;
              const cx = u * u * fx + 2 * u * t * midX + t * t * tx;
              const cy = u * u * fy + 2 * u * t * midY + t * t * ty;
              const cz = u * u * fz + 2 * u * t * midZ + t * t * tz;
              targetPos.push(px, py, pz, cx, cy, cz);
              // Per-vertex color (both endpoints of the segment share the edge role color).
              targetCol.push(roleColor.r, roleColor.g, roleColor.b, roleColor.r, roleColor.g, roleColor.b);
              px = cx; py = cy; pz = cz;
            }
          }
        }
      }

      // Material color is white so vertex colors pass through unchanged.
      hardMaterial.color.set(0xffffff);
      softMaterial.color.set(0xffffff);
    }

    activeEdgesRef.current = activeEdgesList;
    hardGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hardPositions, 3));
    hardGeometry.setAttribute("color", new THREE.Float32BufferAttribute(hardColors, 3));
    softGeometry.setAttribute("position", new THREE.Float32BufferAttribute(softPositions, 3));
    softGeometry.setAttribute("color", new THREE.Float32BufferAttribute(softColors, 3));
    if (activeSoftLinesRef.current) {
      activeSoftLinesRef.current.computeLineDistances();
    }
  }, [activeTopic, selectionGraph, activeNodesMap]);

  // Smoothly frame the camera on the selected node via the framing animation
  // (lerp controls.target + camera position in the render loop). The camera
  // orbits to the same side of the funnel as the node so it's always visible,
  // even when the node was on the back side before selection.
  useEffect(() => {
    if (activeTopic) {
      const node = nodes.find(n => n.topic.id === activeTopic.id);
      if (node) {
        const nodePos = new THREE.Vector3(node.x, node.y, node.z);
        // Direction from the funnel's central Y-axis outward through the node.
        // Positioning the camera along this ray puts it on the same side as
        // the node, guaranteeing the node faces the camera.
        const radialDir = new THREE.Vector3(node.x, 0, node.z);
        if (radialDir.lengthSq() < 0.01) {
          // Node is on the central axis — keep the current view direction.
          radialDir.set(0, 0, 1);
        }
        radialDir.normalize();
        // Preserve a similar elevation to the current camera angle.
        const camPos = nodePos.clone().add(
          radialDir.multiplyScalar(FRAMING_CAMERA_DISTANCE)
        );
        // Lift the camera slightly above the node for a natural 3/4 view.
        camPos.y += 30;
        framingAnimRef.current = {
          active: true,
          targetPos: nodePos,
          targetCamPos: camPos,
          targetDist: FRAMING_CAMERA_DISTANCE,
        };
      }
    } else {
      framingAnimRef.current = {
        active: true,
        targetPos: new THREE.Vector3(0, -25, 0),
        targetCamPos: new THREE.Vector3(0, 0, DEFAULT_CAMERA_DISTANCE),
        targetDist: DEFAULT_CAMERA_DISTANCE,
      };
    }
  }, [activeTopic, nodes]);

  // Setup WebGL scene, camera, renderer and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = containerRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
    const width = rect.width;
    const height = rect.height;

    // --- 1. SCENE & WEBGL RENDERER ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    // Compute initial camera position by inverting the former graph rotation
    // (Euler(-0.3, 0.6, 0, "YXZ")) so the initial 3/4 view is preserved.
    const initialEuler = new THREE.Euler(-0.3, 0.6, 0, "YXZ");
    const initialRotMat = new THREE.Matrix4().makeRotationFromEuler(initialEuler).invert();
    camera.position.set(0, 0, DEFAULT_CAMERA_DISTANCE).applyMatrix4(initialRotMat);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x0b0e14, 1.0);
    rendererRef.current = renderer;

    // Main group holding all graph entities. With OrbitControls the graph
    // stays at the origin — the camera orbits instead of the group rotating.
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);
    graphGroupRef.current = graphGroup;

    // --- 2. ORBIT CONTROLS ---
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 120;
    controls.maxDistance = 800;
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI - 0.1;
    controls.autoRotateSpeed = 0.2;
    controls.rotateSpeed = 0.45;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.7;
    controls.screenSpacePanning = true;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    // Target slightly below center so the funnel sits in the lower portion of
    // the viewport, leaving room at the top for the brand overlay.
    controls.target.set(0, -25, 0);
    controls.update();
    controlsRef.current = controls;

    // --- 3. REFERENCE RINGS (muted diverging palette, very faint) ---
    const createRingGeometry = (r: number) => {
      const points: THREE.Vector3[] = [];
      const segments = 96;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta)));
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    };

    const ringsConfig = [
      { r: funnelRadius(FUNNEL_Y_MIN), y: FUNNEL_Y_MIN, color: 0x1e293b, opacity: 0.12 },
      { r: funnelRadius(0), y: 0, color: 0x1d4ed8, opacity: 0.10 },
      { r: funnelRadius(FUNNEL_Y_MAX), y: FUNNEL_Y_MAX, color: 0x60a5fa, opacity: 0.10 },
    ];

    const ringsData = ringsConfig.map(cfg => {
      const geo = createRingGeometry(cfg.r);
      const mat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        depthWrite: false,
      });
      const line = new THREE.LineLoop(geo, mat);
      line.position.y = cfg.y;
      graphGroup.add(line);
      return { geometry: geo, material: mat, line };
    });

    // Outward-curving guided orbit path at the top boundary — references
    // "Specialization". A faint, slightly larger elliptical curve above the
    // top ring, drawn in muted rose so it reads as the warm/specialized limit.
    const orbitPoints: THREE.Vector3[] = [];
    const orbitR = funnelRadius(FUNNEL_Y_MAX) * 1.12;
    const orbitSegments = 128;
    for (let i = 0; i <= orbitSegments; i++) {
      const theta = (i / orbitSegments) * Math.PI * 2;
      // Gentle outward undulation to suggest a curving orbit, not a flat ring.
      const ripple = 1 + 0.04 * Math.sin(theta * 3.0);
      orbitPoints.push(new THREE.Vector3(
        orbitR * ripple * Math.cos(theta),
        FUNNEL_Y_MAX + 6,
        orbitR * ripple * Math.sin(theta)
      ));
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({
      color: 0xfb7185,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    graphGroup.add(orbitLine);

    // --- 4. BACKGROUND CONNECTIONS (ultra-faint spiderweb) ---
    const hardEdgesGeometry = new THREE.BufferGeometry();
    const softEdgesGeometry = new THREE.BufferGeometry();

    const hardEdgesMaterial = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const softEdgesMaterial = new THREE.LineDashedMaterial({
      color: 0x334155,
      dashSize: 4,
      gapSize: 4,
      transparent: true,
      opacity: 0.04,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const backgroundHardLines = new THREE.LineSegments(hardEdgesGeometry, hardEdgesMaterial);
    const backgroundSoftLines = new THREE.LineSegments(softEdgesGeometry, softEdgesMaterial);
    graphGroup.add(backgroundHardLines);
    graphGroup.add(backgroundSoftLines);

    hardEdgesGeometryRef.current = hardEdgesGeometry;
    softEdgesGeometryRef.current = softEdgesGeometry;
    backgroundSoftLinesRef.current = backgroundSoftLines;
    hardEdgesMaterialRef.current = hardEdgesMaterial;
    softEdgesMaterialRef.current = softEdgesMaterial;

    // --- 5. ACTIVE CONNECTIONS (role-colored prerequisite + sequel paths) ---
    const activeHardGeometry = new THREE.BufferGeometry();
    const activeSoftGeometry = new THREE.BufferGeometry();

    const activeHardMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      linewidth: 1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
    });

    const activeSoftMaterial = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 5,
      gapSize: 5,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
    });

    const activeHardLines = new THREE.LineSegments(activeHardGeometry, activeHardMaterial);
    const activeSoftLines = new THREE.LineSegments(activeSoftGeometry, activeSoftMaterial);
    activeHardLines.renderOrder = 4;
    activeSoftLines.renderOrder = 4;
    graphGroup.add(activeHardLines);
    graphGroup.add(activeSoftLines);

    activeHardGeometryRef.current = activeHardGeometry;
    activeSoftGeometryRef.current = activeSoftGeometry;
    activeSoftLinesRef.current = activeSoftLines;
    activeHardMaterialRef.current = activeHardMaterial;
    activeSoftMaterialRef.current = activeSoftMaterial;

    // --- 6. NODES (glowing vector dots, additive blending) ---
    const pointsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const alphas = new Float32Array(nodes.length);
    const selectedAttr = new Float32Array(nodes.length);

    nodes.forEach((node, i) => {
      positions[i * 3] = node.x;
      positions[i * 3 + 1] = node.y;
      positions[i * 3 + 2] = node.z;
    });

    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    pointsGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    pointsGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    pointsGeometry.setAttribute("aSelected", new THREE.BufferAttribute(selectedAttr, 1));

    pointsGeometryRef.current = pointsGeometry;

    const pointsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZoom: { value: 1.85 },
        uScale: { value: 1.0 },
        uGlobalAlpha: { value: 1.0 },
        uTime: { value: 0.0 },
        uReducedMotion: { value: prefersReducedMotion ? 1.0 : 0.0 },
      },
      vertexShader: POINTS_VERTEX_SHADER,
      fragmentShader: POINTS_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    pointsMaterialRef.current = pointsMaterial;

    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    points.renderOrder = 1;
    graphGroup.add(points);

    // --- 7. DOUBLE-RING SELECTION OUTLINE ---
    // Two concentric billboarded rings tracking the selected node. Added to
    // the scene (not graphGroup) so they don't inherit graph rotation.
    const innerRingGeo = new THREE.RingGeometry(4.0, 4.6, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const selectionRingInner = new THREE.Mesh(innerRingGeo, innerRingMat);
    selectionRingInner.visible = false;
    selectionRingInner.renderOrder = 5;
    scene.add(selectionRingInner);
    selectionRingInnerRef.current = selectionRingInner;

    const outerRingGeo = new THREE.RingGeometry(7.0, 7.4, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const selectionRingOuter = new THREE.Mesh(outerRingGeo, outerRingMat);
    selectionRingOuter.visible = false;
    selectionRingOuter.renderOrder = 5;
    scene.add(selectionRingOuter);
    selectionRingOuterRef.current = selectionRingOuter;

    // --- 8. ANIMATION FRAME LOOP ---
    let animationFrameId = 0;

    // Reusable scratch object for the render loop (avoid per-frame allocation).
    const ringWorldPos = new THREE.Vector3();

    // Last frame timestamp for frame-rate-independent damping. clamped so a
    // backgrounded tab (huge dt) doesn't fast-forward the animation.
    let lastFrameTime = performance.now();

    const render = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;
      // --- Framing animation (smooth target + camera orbit transitions) ---
      const framing = framingAnimRef.current;
      if (framing.active && !pointerActiveRef.current) {
        // 0.08 → ~370ms half-life at 60fps; damp() keeps that constant across
        // frame rates. Under reduced motion we snap instead of easing, since
        // this is a camera move (position animation).
        if (prefersReducedMotion) {
          controls.target.copy(framing.targetPos);
          camera.position.copy(framing.targetCamPos);
          framing.active = false;
        } else {
          controls.target.lerp(framing.targetPos, 1 - Math.pow(1 - 0.08, dt * 60));
          camera.position.lerp(framing.targetCamPos, 1 - Math.pow(1 - 0.08, dt * 60));
          if (controls.target.distanceTo(framing.targetPos) < 0.5 &&
              camera.position.distanceTo(framing.targetCamPos) < 1.0) {
            framing.active = false;
          }
        }
      }

      // --- Auto-rotate with idle gating ---
      // Disabled under reduced-motion: it's continuous positional motion the
      // user didn't initiate.
      controls.autoRotate = autoRotateRef.current
        && !prefersReducedMotion
        && !pointerActiveRef.current
        && (Date.now() - lastInteractionTime.current > 4000);

      controls.update();

      // uZoom is static (set once during setup) — perspective handles sizing.
      pointsMaterial.uniforms.uTime.value = performance.now() * 0.001;

      // graphGroup stays at identity — no rotation/position to set.
      graphGroup.updateMatrixWorld(true);

      // Update node attributes dynamically
      updateNodeAttributes(false, dt);

      // Project all coordinates to screen-space for hover tracking and HTML HUD positioning
      const tempV = new THREE.Vector3();
      const cssW = canvas.width / (window.devicePixelRatio || 1);
      const cssH = canvas.height / (window.devicePixelRatio || 1);

      // Edge opacity transitions
      const currentActiveTopic = activeTopicRef.current;
      const targetHardOpacity = currentActiveTopic ? 0.04 : 0.06;
      const targetSoftOpacity = currentActiveTopic ? 0.03 : 0.04;
      const targetActiveHardOpacity = currentActiveTopic ? 1.0 : 0.0;
      const targetActiveSoftOpacity = currentActiveTopic ? 1.0 : 0.0;

      if (hardEdgesMaterialRef.current) {
        hardEdgesMaterialRef.current.opacity = damp(hardEdgesMaterialRef.current.opacity, targetHardOpacity, 0.08, dt);
      }
      if (softEdgesMaterialRef.current) {
        softEdgesMaterialRef.current.opacity = damp(softEdgesMaterialRef.current.opacity, targetSoftOpacity, 0.08, dt);
      }
      if (activeHardMaterialRef.current) {
        activeHardMaterialRef.current.opacity = damp(activeHardMaterialRef.current.opacity, targetActiveHardOpacity, 0.08, dt);
      }
      if (activeSoftMaterialRef.current) {
        activeSoftMaterialRef.current.opacity = damp(activeSoftMaterialRef.current.opacity, targetActiveSoftOpacity, 0.08, dt);
      }

      projectedCoordsRef.current = nodesRef.current
        .filter(n => !hiddenSubjectsRef.current.has(n.topic.subject))
        .map(node => {
          tempV.set(node.x, node.y, node.z);
          tempV.applyMatrix4(graphGroup.matrixWorld);
          tempV.project(camera);

          const sx = (tempV.x * 0.5 + 0.5) * cssW;
          const sy = (-tempV.y * 0.5 + 0.5) * cssH;

          return {
            topic: node.topic,
            sx,
            sy,
            zDepth: tempV.z,
            color: node.color,
            baseRadius: node.baseRadius,
            isMilestone: node.isMilestone
          };
        });

      // Perform precise hover detection with camera depth priority
      if (mousePosRef.current) {
        const mouseX = mousePosRef.current.x;
        const mouseY = mousePosRef.current.y;
        let closestNode: typeof projectedCoordsRef.current[0] | null = null;
        let minDistanceSq = 16 * 16;
        let bestDepth = Infinity;

        for (const node of projectedCoordsRef.current) {
          const dx = mouseX - node.sx;
          const dy = mouseY - node.sy;
          const distSq = dx * dx + dy * dy;

          if (distSq < minDistanceSq) {
            if (node.zDepth < bestDepth) {
              bestDepth = node.zDepth;
              closestNode = node;
            }
          }
        }

        if (closestNode) {
          if (!pointerActiveRef.current && canvas.style.cursor !== "pointer") {
            canvas.style.cursor = "pointer";
          }
          const candId = closestNode.topic.id;
          const dwell = hoverDwellRef.current;
          if (dwell.id !== candId) {
            dwell.id = candId;
            dwell.since = performance.now();
            // Skip the dwell once a tooltip has shown this session: hovering
            // adjacent nodes reveals them instantly, making the whole canvas
            // feel fast without defeating the initial-entry delay.
            if (tooltipOpenedRef.current && hoveredTopicRef.current?.id !== candId) {
              setHoveredTopic(closestNode.topic);
            }
          } else if (hoveredTopicRef.current?.id !== candId && performance.now() - dwell.since >= HOVER_DWELL_MS) {
            setHoveredTopic(closestNode.topic);
            tooltipOpenedRef.current = true;
          }
        } else {
          hoverDwellRef.current = { id: null, since: 0 };
          if (hoveredTopicRef.current !== null) {
            setHoveredTopic(null);
          }
          if (!pointerActiveRef.current && canvas.style.cursor !== "grab") {
            canvas.style.cursor = "grab";
          }
        }
      }

      // --- Double-ring selection outline ---
      const ringInner = selectionRingInnerRef.current;
      const ringOuter = selectionRingOuterRef.current;
      if (ringInner && ringOuter) {
        const selTopic = activeTopicRef.current;
        const targetOpacity = selTopic ? 0.85 : 0.0;
        // Asymmetric: enter @0.12 (~250ms), exit @0.25 (~115ms, snappier).
        // System responds faster to deselection than to selection.
        const ringFactor = selTopic ? 0.12 : 0.25;
        selectionRingOpacityRef.current = damp(selectionRingOpacityRef.current, targetOpacity, ringFactor, dt);

        const ringNode = selTopic ? nodeByTopicIdRef.current.get(selTopic.id) : null;
        if (ringNode && selectionRingOpacityRef.current > 0.01) {
          ringWorldPos.set(ringNode.x, ringNode.y, ringNode.z);
          ringWorldPos.applyMatrix4(graphGroup.matrixWorld);
          // Pulse disabled under reduced-motion (constant 1.0); the opacity
          // fade-in and size lift still convey selection without oscillation.
          const pulse = prefersReducedMotion ? 1.0 : 1.0 + 0.1 * Math.sin(performance.now() * 0.004);
          const distScale = Math.max(0.6, Math.min(2.2, ringWorldPos.distanceTo(camera.position) / 220));
          const scale = pulse * distScale;

          for (const ring of [ringInner, ringOuter]) {
            ring.position.copy(ringWorldPos);
            ring.quaternion.copy(camera.quaternion);
            ring.scale.setScalar(scale);
            (ring.material as THREE.MeshBasicMaterial).opacity = selectionRingOpacityRef.current;
            ring.visible = true;
          }
        } else if (selectionRingOpacityRef.current < 0.01) {
          ringInner.visible = false;
          ringOuter.visible = false;
        }
      }

      // Update absolute HTML HUD ring labels positioning
      const updateRingLabel = (el: HTMLDivElement | null, rx: number, ry: number, rz: number, labelText: string) => {
        if (!el) return;
        tempV.set(rx, ry, rz);
        tempV.applyMatrix4(graphGroup.matrixWorld);
        tempV.project(camera);

        const sx = (tempV.x * 0.5 + 0.5) * cssW;
        const sy = (-tempV.y * 0.5 + 0.5) * cssH;

        if (tempV.z > 1.0) {
          el.style.display = "none";
        } else {
          el.style.display = "block";
          el.style.transform = `translate(${sx + 10}px, ${sy - 4}px)`;
          el.textContent = labelText;
        }
      };

      updateRingLabel(labelBottomRef.current, funnelRadius(FUNNEL_Y_MIN), FUNNEL_Y_MIN, 0, "FOUNDATION · AGE 4");
      updateRingLabel(labelMiddleRef.current, funnelRadius(0), 0, 0, "DEVELOPING · AGE 9");
      updateRingLabel(labelTopRef.current, funnelRadius(FUNNEL_Y_MAX), FUNNEL_Y_MAX, 0, "SPECIALIZATION · AGE 15");

      // Update hover detail card position + content. Card is always mounted;
      // opacity and position toggled imperatively from the render loop.
      const currentHovered = hoveredTopicRef.current ?? touchPinnedTopicRef.current;
      const tooltipEl = tooltipRef.current;
      if (tooltipEl) {
        if (currentHovered) {
          const proj = projectedCoordsRef.current.find(p => p.topic.id === currentHovered.id);
          if (proj) {
            const hoverColor = subjectColor(currentHovered.subject);
            if (tooltipDotRef.current) tooltipDotRef.current.style.backgroundColor = hoverColor;
            if (tooltipMetaRef.current && tooltipMetaRef.current.dataset.id !== currentHovered.id) {
              tooltipMetaRef.current.dataset.id = currentHovered.id;
              tooltipMetaRef.current.textContent = `${currentHovered.subject.toUpperCase()} · AGE ${currentHovered.ageRangeStart}–${currentHovered.ageRangeEnd}`;
            }
            if (tooltipTitleRef.current && tooltipTitleRef.current.dataset.id !== currentHovered.id) {
              tooltipTitleRef.current.dataset.id = currentHovered.id;
              tooltipTitleRef.current.textContent = currentHovered.name;
            }
            if (tooltipDescRef.current && tooltipDescRef.current.dataset.id !== currentHovered.id) {
              tooltipDescRef.current.dataset.id = currentHovered.id;
              tooltipDescRef.current.textContent = currentHovered.description || "";
            }

            let dims = tooltipDimsRef.current;
            if (!dims || dims.id !== currentHovered.id) {
              dims = { id: currentHovered.id, w: tooltipEl.offsetWidth, h: tooltipEl.offsetHeight };
              tooltipDimsRef.current = dims;
              // New target → restart the reveal from the scaled-down start so
              // the card grows out of its node.
              tooltipScaleRef.current = prefersReducedMotion ? 1 : TOOLTIP_REVEAL_SCALE;
            }
            const place = placeTooltip(proj.sx, proj.sy, dims.w, dims.h, cssW, cssH);
            // Ease the reveal scale toward 1 (open). ~150ms feel.
            tooltipScaleRef.current = damp(tooltipScaleRef.current, 1, 0.2, dt);
            tooltipEl.style.left = `${place.left}px`;
            tooltipEl.style.top = `${place.top}px`;
            // Compose the placement translate with an origin-aware scale: when
            // the card sits above the node it grows from its bottom edge
            // (toward the node); when below, from its top edge.
            const origin = place.transform === "translate(-50%, -100%)"
              ? "bottom center"
              : "top center";
            tooltipEl.style.transformOrigin = origin;
            tooltipEl.style.transform = `${place.transform} scale(${tooltipScaleRef.current.toFixed(3)})`;
            tooltipEl.style.opacity = "1";
          } else {
            tooltipEl.style.opacity = "0";
            tooltipDimsRef.current = null;
          }
        } else {
          tooltipEl.style.opacity = "0";
          tooltipDimsRef.current = null;
        }
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    // Handle high-performance resize observation
    const handleResize = () => {
      const parentRect = containerRef.current?.getBoundingClientRect();
      if (parentRect) {
        renderer.setSize(parentRect.width, parentRect.height, false);
        camera.aspect = parentRect.width / parentRect.height;
        camera.updateProjectionMatrix();
      }
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // --- Unified pointer listeners (selection coexists with OrbitControls) ---
    let pointerCount = 0;
    let multiTouch = false;
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;
    let pointerDownType = "";
    let pointerMovedDistSq = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerCount++;
      if (pointerCount === 1) {
        pointerActiveRef.current = true;
        multiTouch = false;
        pointerMovedDistSq = 0;
        pointerDownPos = { x: e.clientX, y: e.clientY };
        pointerDownTime = Date.now();
        pointerDownType = e.pointerType;
        mousePosRef.current = null;
        framingAnimRef.current.active = false;
        canvas.style.cursor = "grabbing";
      } else {
        multiTouch = true;
      }
      lastInteractionTime.current = Date.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      lastInteractionTime.current = Date.now();
      if (!pointerActiveRef.current) {
        const rect = canvas.getBoundingClientRect();
        mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        return;
      }
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      pointerMovedDistSq = dx * dx + dy * dy;
      if (pointerDownType === "touch" && pointerMovedDistSq >= 225 &&
          touchPinnedTopicRef.current) {
        setTouchPinnedTopic(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointerCount = Math.max(0, pointerCount - 1);
      if (pointerCount > 0) return;
      if (!pointerActiveRef.current) return;
      pointerActiveRef.current = false;
      lastInteractionTime.current = Date.now();
      canvas.style.cursor = "grab";

      if (multiTouch) return;
      if (pointerMovedDistSq >= CLICK_THRESHOLD_SQ) return;
      const isTouch = pointerDownType === "touch";
      if (isTouch && Date.now() - pointerDownTime >= TAP_MAX_DURATION_MS) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const radiusSq = isTouch ? TAP_RADIUS_SQ_TOUCH : TAP_RADIUS_SQ_DESKTOP;

      let closestNode: typeof projectedCoordsRef.current[0] | null = null;
      let minDistSq = radiusSq;
      let bestDepth = Infinity;
      for (const node of projectedCoordsRef.current) {
        const dx = x - node.sx;
        const dy = y - node.sy;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq && node.zDepth < bestDepth) {
          minDistSq = distSq;
          bestDepth = node.zDepth;
          closestNode = node;
        }
      }

      if (closestNode) {
        // Toggle: clicking the already-active node deselects it.
        if (activeTopicRef.current?.id === closestNode.topic.id) {
          onDeselectRef.current?.();
          if (isTouch) setTouchPinnedTopic(null);
        } else {
          onSelectTopicRef.current(closestNode.topic);
          if (isTouch) setTouchPinnedTopic(closestNode.topic);
        }
      } else {
        onDeselectRef.current?.();
        if (isTouch) setTouchPinnedTopic(null);
      }
    };

    const onPointerLeave = () => {
      mousePosRef.current = null;
      hoverDwellRef.current = { id: null, since: 0 };
      // Reset the dwell-skip so re-entering the canvas pays the initial
      // dwell once more (prevents an instant pop on re-entry).
      tooltipOpenedRef.current = false;
      setHoveredTopic(null);
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.style.cursor = "grab";

    render();

    // Clean up WebGL resources thoroughly to prevent GPU memory leaks
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);

      controls.dispose();

      pointsGeometry.dispose();
      pointsMaterial.dispose();

      hardEdgesGeometry.dispose();
      hardEdgesMaterial.dispose();

      softEdgesGeometry.dispose();
      softEdgesMaterial.dispose();

      activeHardGeometry.dispose();
      activeHardMaterial.dispose();

      activeSoftGeometry.dispose();
      activeSoftMaterial.dispose();

      for (const ring of ringsData) {
        ring.geometry.dispose();
        ring.material.dispose();
      }
      orbitGeometry.dispose();
      orbitMaterial.dispose();

      innerRingGeo.dispose();
      innerRingMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();

      renderer.dispose();
    };
  }, []);

  // Reset camera framing to the default overview.
  const handleResetView = () => {
    framingAnimRef.current = {
      active: true,
      targetPos: new THREE.Vector3(0, 0, 0),
      targetCamPos: new THREE.Vector3(0, 0, DEFAULT_CAMERA_DISTANCE),
      targetDist: DEFAULT_CAMERA_DISTANCE,
    };
    lastInteractionTime.current = Date.now();
    onResetView();
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden flex items-center justify-center select-none bg-[#0b0e14]"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive 3D map of 1,590 learning concepts. Each dot is a skill colored by subject. Vertical position shows age progression — age 4 at the bottom to age 15 at the top. Drag to orbit, scroll to zoom, and click a node to see its prerequisites. Click a selected node again to deselect. A full catalog and pathway view is in the sidebar."
        className="block touch-none"
        style={{ cursor: "grab" }}
      />

      {/* High-DPI, GPU-synchronized absolute positioned HUD ring labels.
          Serif italic, muted to match the diverging palette. */}
      <div ref={labelBottomRef} aria-hidden="true" className="absolute left-0 top-0 pointer-events-none text-[9px] select-none leading-none" style={{ display: "none", fontFamily: "var(--font-serif)", fontStyle: "italic", color: "rgba(148,163,184,0.5)" }} />
      <div ref={labelMiddleRef} aria-hidden="true" className="absolute left-0 top-0 pointer-events-none text-[9px] select-none leading-none" style={{ display: "none", fontFamily: "var(--font-serif)", fontStyle: "italic", color: "rgba(96,165,250,0.5)" }} />
      <div ref={labelTopRef} aria-hidden="true" className="absolute left-0 top-0 pointer-events-none text-[9px] select-none leading-none" style={{ display: "none", fontFamily: "var(--font-serif)", fontStyle: "italic", color: "rgba(251,113,133,0.5)" }} />

      {/* Top-right on-canvas controls: auto-rotate toggle + reset view. */}
      <div className="absolute top-3 right-3 z-40 flex gap-1.5">
        <button
          onClick={onToggleAutoRotate}
          title={autoRotate ? "Pause auto-rotate" : "Play auto-rotate"}
          aria-label={autoRotate ? "Pause auto-rotate" : "Play auto-rotate"}
          aria-pressed={autoRotate}
          className={`pointer-events-auto flex items-center justify-center w-9 h-9 rounded-lg border backdrop-blur-md transition-[colors,transform] duration-150 ease-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0e14] ${
            autoRotate
              ? "bg-blue-500/15 border-blue-400/30 text-blue-200 hover:bg-blue-500/25"
              : "bg-[#0b0e14]/70 border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          }`}
        >
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={handleResetView}
          title="Reset view"
          aria-label="Reset view"
          className="pointer-events-auto flex items-center justify-center w-9 h-9 rounded-lg border bg-[#0b0e14]/70 border-white/10 text-slate-300 hover:text-white hover:border-white/20 backdrop-blur-md transition-[colors,transform] duration-150 ease-out active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0e14]"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {/* Minimalist serif hover / tap detail card.
          Ultra-thin border, semi-transparent dark background, a single
          colored subject dot, serif title, muted mono meta + description.
          Always mounted to avoid a first-frame flash; opacity/position
          toggled imperatively from the render loop. */}
      <div
        ref={tooltipRef}
        aria-hidden="true"
        className="absolute pointer-events-none z-50 select-none"
        style={{ transform: "translate(-50%, -100%)", left: 0, top: 0, opacity: 0, minWidth: "200px", width: "max-content", maxWidth: "280px" }}
      >
        <div className="rounded-md overflow-hidden border border-white/10 bg-[#0b0e14]/85 backdrop-blur-sm px-3 py-2.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span ref={tooltipDotRef} className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#94a3b8" }} />
            <span ref={tooltipMetaRef} className="text-[9px] font-mono uppercase tracking-wider text-slate-500 truncate">
              SUBJECT · AGE 4–6
            </span>
          </div>
          <div ref={tooltipTitleRef} className="text-[15px] text-slate-100 leading-snug" style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
            Title
          </div>
          <div ref={tooltipDescRef} className="text-[10px] text-slate-400 leading-relaxed mt-1 line-clamp-2">
            Description
          </div>
        </div>
      </div>
    </div>
  );
}
