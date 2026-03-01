import type {
  FileAnalysis,
  RepoAnalysis,
  RepoStructure,
  AnnotatedFileNode,
  RepoOverview,
  ArchitectureData,
  ContributorGuide,
} from "../types/analysis.js";
import { askClaudeForJson } from "../services/claude.js";
import { buildSynthesisPrompt } from "../prompts/synthesis.js";

// Shape returned by Claude in the synthesis call
interface SynthesisResult {
  overview: {
    summary: string;
    purpose: string;
    techStack: { name: string; category: string; version?: string }[];
  };
  architecture: ArchitectureData;
  contributorGuide: ContributorGuide;
  fileTree: AnnotatedFileNode[];
}

function treeToText(nodes: { name: string; type: string; children?: unknown[] }[], indent = ""): string {
  return nodes
    .map((n) => {
      if (n.type === "directory" && n.children) {
        const children = treeToText(
          n.children as { name: string; type: string; children?: unknown[] }[],
          indent + "  "
        );
        return `${indent}${n.name}/\n${children}`;
      }
      return `${indent}${n.name}`;
    })
    .join("\n");
}

/**
 * Combines structure + file analyses into the final RepoAnalysis object.
 * Uses 1 LLM call via the synthesis prompt.
 */
export async function synthesize(
  repoName: string,
  structure: RepoStructure,
  fileAnalyses: FileAnalysis[]
): Promise<RepoAnalysis> {
  const treeText = treeToText(structure.tree);
  const prompt = buildSynthesisPrompt(repoName, structure, fileAnalyses, treeText);

  const result = await askClaudeForJson<SynthesisResult>(prompt, { maxTokens: 8192 });

  // Build the final overview, merging in stats from the scanner
  const overview: RepoOverview = {
    name: repoName,
    summary: result.overview.summary,
    purpose: result.overview.purpose,
    techStack: result.overview.techStack ?? [],
    languages: structure.languages,
    stats: {
      totalFiles: structure.totalFiles,
      totalLines: structure.totalLines,
      analyzedFiles: fileAnalyses.length,
    },
  };

  return {
    overview,
    architecture: result.architecture,
    fileTree: result.fileTree ?? [],
    contributorGuide: result.contributorGuide,
    fileAnalyses,
  };
}
