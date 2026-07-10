import { Topic, Dependency, Standard, Curriculum, Cluster, TaxonomyManifest } from "./types";
import topicsData from "../data/topics.json";
import dependenciesData from "../data/dependencies.json";
import standardsData from "../data/curriculum-standards.json";
import clustersData from "../data/clusters.json";
import manifestData from "../data/manifest.json";

// Typed data structures
export const manifest = manifestData as TaxonomyManifest;
export const topicsList = (topicsData as any).topics as Topic[];
export const dependenciesList = (dependenciesData as any).dependencies as Dependency[];
export const clustersList = (clustersData as any).clusters as Cluster[];
export const curriculaList = (standardsData as any).curricula as Curriculum[];

// Indexed data maps for instant lookups
export const topicsMap = new Map<string, Topic>(topicsList.map(t => [t.id, t]));

// Adjacency lists for DAG traversal
// topicId -> array of prerequisites
export const prereqAdjacencyList = new Map<string, Dependency[]>();
// prerequisiteId -> array of topic dependencies (what it unlocks)
export const unlockAdjacencyList = new Map<string, Dependency[]>();

// Initialize adjacency lists
for (const dep of dependenciesList) {
  // Prerequisite lookups
  if (!prereqAdjacencyList.has(dep.topicId)) {
    prereqAdjacencyList.set(dep.topicId, []);
  }
  prereqAdjacencyList.get(dep.topicId)!.push(dep);

  // Unlock lookups
  if (!unlockAdjacencyList.has(dep.prerequisiteId)) {
    unlockAdjacencyList.set(dep.prerequisiteId, []);
  }
  unlockAdjacencyList.get(dep.prerequisiteId)!.push(dep);
}

// Flat standards registry for quick lookup by key
export const standardsMap = new Map<string, { standard: Standard; curriculum: Curriculum }>();
for (const curr of curriculaList) {
  for (const std of curr.topics) {
    standardsMap.set(std.key, { standard: std, curriculum: curr });
  }
}

// Helper: Get a single topic by ID
export function getTopic(id: string): Topic | undefined {
  return topicsMap.get(id);
}

// Helper: Get direct prerequisites
export function getDirectPrerequisites(id: string): { topic: Topic; dependency: Dependency }[] {
  const deps = prereqAdjacencyList.get(id) || [];
  return deps
    .map(d => {
      const t = topicsMap.get(d.prerequisiteId);
      return t ? { topic: t, dependency: d } : null;
    })
    .filter((x): x is { topic: Topic; dependency: Dependency } => x !== null);
}

// Helper: Get direct unlocks
export function getDirectUnlocks(id: string): { topic: Topic; dependency: Dependency }[] {
  const deps = unlockAdjacencyList.get(id) || [];
  return deps
    .map(d => {
      const t = topicsMap.get(d.topicId);
      return t ? { topic: t, dependency: d } : null;
    })
    .filter((x): x is { topic: Topic; dependency: Dependency } => x !== null);
}

// Helper: Compute transitive prerequisites (full sub-DAG)
// Returns list of unique topic IDs in topological order (bottom-up: prerequisites first)
export function getTransitivePrerequisites(id: string): { topic: Topic; distance: number }[] {
  const visited = new Set<string>();
  const list: { topic: Topic; distance: number }[] = [];

  function traverse(currentId: string, depth: number) {
    const direct = getDirectPrerequisites(currentId);
    for (const { topic } of direct) {
      if (!visited.has(topic.id)) {
        visited.add(topic.id);
        traverse(topic.id, depth + 1);
        list.push({ topic, distance: depth + 1 });
      }
    }
  }

  traverse(id, 0);
  return list;
}

// Helper: Compute transitive unlocks (everything this topic unlocks down the line)
export function getTransitiveUnlocks(id: string): { topic: Topic; distance: number }[] {
  const visited = new Set<string>();
  const list: { topic: Topic; distance: number }[] = [];

  function traverse(currentId: string, depth: number) {
    const direct = getDirectUnlocks(currentId);
    for (const { topic } of direct) {
      if (!visited.has(topic.id)) {
        visited.add(topic.id);
        traverse(topic.id, depth + 1);
        list.push({ topic, distance: depth + 1 });
      }
    }
  }

  traverse(id, 0);
  return list;
}

// Helper: Get cluster summary for a topic
export function getClusterSummary(subject: string, domain: string, age: number): Cluster | undefined {
  // Find a cluster with matching subject and domain where ageRangeStart <= age
  // Or find the closest matching age cluster
  const matches = clustersList.filter(c => c.subject === subject && c.domain === domain);
  if (matches.length === 0) return undefined;

  // Find the closest age band starting <= current age
  matches.sort((a, b) => {
    const ageA = parseInt(a.ageBand) || 0;
    const ageB = parseInt(b.ageBand) || 0;
    return ageB - ageA; // descending so first is largest <= current age
  });

  const exactOrLower = matches.find(c => {
    const start = parseInt(c.ageBand) || 0;
    return start <= age;
  });

  return exactOrLower || matches[matches.length - 1];
}
