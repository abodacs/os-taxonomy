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
  data: {
    title: string;
    description?: string;
    domain?: string;
    subject?: string;
    keyStage?: string;
    yearGroup?: string;
    year?: string;
    strand?: string;
    notesAndGuidance?: string;
    subjectContentArea?: string;
    subDomain?: string;
    discipline?: string;
    externalId?: string;
    category?: string;
    workingScientifically?: string;
    cluster?: string;
    subStrand?: string;
    gradeLevel?: string;
    standardCode?: string;
    anchorStandardReference?: string;
    conceptualCategory?: string;
    [key: string]: unknown;
  };
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
