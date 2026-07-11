import { Topic, Dependency, Curriculum, Cluster, TaxonomyManifest } from "./types";
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

// Internal: DFS traversal over an adjacency list. Shared by the two transitive
// helpers below — the only difference is which adjacency list and which end
// of each Dependency edge is the neighbor.
function traverseTransitive(
  startId: string,
  adjacency: Map<string, Dependency[]>,
  getNeighborId: (dep: Dependency) => string
): { topic: Topic; distance: number }[] {
  const visited = new Set<string>();
  const list: { topic: Topic; distance: number }[] = [];

  function walk(currentId: string, depth: number) {
    const deps = adjacency.get(currentId) || [];
    for (const dep of deps) {
      const neighborId = getNeighborId(dep);
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        walk(neighborId, depth + 1);
        const topic = topicsMap.get(neighborId);
        if (topic) list.push({ topic, distance: depth + 1 });
      }
    }
  }

  walk(startId, 0);
  return list;
}

// Helper: Compute transitive prerequisites (full sub-DAG)
// Returns list of unique topic IDs in topological order (bottom-up: prerequisites first)
export function getTransitivePrerequisites(id: string): { topic: Topic; distance: number }[] {
  return traverseTransitive(id, prereqAdjacencyList, dep => dep.prerequisiteId);
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
