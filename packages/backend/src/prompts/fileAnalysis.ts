/**
 * Pass 3 — Per-file analysis prompt.
 * Analyzes a batch of source files and returns structured FileAnalysis objects.
 */
export function buildFileAnalysisPrompt(
  projectName: string,
  projectPurpose: string,
  topLevelDirs: string[],
  files: Array<{ path: string; content: string }>
): string {
  const fileBlocks = files
    .map(
      (f) =>
        `--- File: ${f.path} ---\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``
    )
    .join("\n\n");

  return `You are analyzing source files from the "${projectName}" project — ${projectPurpose}.
The main directories are: ${topLevelDirs.join(", ")}.

For each file below, provide a structured analysis as a JSON array.

Each element must have exactly these fields:
- "path": the exact file path given
- "summary": 2-3 sentences explaining what this file does and why it exists
- "patterns": array of design/architectural patterns used (e.g. "middleware pattern", "repository pattern", "singleton", "factory")
- "dependencies": array of other files in THIS project that this file depends on or interacts with (relative paths, not npm packages)
- "keyExports": array of main functions, classes, types, or values this file exports

${fileBlocks}

Respond with ONLY a JSON array. Do not include any explanation outside the JSON.`;
}
