import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileAnalysis, FileNode } from "../types/analysis.js";
import { askClaudeForJson } from "../services/claude.js";
import { buildFileAnalysisPrompt } from "../prompts/fileAnalysis.js";

const BATCH_SIZE = 4;
const MAX_CONCURRENCY = 3;
const MAX_FILE_BYTES = 50_000; // ~50KB per file; truncate if larger
const PER_FILE_TIMEOUT_MS = 30_000;

export type ProgressCallback = (current: number, total: number, fileName: string) => Promise<void>;

/**
 * Reads a file and returns its content, truncated if too large.
 */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_BYTES * 5) return null; // skip very large files entirely
    const content = await fs.readFile(filePath, "utf-8");
    return content.length > MAX_FILE_BYTES
      ? content.slice(0, MAX_FILE_BYTES) + "\n... [truncated]"
      : content;
  } catch {
    return null;
  }
}

/**
 * Analyses one batch of files in a single Claude call.
 * Returns an empty array for the batch if the call fails.
 */
async function analyseBatch(
  projectName: string,
  projectPurpose: string,
  topLevelDirs: string[],
  files: Array<{ path: string; content: string }>
): Promise<FileAnalysis[]> {
  const prompt = buildFileAnalysisPrompt(projectName, projectPurpose, topLevelDirs, files);

  const timeoutPromise = new Promise<FileAnalysis[]>((_, reject) =>
    setTimeout(() => reject(new Error("File analysis batch timed out")), PER_FILE_TIMEOUT_MS)
  );

  const analysisPromise = askClaudeForJson<FileAnalysis[]>(prompt, { maxTokens: 4096 });

  try {
    const results = await Promise.race([analysisPromise, timeoutPromise]);
    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.warn("[analyzer] batch failed:", err);
    // Return stub entries so the pipeline can continue
    return files.map((f) => ({
      path: f.path,
      summary: "Analysis failed for this file.",
      patterns: [],
      dependencies: [],
      keyExports: [],
    }));
  }
}

/**
 * Runs a pool of promises with limited concurrency.
 */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index++;
      results[current] = await tasks[current]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/**
 * Performs deep analysis on all ranked files.
 * Uses batched LLM calls with concurrency limiting.
 */
export async function analyzeFiles(
  rankedFiles: FileNode[],
  repoPath: string,
  projectName: string,
  projectPurpose: string,
  onProgress?: ProgressCallback
): Promise<FileAnalysis[]> {
  // Discover top-level directories for context
  const topLevelDirs = [
    ...new Set(
      rankedFiles
        .map((f) => f.path.split("/")[0])
        .filter((d) => d && !d.includes("."))
    ),
  ];

  // Read all file contents
  const fileContents: Array<{ path: string; content: string }> = [];
  for (const file of rankedFiles) {
    const absPath = path.join(repoPath, file.path);
    const content = await readFileSafe(absPath);
    if (content !== null) {
      fileContents.push({ path: file.path, content });
    }
  }

  // Split into batches
  const batches: Array<Array<{ path: string; content: string }>> = [];
  for (let i = 0; i < fileContents.length; i += BATCH_SIZE) {
    batches.push(fileContents.slice(i, i + BATCH_SIZE));
  }

  let completedFiles = 0;
  const total = fileContents.length;

  // Build tasks for concurrency pool
  const tasks = batches.map((batch) => async () => {
    const results = await analyseBatch(projectName, projectPurpose, topLevelDirs, batch);
    completedFiles += batch.length;
    const lastFile = batch[batch.length - 1].path;
    if (onProgress) {
      await onProgress(completedFiles, total, lastFile);
    }
    return results;
  });

  const batchResults = await withConcurrency(tasks, MAX_CONCURRENCY);

  return batchResults.flat();
}
