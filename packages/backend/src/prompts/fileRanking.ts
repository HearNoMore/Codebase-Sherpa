/**
 * Pass 2 — File ranking prompt.
 * Given the directory tree (paths only) + manifest + README, ask Claude to
 * identify the top 30 most architecturally important files.
 */
export function buildFileRankingPrompt(
  treeText: string,
  manifestText: string,
  readmeText: string | null
): string {
  const readmeSection = readmeText
    ? `\n\n## README\n${readmeText.slice(0, 3000)}`
    : "";

  return `You are analyzing a software repository to help a new developer understand it.

## Project Manifest
${manifestText}${readmeSection}

## Directory Structure
${treeText}

Based on the project structure and manifest above, identify the top 30 most architecturally important files that a new developer should read to understand how this codebase works.

Consider:
- Entry points (index, main, app, server files)
- Core business logic
- API/route definitions
- Data models and schema files
- Key services, utilities, and middleware
- Configuration files with meaningful content

Return ONLY a JSON array of file paths, ordered from most to least important. Do not include directories, only files. Example:
["src/server.ts", "src/app.ts", "src/routes/users.ts"]`;
}
