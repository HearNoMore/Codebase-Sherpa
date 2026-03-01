import { cloneRepo, cleanupRepo } from "./cloner.js";
import { scanRepository } from "./scanner.js";
import { rankFiles } from "./fileRanker.js";
import { analyzeFiles } from "./analyzer.js";
import { synthesize } from "./synthesizer.js";
import { updateJobStatus, failJob, completeJob } from "../services/jobManager.js";
import type { RepoAnalysis } from "../types/analysis.js";

const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Runs the full analysis pipeline for a given repository URL.
 * Updates job status in the database at each stage.
 * Handles errors gracefully — always marks the job as done or error.
 */
export async function runPipeline(jobId: string, repoUrl: string): Promise<void> {
  // Wrap the entire pipeline in a timeout
  const timeoutHandle = setTimeout(async () => {
    await failJob(jobId, "Pipeline timed out after 5 minutes");
  }, PIPELINE_TIMEOUT_MS);

  let repoPath: string | null = null;

  try {
    // ── Step 1: Clone ─────────────────────────────────────────────────────
    await updateJobStatus(jobId, "cloning", 0.05, "Cloning repository...");
    repoPath = await cloneRepo(repoUrl);

    // ── Step 2: Scan ──────────────────────────────────────────────────────
    await updateJobStatus(jobId, "scanning", 0.15, "Scanning directory structure...");
    const structure = await scanRepository(repoPath);

    // Extract repo name from URL
    const repoName = extractRepoName(repoUrl);

    // Extract purpose hint from README/manifest for analyzer context
    const projectPurpose = extractPurpose(structure.manifest, structure.readme);

    // ── Step 3: Rank ──────────────────────────────────────────────────────
    await updateJobStatus(jobId, "ranking", 0.25, "Identifying key files...");
    const rankedFiles = await rankFiles(structure.tree, structure.manifest, structure.readme);

    // ── Step 4: Analyze ───────────────────────────────────────────────────
    const total = rankedFiles.length;
    const fileAnalyses = await analyzeFiles(
      rankedFiles,
      repoPath,
      repoName,
      projectPurpose,
      async (current, _total, fileName) => {
        const progress = 0.30 + (current / total) * 0.50;
        const shortName = fileName.split("/").pop() ?? fileName;
        await updateJobStatus(
          jobId,
          "analyzing",
          Math.min(progress, 0.79),
          `Analyzing ${shortName} (${current} of ${total})`
        );
      }
    );

    // ── Step 5: Synthesize ────────────────────────────────────────────────
    await updateJobStatus(jobId, "synthesizing", 0.85, "Generating overview and architecture...");
    const analysis: RepoAnalysis = await synthesize(repoName, structure, fileAnalyses);

    // ── Done ──────────────────────────────────────────────────────────────
    await completeJob(jobId, JSON.stringify(analysis));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] job ${jobId} failed:`, message);
    await failJob(jobId, message).catch(() => {
      // Best-effort — don't throw if DB update fails
    });
  } finally {
    clearTimeout(timeoutHandle);
    if (repoPath) {
      await cleanupRepo(repoPath).catch(() => {
        // Best-effort cleanup
      });
    }
  }
}

function extractRepoName(repoUrl: string): string {
  try {
    const parsed = new URL(repoUrl);
    const parts = parsed.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function extractPurpose(manifest: Record<string, unknown>, readme: string | null): string {
  // Try package.json description first
  if (typeof manifest.description === "string" && manifest.description.length > 0) {
    return manifest.description;
  }
  // Fall back to first non-heading line of README
  if (readme) {
    const lines = readme.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    if (lines.length > 0) return lines[0].slice(0, 200);
  }
  return "a software project";
}
