import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const CLONE_TIMEOUT_MS = 60_000;
const MAX_REPO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export class ClonerError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_url" | "not_found" | "private_repo" | "too_large" | "timeout" | "unknown"
  ) {
    super(message);
    this.name = "ClonerError";
  }
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function getDirSizeBytes(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getDirSizeBytes(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        total += stat.size;
      }
    })
  );
  return total;
}

async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * Clones a public GitHub repository into a temporary directory.
 * Returns the path to the cloned directory (without .git).
 * Caller is responsible for cleanup via `cleanupRepo`.
 */
export async function cloneRepo(repoUrl: string): Promise<string> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new ClonerError(`Invalid GitHub URL: ${repoUrl}`, "invalid_url");
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sherpa-"));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLONE_TIMEOUT_MS);

  try {
    await execAsync(
      `git clone --depth 1 --single-branch ${repoUrl} ${tmpDir}`,
      { signal: controller.signal }
    );
  } catch (err: unknown) {
    await removeDir(tmpDir);

    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message.includes("timed out")) {
        throw new ClonerError("Clone timed out after 60 seconds", "timeout");
      }
      const msg = err.message.toLowerCase();
      if (msg.includes("not found") || msg.includes("repository not found")) {
        throw new ClonerError(`Repository not found: ${repoUrl}`, "not_found");
      }
      if (msg.includes("authentication") || msg.includes("could not read")) {
        throw new ClonerError(
          "Repository is private or requires authentication. Only public repositories are supported.",
          "private_repo"
        );
      }
    }
    throw new ClonerError(`Clone failed: ${String(err)}`, "unknown");
  } finally {
    clearTimeout(timer);
  }

  // Remove .git directory to save space
  await removeDir(path.join(tmpDir, ".git"));

  // Check size after clone
  const sizeBytes = await getDirSizeBytes(tmpDir);
  if (sizeBytes > MAX_REPO_SIZE_BYTES) {
    await removeDir(tmpDir);
    const sizeMB = Math.round(sizeBytes / 1024 / 1024);
    throw new ClonerError(
      `Repository is too large (${sizeMB} MB). Maximum supported size is 100 MB.`,
      "too_large"
    );
  }

  return tmpDir;
}

/** Removes the cloned repository directory. */
export async function cleanupRepo(repoPath: string): Promise<void> {
  await removeDir(repoPath);
}
