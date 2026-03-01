import type { RepoAnalysis } from "../types/analysis.js";

/**
 * Builds the system prompt for the chat endpoint.
 * Injects the full RepoAnalysis as context so Claude can answer
 * specific questions about the codebase.
 */
export function buildChatSystemPrompt(analysis: RepoAnalysis): string {
  const { overview, architecture, fileAnalyses, contributorGuide } = analysis;

  const components = architecture.components
    .map((c) => `- **${c.label}** (${c.files.join(", ")}): ${c.description}`)
    .join("\n");

  const relationships = architecture.relationships
    .map((r) => `- ${r.from} → ${r.to}: ${r.label}`)
    .join("\n");

  const fileContext = fileAnalyses
    .map(
      (f) =>
        `### ${f.path}\n${f.summary}\nPatterns: ${f.patterns.join(", ") || "none"}\nKey exports: ${f.keyExports.join(", ") || "none"}`
    )
    .join("\n\n");

  return `You are an expert developer who deeply understands the ${overview.name} codebase. You are helping a new developer get up to speed.

## Project Overview
${overview.summary}

**Purpose:** ${overview.purpose}

**Tech stack:** ${overview.techStack.map((t) => `${t.name} (${t.category})`).join(", ")}

## Architecture
${architecture.description}

### Components
${components}

### How Components Connect
${relationships}

## Key File Analyses
${fileContext}

## Contributor Guide
**Setup:** ${contributorGuide.setup}
**Adding features:** ${contributorGuide.addingFeatures}
**Fixing bugs:** ${contributorGuide.fixingBugs}
**Testing:** ${contributorGuide.testing}
**Gotchas:** ${contributorGuide.gotchas.join("; ")}

---

Answer the developer's questions about this codebase. Be specific — reference actual file names, functions, and patterns. If they ask about something not covered in the analysis, say so honestly and suggest where they might look. Keep answers focused and practical.`;
}
