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

export interface RepoStructure {
  tree: FileNode[];
  manifest: Record<string, unknown>;
  readme: string | null;
  languages: { name: string; percentage: number }[];
  totalFiles: number;
  totalLines: number;
}

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  lines?: number;
  extension?: string;
  children?: FileNode[];
}
