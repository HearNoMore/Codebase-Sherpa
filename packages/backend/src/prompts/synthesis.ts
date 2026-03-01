import type { FileAnalysis, RepoStructure } from "../types/analysis.js";

/**
 * Pass 4 — Synthesis prompt.
 * Combines structure + file analyses into the final RepoAnalysis shape.
 */
export function buildSynthesisPrompt(
  repoName: string,
  structure: RepoStructure,
  fileAnalyses: FileAnalysis[],
  treeText: string
): string {
  const manifestText = JSON.stringify(structure.manifest, null, 2).slice(0, 2000);
  const readmeText = structure.readme ? structure.readme.slice(0, 3000) : "(no README)";

  const analysesText = fileAnalyses
    .map(
      (f) =>
        `### ${f.path}\n${f.summary}\nPatterns: ${f.patterns.join(", ") || "none"}\nKey exports: ${f.keyExports.join(", ") || "none"}`
    )
    .join("\n\n");

  return `You are generating a comprehensive developer onboarding guide for the "${repoName}" repository.

## Project Manifest
${manifestText}

## README
${readmeText}

## Directory Structure
${treeText}

## Detailed File Analyses
${analysesText}

Generate a complete onboarding guide as a single JSON object with this exact structure:

{
  "overview": {
    "summary": "2-3 paragraph plain-language overview of the project for a new developer. What it does, how it works at a high level, and key design decisions.",
    "purpose": "One sentence: what this project does.",
    "techStack": [
      { "name": "Express", "category": "framework", "version": "4.x" }
    ]
  },
  "architecture": {
    "description": "2-3 paragraph description of the overall architecture — how the main parts fit together.",
    "components": [
      {
        "id": "unique-kebab-slug",
        "label": "Human-readable component name",
        "description": "2-3 sentences on what this component does.",
        "files": ["path/to/key/file.ts"],
        "type": "core | service | utility | external | data"
      }
    ],
    "relationships": [
      {
        "from": "component-id",
        "to": "component-id",
        "label": "brief description of interaction"
      }
    ]
  },
  "contributorGuide": {
    "setup": "Step-by-step dev environment setup instructions.",
    "addingFeatures": "Typical flow for adding a new feature — which files to touch and in what order.",
    "fixingBugs": "How to find and fix bugs — where to look, debugging tips.",
    "testing": "Testing strategy, how to run tests, how to write new tests.",
    "gotchas": ["Non-obvious thing 1", "Non-obvious thing 2"],
    "keyCommands": [
      { "command": "npm run dev", "description": "Start development server" }
    ]
  },
  "fileTree": [
    {
      "path": "src",
      "name": "src",
      "type": "directory",
      "importance": "high",
      "annotation": "One-line description of what this directory contains",
      "children": [
        {
          "path": "src/server.ts",
          "name": "server.ts",
          "type": "file",
          "importance": "high",
          "annotation": "One-line description of what this file does"
        }
      ]
    }
  ]
}

Rules:
- Be specific — reference actual file names, functions, and patterns from this codebase.
- Identify 4–8 architecture components. Group related files into components sensibly.
- File tree annotations should be one short sentence each. Only annotate directories and files that matter.
- importance must be one of: "high", "medium", "low", "ignore"
- Respond with ONLY the JSON object. No markdown fences, no explanation.`;
}
