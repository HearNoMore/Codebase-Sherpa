// Mirror of packages/backend/src/types/analysis.ts
// Keep in sync manually — no build-time sharing in this monorepo setup.

export interface RepoAnalysis {
  overview: RepoOverview;
  architecture: ArchitectureData;
  fileTree: AnnotatedFileNode[];
  contributorGuide: ContributorGuide;
  fileAnalyses: FileAnalysis[];
}

export interface RepoOverview {
  name: string;
  summary: string;
  purpose: string;
  techStack: TechStackItem[];
  languages: { name: string; percentage: number }[];
  stats: {
    totalFiles: number;
    totalLines: number;
    analyzedFiles: number;
  };
}

export interface TechStackItem {
  name: string;
  category: string;
  version?: string;
}

export interface ArchitectureData {
  description: string;
  components: ArchitectureComponent[];
  relationships: ArchitectureRelationship[];
}

export interface ArchitectureComponent {
  id: string;
  label: string;
  description: string;
  files: string[];
  type: "core" | "service" | "utility" | "external" | "data";
}

export interface ArchitectureRelationship {
  from: string;
  to: string;
  label: string;
}

export interface AnnotatedFileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  annotation?: string;
  importance: "high" | "medium" | "low" | "ignore";
  children?: AnnotatedFileNode[];
}

export interface ContributorGuide {
  setup: string;
  addingFeatures: string;
  fixingBugs: string;
  testing: string;
  gotchas: string[];
  keyCommands: { command: string; description: string }[];
}

export interface FileAnalysis {
  path: string;
  summary: string;
  patterns: string[];
  dependencies: string[];
  keyExports: string[];
}

// API response shapes
export interface JobStatus {
  jobId: string;
  status:
    | "queued"
    | "cloning"
    | "scanning"
    | "ranking"
    | "analyzing"
    | "synthesizing"
    | "done"
    | "error";
  progress: number;
  currentStep: string | null;
  errorMessage?: string | null;
}

export interface AnalysisResult {
  jobId: string;
  repoUrl: string;
  repoName: string;
  analysis: RepoAnalysis;
  createdAt: string;
}

export interface RecentJob {
  id: string;
  repoUrl: string;
  repoName: string;
  createdAt: string;
}
