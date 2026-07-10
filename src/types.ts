export type TopicType = 'CONCEPTUAL' | 'PROCEDURAL' | 'REPRESENTATIONAL' | 'LANGUAGE' | 'META';

export interface Topic {
  id: string;
  type: TopicType;
  subject: string;
  domain: string;
  name: string;
  description: string;
  ageRangeStart: number;
  ageRangeEnd: number;
  centrality?: number;
  evidence: string[];
  assessmentPrompt?: string;
  standards: string[];
}

export interface Dependency {
  topicId: string;
  prerequisiteId: string;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface Standard {
  key: string;
  code: string;
  name: string;
  description?: string;
  uri?: string;
}

export interface Curriculum {
  slug: string;
  name: string;
  organization: string;
  region: string;
  version?: string;
  textIncluded: boolean;
  topicCount: number;
  topics: Standard[];
}

export interface Cluster {
  subject: string;
  domain: string;
  ageBand: string;
  summary: string;
}

export interface TaxonomyManifest {
  dataset: string;
  taxonomyVersion: string;
  generatedAt: string;
  counts: {
    topics: number;
    topicsBySubject: Record<string, number>;
    dependencies: number;
    curricula: number;
    curriculumStandards: number;
    clusters: number;
  };
}
