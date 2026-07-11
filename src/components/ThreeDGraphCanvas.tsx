import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { Play, Pause, LocateFixed } from "lucide-react";
import { Topic } from "../types";
import { topicsList, dependenciesList, getTransitivePrerequisites } from "../dataLoader";
import { SUBJECT_COLORS, subjectColor } from "../theme/subjectColors";
import {
  POINTS_VERTEX_SHADER,
  POINTS_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
} from "../three/shaders";
import { getLightningOffset } from "../three/graphLayout";

interface ThreeDGraphCanvasProps {
  activeTopic: Topic | null;
  onSelectTopic: (topic: Topic) => void;
  onDeselectTopic?: () => void;
  hiddenSubjects: Set<string>;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onResetView: () => void;
}

// Minimal HTML escaper for label text (topic names come from trusted JSON,
// but we never want a stray character to break the label DOM).
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;");

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
  const tooltipBarRef = useRef<HTMLSpanElement>(null);
  const tooltipDomainRef = useRef<HTMLSpanElement>(null);
  const tooltipAgeRef = useRef<HTMLSpanElement>(null);
  const tooltipTitleRef = useRef<HTMLDivElement>(null);
  const tooltipDescRef = useRef<HTMLDivElement>(null);

  // Smart node-label layer. A pre-allocated pool of label divs is repositioned
  // each frame from the existing screen-space projection. Pool sizing avoids
  // React re-renders at 60fps while keeping label placement GPU-synchronized.
  const LABEL_POOL_SIZE = 64;
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const labelPoolRef = useRef<Array<HTMLDivElement>>([]);

  // Interaction refs
  const rotation = useRef({ x: -0.3, y: 0.6 });
  const targetRotation = useRef({ x: -0.3, y: 0.6 });
  const zoom = useRef(1.85);
  const targetZoom = useRef(1.85);
  const pan = useRef({ x: 0, y: 0 });
  const targetPan = useRef({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastInteractionTime = useRef(Date.now());
  // Tracks cumulative pointer movement during a press so we can distinguish a
  // click (small movement) from an orbit/pan drag (large movement). Without
  // this, finishing a drag selects whatever node is under the cursor.
  const pressMovedDistSq = useRef(0);
  const pressActive = useRef(false);

  // Mobile / Touch interaction helper refs
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number>(0);
  const zoomStartValRef = useRef<number>(1.85);
  // Timer for the mobile tap-tooltip flash; tracked so a new tap can clear a
  // stale timer instead of prematurely clearing a legitimate hover state.
  const touchTooltipTimerRef = useRef<number | null>(null);

  // Hover state
  const [hoveredTopic, setHoveredTopic] = useState<Topic | null>(null);

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

  // Pre-generate stable 3D coordinates for all 1,590 nodes forming a flaring trumpet funnel
  const nodes = useMemo(() => {
    return topicsList.map((topic, index) => {
      const age = topic.ageRangeStart || 4;
      
      // Vertical Y axis maps directly to age: bottom is age 4 (-120), top is age 15 (+120)
      const normalizedY = ((age - 4) / 11 - 0.5) * 240;

      // Double helix / spiraling columns: different subjects occupy distinct arms wrapping around
      const subjectsKeys = Object.keys(SUBJECT_COLORS);
      const subIdx = subjectsKeys.indexOf(topic.subject);
      const armAngle = subIdx !== -1 ? (subIdx / subjectsKeys.length) * Math.PI * 2 : 0;
      
      // Funnel twist: twist spiral as it goes up
      const spiralTurn = (age - 4) * 0.42;

      // Group domains into distinct tight angular sub-clusters/sectors within the subject's arm
      const domainsListForSub = subjectDomains[topic.subject] || [];
      const domIdx = domainsListForSub.indexOf(topic.domain);
      const domAngleOffset = domainsListForSub.length > 1
        ? ((domIdx / (domainsListForSub.length - 1)) - 0.5) * 0.95
        : 0;

      const baseTheta = armAngle + spiralTurn + domAngleOffset;

      // Trumpet-like flared radius: extremely narrow at age 4, expanding exponentially upwards
      const r = 10 + Math.pow(age - 4, 1.45) * 5.2;

      // Tight clustering: reduce dispersion to make domain clusters look highly unified
      const dispersion = Math.max(0.7, (age - 4) * 1.35);
      const hashX = Math.sin(index * 17.5) * dispersion;
      // Slight vertical noise to maintain clean sequential horizontal tiers
      const hashY = Math.cos(index * 29.2) * (dispersion * 0.22);
      const hashZ = Math.sin(index * 41.9) * dispersion;

      // Fetch stable jagged lightning/thunder bolt core offset at this height
      const thunder = getLightningOffset(normalizedY);

      // Node centrality: scale node diameter dynamically based on connection density (larger and extremely punchy)
      const connectionCount = nodeCentrality.get(topic.id) || 0;
      const baseRadius = 3.6 + Math.pow(connectionCount, 0.7) * 2.4;
      const isMilestone = connectionCount >= 8;

      return {
        topic,
        x: r * Math.cos(baseTheta) + thunder.x + hashX,
        y: normalizedY + hashY,
        z: r * Math.sin(baseTheta) + thunder.z + hashZ,
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

  // Transitive prerequisite IDs when a node is selected
  const selectedPrereqIds = useMemo(() => {
    if (!activeTopic) return new Set<string>();
    const list = getTransitivePrerequisites(activeTopic.id);
    const set = new Set<string>(list.map(p => p.topic.id));
    set.add(activeTopic.id); // include itself
    return set;
  }, [activeTopic]);

  // Smart labels: which node ids should display a persistent HTML label.
  // Milestones (high-connectivity), the selected node, its prerequisite path,
  // and the currently hovered node. Keeps clutter low while making the graph
  // readable at a glance and the active path legible as a labeled trail.
  const labeledNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of nodes) {
      if (node.isMilestone && !hiddenSubjects.has(node.topic.subject)) {
        ids.add(node.topic.id);
      }
    }
    if (activeTopic) {
      for (const id of selectedPrereqIds) ids.add(id);
    }
    if (hoveredTopic) ids.add(hoveredTopic.id);
    return ids;
  }, [nodes, hiddenSubjects, activeTopic, selectedPrereqIds, hoveredTopic]);

  // Fast id -> node lookup for label rendering in the render loop.
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
  const particleMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
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
    // Quadratic-bezier control point: the edge bows outward from the funnel
    // center along the radial direction so overlapping path edges separate.
    mid: { x: number; y: number; z: number };
    color: THREE.Color;
    subject: string;
  }>>([]);

  // Refs for core Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const graphGroupRef = useRef<THREE.Group | null>(null);
  // Selection halo: a billboarded ring that tracks the selected node's world
  // position each frame. Parented to the scene (not graphGroup) so it doesn't
  // inherit graph rotation; we reposition it imperatively.
  const selectionHaloRef = useRef<THREE.Mesh | null>(null);
  const selectionHaloOpacityRef = useRef(0);

  // Mouse hover tracking (vsync-throttled hover)
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Animated state refs for smooth transitions
  const animatedSizesRef = useRef<Float32Array | null>(null);
  const animatedAlphasRef = useRef<Float32Array | null>(null);
  const animatedSelectedRef = useRef<Float32Array | null>(null);

  // Sync reactive properties into refs for render loop access without re-instantiation
  const activeTopicRef = useRef(activeTopic);
  const hoveredTopicRef = useRef(hoveredTopic);
  const hiddenSubjectsRef = useRef(hiddenSubjects);
  const nodesRef = useRef(nodes);
  const selectedPrereqIdsRef = useRef(selectedPrereqIds);
  const autoRotateRef = useRef(autoRotate);
  const onDeselectRef = useRef(onDeselectTopic);
  const labeledNodeIdsRef = useRef<Set<string>>(new Set());
  // Fast id -> node lookup, rebuilt whenever nodes change, for label rendering.
  const nodeByTopicIdRef = useRef<Map<string, typeof nodes[0]>>(new Map());

  useEffect(() => {
    activeTopicRef.current = activeTopic;
    hoveredTopicRef.current = hoveredTopic;
    hiddenSubjectsRef.current = hiddenSubjects;
    nodesRef.current = nodes;
    selectedPrereqIdsRef.current = selectedPrereqIds;
    autoRotateRef.current = autoRotate;
    onDeselectRef.current = onDeselectTopic;
    labeledNodeIdsRef.current = labeledNodeIds;
    nodeByTopicIdRef.current = nodeByTopicId;
  }, [activeTopic, hoveredTopic, hiddenSubjects, nodes, selectedPrereqIds, autoRotate, onDeselectTopic, labeledNodeIds, nodeByTopicId]);

  // High-performance CPU update for size/alpha attributes, transitioning values smoothly
  const updateNodeAttributes = (forceImmediate = false) => {
    const geometry = pointsGeometryRef.current;
    if (!geometry) return;

    const sizes = geometry.attributes.aSize.array as Float32Array;
    const alphas = geometry.attributes.aAlpha.array as Float32Array;
    const selectedAttr = geometry.attributes.aSelected.array as Float32Array;

    const currentActiveTopic = activeTopicRef.current;
    const currentHiddenSubjects = hiddenSubjectsRef.current;
    const currentHoveredTopic = hoveredTopicRef.current;
    const currentSelectedPrereqIds = selectedPrereqIdsRef.current;
    const currentNodes = nodesRef.current;

    const isTopicSelected = !!currentActiveTopic;

    // Initialize animated arrays if not present or size mismatch
    if (!animatedSizesRef.current || animatedSizesRef.current.length !== currentNodes.length) {
      animatedSizesRef.current = new Float32Array(currentNodes.length);
      animatedAlphasRef.current = new Float32Array(currentNodes.length);
      animatedSelectedRef.current = new Float32Array(currentNodes.length);
      forceImmediate = true;
    }

    const animatedSizes = animatedSizesRef.current;
    const animatedAlphas = animatedAlphasRef.current;
    const animatedSelected = animatedSelectedRef.current;
    if (!animatedSizes || !animatedAlphas || !animatedSelected) return;

    currentNodes.forEach((node, i) => {
      const isHidden = currentHiddenSubjects.has(node.topic.subject);

      let targetSize = node.baseRadius * 1.4;
      let targetAlpha = 1.0; // Baseline opacity (fully opaque)
      let targetSelected = 0.0; // Default

      if (isHidden) {
        targetSize = 0.0;
        targetAlpha = 0.0;
        targetSelected = 0.0;
      } else {
        if (isTopicSelected) {
          const isSelected = currentActiveTopic && node.topic.id === currentActiveTopic.id;
          const isPartOfPath = currentSelectedPrereqIds.has(node.topic.id);

          if (isSelected) {
            // Selected node: a clear but not oversized bump (was 2.3x which was
            // far too large — it swallowed neighbours). The selection halo
            // carries the emphasis, so the node itself just needs to read.
            targetSize = node.baseRadius * 1.7;
            targetAlpha = 1.0;
            targetSelected = 1.0; // Selected node
          } else if (isPartOfPath) {
            // Prerequisite-path node: keep full subject color (alpha ~1.0) so
            // the connected trail stays vivid instead of washing out.
            targetSize = node.baseRadius * 1.2;
            targetAlpha = 1.0;
            targetSelected = 2.0; // Prerequisite path node
          } else {
            targetSize = node.baseRadius * 1.0;
            targetAlpha = 0.4; // Dimmed background (was 0.25 — too aggressive)
            targetSelected = 3.0; // Dimmed background node
          }
        }

        // Hover feedback — a clear but measured scale-up (was 1.22x).
        if (currentHoveredTopic && node.topic.id === currentHoveredTopic.id) {
          targetSize *= 1.3;
          targetAlpha = 1.0;
        }
      }

      if (forceImmediate) {
        animatedSizes[i] = targetSize;
        animatedAlphas[i] = targetAlpha;
        animatedSelected[i] = targetSelected;
      } else {
        // Smooth interpolation for size, alpha, and selection state flags.
        // A slightly faster lerp makes select/deselect feel snappy yet smooth.
        animatedSizes[i] += (targetSize - animatedSizes[i]) * 0.2;
        animatedAlphas[i] += (targetAlpha - animatedAlphas[i]) * 0.2;
        animatedSelected[i] += (targetSelected - animatedSelected[i]) * 0.2;
      }

      sizes[i] = animatedSizes[i];
      alphas[i] = animatedAlphas[i];
      selectedAttr[i] = animatedSelected[i];
    });

    geometry.attributes.aSize.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aSelected.needsUpdate = true;
  };

  useEffect(() => {
    updateNodeAttributes();
  }, [nodes, activeTopic, hoveredTopic, hiddenSubjects, selectedPrereqIds]);

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

  // Update active prerequisite path lines when selected topic changes.
  // Active edges are drawn as bowed quadratic-bezier polylines (sampled into
  // short segments) so the prerequisite trail reads as a connected, separable
  // path instead of a tangle of overlapping straight lines through the core.
  const CURVE_SEGMENTS = 12;
  useEffect(() => {
    const hardGeometry = activeHardGeometryRef.current;
    const softGeometry = activeSoftGeometryRef.current;
    const hardMaterial = activeHardMaterialRef.current;
    const softMaterial = activeSoftMaterialRef.current;
    if (!hardGeometry || !softGeometry || !hardMaterial || !softMaterial) return;

    const hardPositions: number[] = [];
    const softPositions: number[] = [];
    const activeEdgesList: Array<{
      from: { x: number; y: number; z: number };
      to: { x: number; y: number; z: number };
      mid: { x: number; y: number; z: number };
      color: THREE.Color;
      subject: string;
    }> = [];

    if (activeTopic) {
      for (const dep of dependenciesList) {
        const isPrereqPath = selectedPrereqIds.has(dep.topicId) && selectedPrereqIds.has(dep.prerequisiteId);
        if (isPrereqPath) {
          const fromNode = activeNodesMap.get(dep.prerequisiteId);
          const toNode = activeNodesMap.get(dep.topicId);
          if (fromNode && toNode) {
            const fx = fromNode.x, fy = fromNode.y, fz = fromNode.z;
            const tx = toNode.x, ty = toNode.y, tz = toNode.z;

            // Midpoint of the edge.
            const mx = (fx + tx) / 2;
            const my = (fy + ty) / 2;
            const mz = (fz + tz) / 2;
            // Push the midpoint radially outward from the funnel's central axis
            // (the Y axis) so adjacent path edges separate visually. The bow
            // scales with edge length so short edges stay subtle.
            const radialLen = Math.hypot(mx, mz) || 1;
            const edgeLen = Math.hypot(tx - fx, ty - fy, tz - fz);
            const bow = Math.min(14, edgeLen * 0.18);
            const midX = mx + (mx / radialLen) * bow;
            const midY = my;
            const midZ = mz + (mz / radialLen) * bow;

            const edgeColor = new THREE.Color(subjectColor(fromNode.topic.subject));
            activeEdgesList.push({
              from: { x: fx, y: fy, z: fz },
              to: { x: tx, y: ty, z: tz },
              mid: { x: midX, y: midY, z: midZ },
              color: edgeColor,
              subject: fromNode.topic.subject
            });

            // Sample the quadratic bezier into CURVE_SEGMENTS connected points
            // and push them as a continuous line strip (LineSegments needs
            // pairs, so we emit each consecutive pair).
            let px = fx, py = fy, pz = fz;
            const target = dep.strength === "soft" ? softPositions : hardPositions;
            for (let s = 1; s <= CURVE_SEGMENTS; s++) {
              const t = s / CURVE_SEGMENTS;
              const u = 1 - t;
              // B(t) = (1-t)^2*P0 + 2(1-t)t*M + t^2*P1
              const cx = u * u * fx + 2 * u * t * midX + t * t * tx;
              const cy = u * u * fy + 2 * u * t * midY + t * t * ty;
              const cz = u * u * fz + 2 * u * t * midZ + t * t * tz;
              target.push(px, py, pz, cx, cy, cz);
              px = cx; py = cy; pz = cz;
            }
          }
        }
      }

      // Color active paths matching the subject of the selected topic
      const activeColor = subjectColor(activeTopic.subject);
      const colorObj = new THREE.Color(activeColor);
      hardMaterial.color.copy(colorObj);
      softMaterial.color.copy(colorObj);
    }

    activeEdgesRef.current = activeEdgesList;
    hardGeometry.setAttribute("position", new THREE.Float32BufferAttribute(hardPositions, 3));
    softGeometry.setAttribute("position", new THREE.Float32BufferAttribute(softPositions, 3));
    if (activeSoftLinesRef.current) {
      activeSoftLinesRef.current.computeLineDistances();
    }
  }, [activeTopic, selectedPrereqIds, activeNodesMap]);

  // Smoothly center the camera and adjust zoom to focus on the selected node
  useEffect(() => {
    if (activeTopic) {
      const node = nodes.find(n => n.topic.id === activeTopic.id);
      if (node) {
        // Calculate the rotated position of the node in the current rotation of the graphGroup
        const localPos = new THREE.Vector3(node.x, node.y, node.z);
        const euler = new THREE.Euler(rotation.current.x, rotation.current.y, 0, "YXZ");
        localPos.applyEuler(euler);

        // Center on screen with correct pan scaling:
        // pan.x * 0.38 + 38.0 = 38.0 - localPos.x => pan.x = -localPos.x / 0.38
        // -pan.y * 0.38 = -localPos.y => pan.y = localPos.y / 0.38
        targetPan.current = {
          x: -localPos.x / 0.38,
          y: localPos.y / 0.38
        };
        
        // Slightly zoom in to focus on the active node
        targetZoom.current = 2.2;
      }
    } else {
      // If no node is active, reset pan and zoom to baseline overview
      targetPan.current = { x: 0, y: 0 };
      targetZoom.current = 1.85;
    }
  }, [activeTopic, nodes]);

  // Build the pooled label divs once. Imperative creation avoids rendering
  // dozens of React nodes and lets the render loop reposition them cheaply.
  useEffect(() => {
    const layer = labelLayerRef.current;
    if (!layer) return;
    layer.innerHTML = "";
    const pool: HTMLDivElement[] = [];
    for (let i = 0; i < LABEL_POOL_SIZE; i++) {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.left = "0";
      el.style.top = "0";
      el.style.display = "none";
      el.style.willChange = "transform";
      el.style.padding = "3px 6px";
      el.style.borderRadius = "6px";
      el.style.border = "1px solid";
      el.style.background = "rgba(3,6,15,0.72)";
      el.style.backdropFilter = "blur(4px)";
      el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.55)";
      el.style.maxWidth = "150px";
      el.style.whiteSpace = "nowrap";
      el.style.overflow = "hidden";
      el.style.textOverflow = "ellipsis";
      el.dataset.topicId = "";
      layer.appendChild(el);
      pool.push(el);
    }
    labelPoolRef.current = pool;
    return () => {
      layer.innerHTML = "";
      labelPoolRef.current = [];
    };
  }, []);

  // Setup WebGL scene, camera, renderer and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = containerRef.current?.getBoundingClientRect() || { width: 800, height: 600 };
    const width = rect.width;
    const height = rect.height;

    // --- 1. SETUP THREE.JS SCENE & WEBGL RENDERER ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.z = 400;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      premultipliedAlpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x090b11, 1.0);
    rendererRef.current = renderer;

    // Main rotating group holding all graph entities
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);
    graphGroupRef.current = graphGroup;

    // --- 2. SETUP SPATIAL GROUNDING HUD (Axis & Funnel Rings) ---
    // Central Axis Spine - Glowing Jagged Lightning/Thunder Bolt Core
    const spinePoints: THREE.Vector3[] = [];
    for (let y = -125; y <= 125; y += 4) {
      const offset = getLightningOffset(y);
      spinePoints.push(new THREE.Vector3(offset.x, y, offset.z));
    }
    const spineGeometry = new THREE.BufferGeometry().setFromPoints(spinePoints);
    const spineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff, // Cyber Electric Cyan
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const spineLine = new THREE.Line(spineGeometry, spineMaterial);
    spineLine.visible = true;
    graphGroup.add(spineLine);

    // Inner core for extreme brightness to sell the lightning effect
    const spineCoreMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff, // Pure white inner electric core
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const spineCoreLine = new THREE.Line(spineGeometry, spineCoreMaterial);
    spineCoreLine.visible = true;
    graphGroup.add(spineCoreLine);

    // Three Reference Rings
    const createRingGeometry = (r: number) => {
      const points: THREE.Vector3[] = [];
      const segments = 64;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta)));
      }
      return new THREE.BufferGeometry().setFromPoints(points);
    };

    const ringsConfig = [
      { r: 12, y: -120, color: 0xff007f, opacity: 0.35 }, // Pinkish Foundation (age 4)
      { r: 72, y: 0, color: 0xcc00ff, opacity: 0.22 },    // Purpleish Developing (age 9)
      { r: 172, y: 120, color: 0x00f0ff, opacity: 0.18 }  // Cyan Specialization (age 15)
    ];

    const ringsData = ringsConfig.map(cfg => {
      const geo = createRingGeometry(cfg.r);
      const mat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        visible: true,
        depthWrite: false
      });
      const line = new THREE.LineLoop(geo, mat);
      line.visible = true;
      line.position.y = cfg.y;
      graphGroup.add(line);
      return { geometry: geo, material: mat, line };
    });

    // --- 3. BACKGROUND CONNECTIONS (EDGES) ---
    const hardEdgesGeometry = new THREE.BufferGeometry();
    const softEdgesGeometry = new THREE.BufferGeometry();

    const hardEdgesMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    const softEdgesMaterial = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 4,
      gapSize: 4,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    const backgroundHardLines = new THREE.LineSegments(hardEdgesGeometry, hardEdgesMaterial);
    const backgroundSoftLines = new THREE.LineSegments(softEdgesGeometry, softEdgesMaterial);
    graphGroup.add(backgroundHardLines);
    graphGroup.add(backgroundSoftLines);

    // Save stable references
    hardEdgesGeometryRef.current = hardEdgesGeometry;
    softEdgesGeometryRef.current = softEdgesGeometry;
    backgroundSoftLinesRef.current = backgroundSoftLines;
    hardEdgesMaterialRef.current = hardEdgesMaterial;
    softEdgesMaterialRef.current = softEdgesMaterial;

    // --- 4. ACTIVE CONNECTIONS (PREREQUISITE TRACING PATHS) ---
    const activeHardGeometry = new THREE.BufferGeometry();
    const activeSoftGeometry = new THREE.BufferGeometry();

    const activeHardMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      linewidth: 3,
      depthWrite: false,
      depthTest: false, // Draw on top of nodes so the path is always readable.
      blending: THREE.NormalBlending
    });

    const activeSoftMaterial = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 5,
      gapSize: 5,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    });

    const activeHardLines = new THREE.LineSegments(activeHardGeometry, activeHardMaterial);
    const activeSoftLines = new THREE.LineSegments(activeSoftGeometry, activeSoftMaterial);
    // Render after nodes/particles so the prerequisite trail is always visible.
    activeHardLines.renderOrder = 4;
    activeSoftLines.renderOrder = 4;
    graphGroup.add(activeHardLines);
    graphGroup.add(activeSoftLines);

    // Save active line refs
    activeHardGeometryRef.current = activeHardGeometry;
    activeSoftGeometryRef.current = activeSoftGeometry;
    activeSoftLinesRef.current = activeSoftLines;
    activeHardMaterialRef.current = activeHardMaterial;
    activeSoftMaterialRef.current = activeSoftMaterial;

    // --- 6. NODES SYSTEM (Shader-based Billboards) ---
    const pointsGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const alphas = new Float32Array(nodes.length);
    const selectedAttr = new Float32Array(nodes.length);
    const milestoneAttr = new Float32Array(nodes.length);

    // Map subject color hexes into float arrays
    const colorCache = nodes.map(node => new THREE.Color(node.color));
    nodes.forEach((node, i) => {
      positions[i * 3] = node.x;
      positions[i * 3 + 1] = node.y;
      positions[i * 3 + 2] = node.z;

      colors[i * 3] = colorCache[i].r;
      colors[i * 3 + 1] = colorCache[i].g;
      colors[i * 3 + 2] = colorCache[i].b;

      milestoneAttr[i] = node.isMilestone ? 1.0 : 0.0;
    });

    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    pointsGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    pointsGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    pointsGeometry.setAttribute("aMilestone", new THREE.BufferAttribute(milestoneAttr, 1));
    pointsGeometry.setAttribute("aSelected", new THREE.BufferAttribute(selectedAttr, 1));

    // Store geometry reference
    pointsGeometryRef.current = pointsGeometry;

    const pointsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZoom: { value: 1.0 },
        uScale: { value: 1.0 },
        uGlobalAlpha: { value: 1.0 },
        uTime: { value: 0.0 }
      },
      vertexShader: POINTS_VERTEX_SHADER,
      fragmentShader: POINTS_FRAGMENT_SHADER,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      blending: THREE.NormalBlending
    });

    pointsMaterialRef.current = pointsMaterial;

    const points = new THREE.Points(pointsGeometry, pointsMaterial);
    graphGroup.add(points);

    // --- 5. PARTICLE SYSTEM FOR PREREQUISITE FLOW ---
    const maxParticles = 300;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(maxParticles * 3);
    const particleColors = new Float32Array(maxParticles * 3);
    const particleSizes = new Float32Array(maxParticles);
    const particleAlphas = new Float32Array(maxParticles);

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute("aColor", new THREE.BufferAttribute(particleColors, 3));
    particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute("aAlpha", new THREE.BufferAttribute(particleAlphas, 1));

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uZoom: { value: 1.0 },
        uGlobalAlpha: { value: 1.0 }
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    particleMaterialRef.current = particleMaterial;

    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    graphGroup.add(particlePoints);

    // --- 5b. SELECTION HALO (billboarded ring tracking the selected node) ---
    // A screen-facing ring drawn at the selected node's world position. It is
    // added to the scene (not graphGroup) and repositioned each frame via
    // getWorldPosition, then oriented to face the camera. Opacity lerps in/out
    // so selecting/deselecting feels smooth. Per threejs-geometry, RingGeometry
    // is the right primitive for a flat annulus.
    const haloGeometry = new THREE.RingGeometry(2.4, 3.0, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const selectionHalo = new THREE.Mesh(haloGeometry, haloMaterial);
    selectionHalo.visible = false;
    selectionHalo.renderOrder = 5; // Draw on top of the node sprites
    scene.add(selectionHalo);
    selectionHaloRef.current = selectionHalo;

    interface ParticleState {
      edgeIndex: number;
      t: number;
      speed: number;
      size: number;
      offsetAngle: number;
      offsetRadius: number;
    }

    const particles: ParticleState[] = [];
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        edgeIndex: -1,
        t: Math.random(), // Stagger start points
        speed: 0.0022 + Math.random() * 0.005, // calmer flow speed
        size: 3.5 + Math.random() * 4.0,
        offsetAngle: Math.random() * Math.PI * 2,
        offsetRadius: 0.2 + Math.random() * 1.5
      });
    }

    // --- 7. ANIMATION FRAME LOOP ---
    let animationFrameId: number;

    // Reusable scratch objects for the render loop (avoid per-frame allocation).
    const haloWorldPos = new THREE.Vector3();
    const haloColorCache: Record<string, THREE.Color> = {
      __default: new THREE.Color("#ffffff")
    };
    for (const [k, v] of Object.entries(SUBJECT_COLORS)) {
      haloColorCache[k] = new THREE.Color(v);
    }

    const render = () => {
      // Smooth interpolation for dragging, panning, zooming
      rotation.current.x += (targetRotation.current.x - rotation.current.x) * 0.08;
      rotation.current.y += (targetRotation.current.y - rotation.current.y) * 0.08;
      zoom.current += (targetZoom.current - zoom.current) * 0.08;
      pan.current.x += (targetPan.current.x - pan.current.x) * 0.08;
      pan.current.y += (targetPan.current.y - pan.current.y) * 0.08;

      // Gentle drift rotation when idle and auto-rotate is enabled by the user.
      // Auto-rotate is off by default so the graph stays still while reading.
      if (autoRotateRef.current && !isDragging.current && Date.now() - lastInteractionTime.current > 4000) {
        targetRotation.current.y += 0.0006;
      }

      // Apply coordinates to the Three.js group
      graphGroup.rotation.y = rotation.current.y;
      graphGroup.rotation.x = rotation.current.x;

      // Convert 2D screen pan offset to WebGL units, with a constant +38.0 shift to shift the graph ~100px to the right
      graphGroup.position.x = (pan.current.x * 0.38) + 38.0;
      graphGroup.position.y = -pan.current.y * 0.38;
      graphGroup.updateMatrixWorld(true);

      // Set zoom uniforms
      pointsMaterial.uniforms.uZoom.value = zoom.current;
      particleMaterial.uniforms.uZoom.value = zoom.current;
      // Drive the milestone halo pulse.
      pointsMaterial.uniforms.uTime.value = performance.now() * 0.001;

      // Update node attributes dynamically
      updateNodeAttributes();

      // Project all coordinates to screen-space for hover tracking and HTML HUD positioning
      const tempV = new THREE.Vector3();
      const cssW = canvas.width / (window.devicePixelRatio || 1);
      const cssH = canvas.height / (window.devicePixelRatio || 1);

      // Handle Bokeh focus and edge opacities based on selected node with smooth interpolation
      const currentActiveTopic = activeTopicRef.current;
      // Background edges recede when a topic is selected so the active path
      // stands out; slightly lowered base opacity reduces baseline visual noise.
      const targetHardOpacity = currentActiveTopic ? 0.05 : 0.11;
      const targetSoftOpacity = currentActiveTopic ? 0.03 : 0.07;
      // Active prerequisite path edges render at full opacity for readability.
      const targetActiveHardOpacity = currentActiveTopic ? 1.0 : 0.0;
      const targetActiveSoftOpacity = currentActiveTopic ? 1.0 : 0.0;

      if (hardEdgesMaterialRef.current) {
        hardEdgesMaterialRef.current.opacity += (targetHardOpacity - hardEdgesMaterialRef.current.opacity) * 0.08;
      }
      if (softEdgesMaterialRef.current) {
        softEdgesMaterialRef.current.opacity += (targetSoftOpacity - softEdgesMaterialRef.current.opacity) * 0.08;
      }
      // Node dimming is handled by per-node vAlpha mixed toward background in the shader.
      // No global alpha reduction needed — that was causing the cloudy look.
      if (activeHardMaterialRef.current) {
        activeHardMaterialRef.current.opacity += (targetActiveHardOpacity - activeHardMaterialRef.current.opacity) * 0.08;
      }
      if (activeSoftMaterialRef.current) {
        activeSoftMaterialRef.current.opacity += (targetActiveSoftOpacity - activeSoftMaterialRef.current.opacity) * 0.08;
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
        let minDistanceSq = 16 * 16; // 16px hover target radius squared
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
          if (hoveredTopicRef.current?.id !== closestNode.topic.id) {
            setHoveredTopic(closestNode.topic);
          }
          if (!isDragging.current && canvas.style.cursor !== "pointer") {
            canvas.style.cursor = "pointer";
          }
        } else {
          if (hoveredTopicRef.current !== null) {
            setHoveredTopic(null);
          }
          if (!isDragging.current && canvas.style.cursor !== "default") {
            canvas.style.cursor = "default";
          }
        }
      }

      // --- Selection halo: follow the selected node in world space and pulse. ---
      const halo = selectionHaloRef.current;
      if (halo) {
        const selTopic = activeTopicRef.current;
        const targetOpacity = selTopic ? 0.9 : 0.0;
        selectionHaloOpacityRef.current += (targetOpacity - selectionHaloOpacityRef.current) * 0.12;

        const haloNode = selTopic ? nodeByTopicIdRef.current.get(selTopic.id) : null;
        if (haloNode && selectionHaloOpacityRef.current > 0.01) {
          // World position of the selected node (accounts for graphGroup rotation+pan).
          haloWorldPos.set(haloNode.x, haloNode.y, haloNode.z);
          haloWorldPos.applyMatrix4(graphGroup.matrixWorld);
          halo.position.copy(haloWorldPos);
          // Billboard: face the camera so the ring always reads as a circle.
          halo.quaternion.copy(camera.quaternion);
          // Gentle scale pulse + slight distance-based sizing so it stays visible.
          const pulse = 1.0 + 0.12 * Math.sin(performance.now() * 0.004);
          const distScale = Math.max(0.6, Math.min(2.2, haloWorldPos.distanceTo(camera.position) / 220));
          halo.scale.setScalar(pulse * distScale);
          (halo.material as THREE.MeshBasicMaterial).opacity = selectionHaloOpacityRef.current;
          // Tint the halo to the selected node's subject color for consistency.
          const c = haloColorCache[haloNode.topic.subject] || haloColorCache.__default;
          (halo.material as THREE.MeshBasicMaterial).color.copy(c);
          halo.visible = true;
        } else if (selectionHaloOpacityRef.current < 0.01) {
          halo.visible = false;
        }
      }

      // Update absolute HTML HUD labels positioning
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

      updateRingLabel(labelBottomRef.current, 12, -120, 0, "FOUNDATION (AGE 4)");
      updateRingLabel(labelMiddleRef.current, 72, 0, 0, "DEVELOPING (AGE 9)");
      updateRingLabel(labelTopRef.current, 172, 120, 0, "SPECIALIZATION (AGE 15)");

      // Update hover detail card position + content. Card is always mounted;
      // we toggle opacity and write content imperatively from the latest
      // hovered topic each frame (avoids React re-renders and first-frame
      // flash at 0,0).
      const currentHovered = hoveredTopicRef.current;
      if (tooltipRef.current) {
        if (currentHovered) {
          const proj = projectedCoordsRef.current.find(p => p.topic.id === currentHovered.id);
          if (proj) {
            tooltipRef.current.style.left = `${proj.sx}px`;
            tooltipRef.current.style.top = `${proj.sy - 18}px`;
            tooltipRef.current.style.opacity = "1";
            // Populate card content (only rewrite text when the node changed).
            const hoverColor = subjectColor(currentHovered.subject);
            if (tooltipBarRef.current) tooltipBarRef.current.style.backgroundColor = hoverColor;
            if (tooltipDomainRef.current && tooltipDomainRef.current.dataset.id !== currentHovered.id) {
              tooltipDomainRef.current.dataset.id = currentHovered.id;
              tooltipDomainRef.current.style.color = hoverColor;
              tooltipDomainRef.current.textContent = currentHovered.domain;
            }
            if (tooltipAgeRef.current && tooltipAgeRef.current.dataset.id !== currentHovered.id) {
              tooltipAgeRef.current.dataset.id = currentHovered.id;
              tooltipAgeRef.current.textContent = `AGE ${currentHovered.ageRangeStart}–${currentHovered.ageRangeEnd}`;
            }
            if (tooltipTitleRef.current && tooltipTitleRef.current.dataset.id !== currentHovered.id) {
              tooltipTitleRef.current.dataset.id = currentHovered.id;
              tooltipTitleRef.current.textContent = currentHovered.name;
            }
            if (tooltipDescRef.current && tooltipDescRef.current.dataset.id !== currentHovered.id) {
              tooltipDescRef.current.dataset.id = currentHovered.id;
              // Short description: first sentence, capped.
              const desc = currentHovered.description || "";
              const firstSentence = desc.split(/(?<=[.!?])\s/)[0] || desc;
              tooltipDescRef.current.textContent = firstSentence.length > 140
                ? firstSentence.slice(0, 137) + "…"
                : firstSentence;
            }
          } else {
            tooltipRef.current.style.opacity = "0";
          }
        } else {
          tooltipRef.current.style.opacity = "0";
        }
      }

      // --- Smart node labels ---
      // Position pooled label divs over the nodes that should be labeled
      // (milestones + selected + prerequisite path + hovered). We reuse the
      // screen-space projection already computed above.
      // On hover, ALL other labels are suppressed so the canvas stays calm and
      // attention focuses on the hovered node (the hover card shows its detail).
      const labelPool = labelPoolRef.current;
      const labeledIds = labeledNodeIdsRef.current;
      const nodeById = nodeByTopicIdRef.current;
      const hovering = !!hoveredTopicRef.current;
      let labelSlot = 0;
      for (const proj of projectedCoordsRef.current) {
        if (labelSlot >= labelPool.length) break;
        if (!labeledIds.has(proj.topic.id)) continue;
        // While hovering, show only the hovered node's label.
        if (hovering && proj.topic.id !== hoveredTopicRef.current!.id) continue;
        // Skip labels behind the camera or far off-screen.
        if (proj.zDepth > 1 || proj.zDepth < -1) continue;
        if (proj.sx < -50 || proj.sx > cssW + 50 || proj.sy < -50 || proj.sy > cssH + 50) continue;

        const node = nodeById.get(proj.topic.id);
        if (!node) continue;

        const el = labelPool[labelSlot++];
        el.style.display = "block";
        // Offset label up-right from the node center, scaled to node radius.
        const offX = 8;
        const offY = 14;
        el.style.transform = `translate(${proj.sx + offX}px, ${proj.sy - offY}px)`;

        const isSelected = activeTopicRef.current?.id === proj.topic.id;
        const color = proj.color;
        el.style.borderColor = `${color}${isSelected ? "80" : "40"}`;
        el.style.color = isSelected ? "#ffffff" : `${color}ee`;
        // Keep label DOM stable: only rewrite text when it changed.
        if (el.dataset.topicId !== proj.topic.id) {
          el.dataset.topicId = proj.topic.id;
          el.innerHTML =
            `<div class="font-sans font-semibold leading-tight" style="font-size:11px">${escapeHtml(proj.topic.name)}</div>` +
            `<div class="font-mono leading-none tracking-wider" style="font-size:8.5px;color:${color}cc;opacity:.85">${escapeHtml(proj.topic.subject.toUpperCase())} · AGE ${proj.topic.ageRangeStart}</div>`;
        }
      }
      // Hide any pooled labels we didn't use this frame.
      for (; labelSlot < labelPool.length; labelSlot++) {
        const el = labelPool[labelSlot];
        if (el.style.display !== "none") {
          el.style.display = "none";
          el.dataset.topicId = "";
        }
      }

      // Update particle positions and attributes dynamically
      const posAttr = particleGeometry.getAttribute("position") as THREE.BufferAttribute;
      const colorAttr = particleGeometry.getAttribute("aColor") as THREE.BufferAttribute;
      const sizeAttr = particleGeometry.getAttribute("aSize") as THREE.BufferAttribute;
      const alphaAttr = particleGeometry.getAttribute("aAlpha") as THREE.BufferAttribute;

      const activeEdges = activeEdgesRef.current;
      const hasActiveEdges = activeEdges.length > 0;

      for (let i = 0; i < maxParticles; i++) {
        const p = particles[i];

        if (hasActiveEdges) {
          // Stable edge assignment: only (re)pick when invalid or the path
          // changed. Previously this re-rolled every frame AND on loop, which
          // made particles teleport erratically between edges.
          if (p.edgeIndex < 0 || p.edgeIndex >= activeEdges.length) {
            p.edgeIndex = Math.floor(Math.random() * activeEdges.length);
          }

          const edge = activeEdges[p.edgeIndex];
          const from = edge.from;
          const to = edge.to;
          const mid = edge.mid;

          // Always advance so the flow reads as "building toward the selected
          // concept" (prereq -> topic). The old code froze particles whenever a
          // topic was selected — exactly when flow should be visible.
          p.t += p.speed;
          if (p.t >= 1.0) {
            p.t = 0.0;
            // Pick a fresh edge only on loop completion, not every frame.
            p.edgeIndex = Math.floor(Math.random() * activeEdges.length);
          }

          // Position along the quadratic bezier B(t), matching the curve the
          // active edges are drawn with so particles ride the visible trail.
          const t = p.t;
          const u = 1 - t;
          const x = u * u * from.x + 2 * u * t * mid.x + t * t * to.x;
          const y = u * u * from.y + 2 * u * t * mid.y + t * t * to.y;
          const z = u * u * from.z + 2 * u * t * mid.z + t * t * to.z;

          // Tangent of the bezier at t (derivative) for the swirl frame.
          const dx = 2 * u * (mid.x - from.x) + 2 * t * (to.x - mid.x);
          const dy = 2 * u * (mid.y - from.y) + 2 * t * (to.y - mid.y);
          const dz = 2 * u * (mid.z - from.z) + 2 * t * (to.z - mid.z);
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;

          let px = -dy;
          let py = dx;
          let pz = 0;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
            px = 1;
            py = 0;
            pz = 0;
          }
          const plen = Math.sqrt(px * px + py * py + pz * pz) || 1.0;
          px /= plen; py /= plen; pz /= plen;

          const qx = (dy * pz - dz * py) / len;
          const qy = (dz * px - dx * pz) / len;
          const qz = (dx * py - dy * px) / len;

          const currentAngle = p.offsetAngle + p.t * Math.PI * 3.0;
          const cosA = Math.cos(currentAngle) * p.offsetRadius;
          const sinA = Math.sin(currentAngle) * p.offsetRadius;

          const finalX = x + (px * cosA + qx * sinA);
          const finalY = y + (py * cosA + qy * sinA);
          const finalZ = z + (pz * cosA + qz * sinA);

          posAttr.setXYZ(i, finalX, finalY, finalZ);
          colorAttr.setXYZ(i, edge.color.r, edge.color.g, edge.color.b);

          const pulsedSize = p.size * (1.0 + 0.2 * Math.sin(performance.now() * 0.004 + i));
          sizeAttr.setX(i, pulsedSize);

          // Smooth fade-in/out at the path ends to prevent popping.
          let alpha = 1.0;
          if (p.t < 0.18) {
            alpha = p.t / 0.18;
          } else if (p.t > 0.82) {
            alpha = (1.0 - p.t) / 0.18;
          }
          alphaAttr.setX(i, alpha * 0.8);
        } else {
          posAttr.setXYZ(i, 0, 0, 0);
          colorAttr.setXYZ(i, 0, 0, 0);
          sizeAttr.setX(i, 0);
          alphaAttr.setX(i, 0);
        }
      }

      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;



      // renderer.render(scene, camera); // Redundant if using composer
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    // Handle high-performance resize observation
    const handleResize = () => {
      const parentRect = containerRef.current?.getBoundingClientRect();
      if (parentRect) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = parentRect.width * dpr;
        canvas.height = parentRect.height * dpr;
        canvas.style.width = `${parentRect.width}px`;
        canvas.style.height = `${parentRect.height}px`;

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

    // Native non-passive wheel listener so preventDefault actually works.
    // React attaches onWheel passively, which made the old handler's
    // preventDefault a no-op and let the page scroll/zoom under the canvas.
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastInteractionTime.current = Date.now();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      targetZoom.current = Math.max(0.6, Math.min(6.5, zoom.current * zoomFactor));
    };
    canvas.addEventListener("wheel", handleNativeWheel, { passive: false });

    render();

    // Clean up WebGL resources thoroughly to prevent GPU memory leaks
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("wheel", handleNativeWheel);

      pointsGeometry.dispose();
      pointsMaterial.dispose();

      particleGeometry.dispose();
      particleMaterial.dispose();

      hardEdgesGeometry.dispose();
      hardEdgesMaterial.dispose();

      softEdgesGeometry.dispose();
      softEdgesMaterial.dispose();

      activeHardGeometry.dispose();
      activeHardMaterial.dispose();

      activeSoftGeometry.dispose();
      activeSoftMaterial.dispose();

      spineGeometry.dispose();
      spineMaterial.dispose();
      spineCoreMaterial.dispose();

      for (const ring of ringsData) {
        ring.geometry.dispose();
        ring.material.dispose();
      }

      haloGeometry.dispose();
      haloMaterial.dispose();

      renderer.dispose();
    };
  }, []);

  // Handle Mouse Events for Camera control (orbit, pan, select)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    pressActive.current = true;
    pressMovedDistSq.current = 0;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastInteractionTime.current = Date.now();
    mousePosRef.current = null; // Suppress hover logic during drag start
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastInteractionTime.current = Date.now();

    const currentRect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - currentRect.left;
    const mouseY = e.clientY - currentRect.top;

    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      // Accumulate total movement since press so we can tell a click from a drag.
      pressMovedDistSq.current += dx * dx + dy * dy;

      if (e.shiftKey) {
        // Shift + Drag to Pan camera
        targetPan.current = {
          x: pan.current.x + dx * 0.45,
          y: pan.current.y + dy * 0.45
        };
      } else {
        // Standard Drag to Orbit camera
        targetRotation.current.y = rotation.current.y + dx * 0.007;
        targetRotation.current.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, rotation.current.x - dy * 0.007));
      }

      dragStart.current = { x: e.clientX, y: e.clientY };
    } else {
      // Store hover coordinates for vsync-synchronized render-loop raycasting
      mousePosRef.current = { x: mouseX, y: mouseY };
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = "default";

    // Treat as a click only if the pointer barely moved during the press.
    // This stops a finished orbit/pan from accidentally selecting a node.
    const CLICK_THRESHOLD_SQ = 6 * 6; // ~6px of total movement allowed
    const wasClick = pressActive.current && pressMovedDistSq.current < CLICK_THRESHOLD_SQ;
    pressActive.current = false;

    if (!wasClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentRect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - currentRect.left;
    const mouseY = e.clientY - currentRect.top;

    let closestNode: typeof projectedCoordsRef.current[0] | null = null;
    let minDistanceSq = 16 * 16; // 16px desktop tap target radius squared
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
      onSelectTopic(closestNode.topic);
    } else {
      // Click on empty space clears the selection.
      onDeselectRef.current?.();
    }
  };

  // --- MOBILE / TOUCH ACCESS EVENT HANDLERS ---
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastInteractionTime.current = Date.now();
    if (e.touches.length === 1) {
      isDragging.current = true;
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX, y: touch.clientY };
      touchStartTimeRef.current = Date.now();
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false; // Disable single finger drag during dual finger pinch
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      pinchStartDistRef.current = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      zoomStartValRef.current = zoom.current;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastInteractionTime.current = Date.now();

    if (e.touches.length === 1 && isDragging.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;

      targetRotation.current.y = rotation.current.y + dx * 0.009;
      targetRotation.current.x = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, rotation.current.x - dy * 0.009)
      );

      dragStart.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      if (pinchStartDistRef.current > 0) {
        const factor = dist / pinchStartDistRef.current;
        targetZoom.current = Math.max(0.6, Math.min(6.5, zoomStartValRef.current * factor));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDragging.current = false;
    pinchStartDistRef.current = 0;

    // Detect micro-tap event (highly responsive tap duration window)
    const duration = Date.now() - touchStartTimeRef.current;
    if (duration < 350 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartPosRef.current.x;
      const dy = touch.clientY - touchStartPosRef.current.y;
      const distMoved = Math.hypot(dx, dy);

      // Verify that user's finger remained relatively still
      if (distMoved < 15) {
        const currentRect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - currentRect.left;
        const touchY = touch.clientY - currentRect.top;

        // Mobile target selection: generous 40px radius (1600 px^2 squared) for easy mobile tapping
        let closestNode: typeof projectedCoordsRef.current[0] | null = null;
        let minDistanceSq = 40 * 40; 
        let bestDepth = Infinity;

        for (const node of projectedCoordsRef.current) {
          const ndx = touchX - node.sx;
          const ndy = touchY - node.sy;
          const distSq = ndx * ndx + ndy * ndy;

          if (distSq < minDistanceSq) {
            if (node.zDepth < bestDepth) {
              bestDepth = node.zDepth;
              closestNode = node;
            }
          }
        }

        if (closestNode) {
          onSelectTopic(closestNode.topic);
          // Briefly display HUD tooltip for mobile tap acknowledgment.
          // Clear any prior timer so a new tap can't be wiped by a stale one.
          if (touchTooltipTimerRef.current !== null) {
            window.clearTimeout(touchTooltipTimerRef.current);
          }
          setHoveredTopic(closestNode.topic);
          touchTooltipTimerRef.current = window.setTimeout(() => {
            setHoveredTopic(null);
            touchTooltipTimerRef.current = null;
          }, 1500);
        } else {
          // Tap on empty space clears the selection.
          onDeselectRef.current?.();
        }
      }
    }
  };

  // Reset camera framing to the default overview. Called by the on-canvas
  // "reset view" button; also notifies the parent (e.g. to stop auto-rotate).
  const handleResetView = () => {
    targetRotation.current = { x: -0.3, y: 0.6 };
    targetZoom.current = 1.85;
    targetPan.current = { x: 0, y: 0 };
    lastInteractionTime.current = Date.now();
    onResetView();
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden flex items-center justify-center select-none bg-[#090b11]"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive 3D graph of 1,590 learning concepts. Each dot is a skill colored by subject; vertical position maps to age (4 at bottom to 15 at top). Drag to rotate, scroll to zoom, and click a dot to inspect it. A full, keyboard-navigable catalog and pathway view is available in the sidebar."
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={() => {
          isDragging.current = false;
          pressActive.current = false;
          mousePosRef.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = "default";
          setHoveredTopic(null);
        }}
        className="block touch-none"
      />

      {/* High-DPI, GPU-synchronized absolute positioned HUD Labels.
          aria-hidden: these are decorative duplicates of information already
          available in the screen-reader-accessible sidebar. */}
      <div ref={labelBottomRef} aria-hidden="true" className="absolute left-0 top-0 pointer-events-none text-[8.5px] font-mono text-pink-400/80 uppercase select-none leading-none tracking-wider" style={{ display: "none" }} />
      <div ref={labelMiddleRef} aria-hidden="true" className="absolute left-0 top-0 pointer-events-none text-[8.5px] font-mono text-purple-400/80 uppercase select-none leading-none tracking-wider" style={{ display: "none" }} />
      <div ref={labelTopRef} aria-hidden="true" className="absolute left-0 top-0 pointer-events-none text-[8.5px] font-mono text-cyan-400/80 uppercase select-none leading-none tracking-wider" style={{ display: "none" }} />

      {/* Smart node-label layer (populated imperatively from the label pool).
          aria-hidden: decorative on-canvas labels; the sidebar is the a11y path. */}
      <div ref={labelLayerRef} aria-hidden="true" className="absolute inset-0 pointer-events-none z-30 select-none" />

      {/* Top-right on-canvas controls: auto-rotate toggle + reset view. */}
      <div className="absolute top-3 right-3 z-40 flex gap-1.5">
        <button
          onClick={onToggleAutoRotate}
          title={autoRotate ? "Pause auto-rotate" : "Play auto-rotate"}
          aria-label={autoRotate ? "Pause auto-rotate" : "Play auto-rotate"}
          aria-pressed={autoRotate}
          className={`pointer-events-auto flex items-center justify-center w-9 h-9 rounded-lg border backdrop-blur-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#090b11] ${
            autoRotate
              ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/30"
              : "bg-[#070b19]/70 border-white/10 text-slate-300 hover:text-white hover:border-white/20"
          }`}
        >
          {autoRotate ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={handleResetView}
          title="Reset view"
          aria-label="Reset view"
          className="pointer-events-auto flex items-center justify-center w-9 h-9 rounded-lg border bg-[#070b19]/70 border-white/10 text-slate-300 hover:text-white hover:border-white/20 backdrop-blur-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#090b11]"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {/* Hover detail card.
          Always mounted to avoid a first-frame flash at (0,0); opacity is
          toggled imperatively from the render loop. Content (domain chip,
          age, title, description) is written imperatively each frame so the
          latest hovered node's full data shows without React re-renders.
          aria-hidden: this duplicates sidebar content; the canvas itself
          carries the text alternative for assistive tech. */}
      <div
        ref={tooltipRef}
        aria-hidden="true"
        className="absolute pointer-events-none z-50 select-none transition-opacity duration-150"
        style={{ transform: "translate(-50%, -100%)", left: 0, top: 0, opacity: 0, minWidth: "200px", maxWidth: "260px" }}
      >
        <div className="rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.85)] bg-slate-950/95 border border-white/10">
          {/* Domain color bar + domain name + age range (row 1) */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5">
            <span ref={tooltipBarRef} className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: "#94a3b8" }} />
            <div className="flex flex-col leading-tight overflow-hidden">
              <span ref={tooltipDomainRef} className="font-mono text-[9px] font-bold tracking-wider uppercase truncate" style={{ color: "#94a3b8" }}>
                DOMAIN
              </span>
              <span ref={tooltipAgeRef} className="font-mono text-[8.5px] text-slate-400 tracking-wide">
                AGE 4–6
              </span>
            </div>
          </div>
          {/* Title (row 2) */}
          <div ref={tooltipTitleRef} className="font-sans font-bold text-[13px] text-white leading-snug px-3 pt-2">
            Title
          </div>
          {/* Short description (row 3) */}
          <div ref={tooltipDescRef} className="font-sans text-[10.5px] text-slate-300 leading-relaxed px-3 pb-2.5 pt-1 line-clamp-2">
            Description
          </div>
        </div>
      </div>
    </div>
  );
}
