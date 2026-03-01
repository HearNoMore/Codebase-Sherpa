/**
 * CLI smoke-test for the full analysis pipeline.
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx src/scripts/run-pipeline.ts <github-url>
 *
 * Runs the pipeline end-to-end and writes the result JSON to stdout.
 * Does NOT use the database — useful for quick local testing.
 */
import { cloneRepo, cleanupRepo } from "../pipeline/cloner.js";
import { scanRepository } from "../pipeline/scanner.js";
import { rankFiles } from "../pipeline/fileRanker.js";
import { analyzeFiles } from "../pipeline/analyzer.js";
import { synthesize } from "../pipeline/synthesizer.js";

const repoUrl = process.argv[2];
if (!repoUrl) {
  console.error("Usage: npx tsx src/scripts/run-pipeline.ts <github-url>");
  process.exit(1);
}

(async () => {
  let repoPath: string | null = null;
  try {
    console.error(`[1/5] Cloning ${repoUrl}...`);
    repoPath = await cloneRepo(repoUrl);

    console.error("[2/5] Scanning...");
    const structure = await scanRepository(repoPath);
    console.error(`      ${structure.totalFiles} files, ${structure.totalLines} lines`);

    const repoName = repoUrl.split("/").pop()?.replace(/\.git$/, "") ?? "repo";

    console.error("[3/5] Ranking files...");
    const ranked = await rankFiles(structure.tree, structure.manifest, structure.readme);
    console.error(`      Top ${ranked.length} files selected`);

    const purpose =
      typeof structure.manifest.description === "string"
        ? structure.manifest.description
        : "a software project";

    console.error("[4/5] Analysing files...");
    const fileAnalyses = await analyzeFiles(
      ranked,
      repoPath,
      repoName,
      purpose,
      async (current, total, file) => {
        process.stderr.write(`\r      ${current}/${total} — ${file}           `);
      }
    );
    console.error(`\n      ${fileAnalyses.length} files analysed`);

    console.error("[5/5] Synthesising...");
    const analysis = await synthesize(repoName, structure, fileAnalyses);

    console.log(JSON.stringify(analysis, null, 2));
    console.error("\nDone.");
  } finally {
    if (repoPath) await cleanupRepo(repoPath).catch(() => {});
  }
})().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
