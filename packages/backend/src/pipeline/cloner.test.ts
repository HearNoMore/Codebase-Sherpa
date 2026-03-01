import { describe, expect, it } from "vitest";
import { parseGitHubUrl, ClonerError, cloneRepo, cleanupRepo } from "./cloner.js";
import { promises as fs } from "node:fs";

// ── parseGitHubUrl ──────────────────────────────────────────────────────────

describe("parseGitHubUrl", () => {
  it("parses a standard GitHub URL", () => {
    expect(parseGitHubUrl("https://github.com/expressjs/express")).toEqual({
      owner: "expressjs",
      repo: "express",
    });
  });

  it("parses a URL with .git suffix", () => {
    expect(parseGitHubUrl("https://github.com/expressjs/express.git")).toEqual({
      owner: "expressjs",
      repo: "express",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGitHubUrl("https://gitlab.com/user/repo")).toBeNull();
  });

  it("returns null for URLs without a repo path", () => {
    expect(parseGitHubUrl("https://github.com/expressjs")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(parseGitHubUrl("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGitHubUrl("")).toBeNull();
  });
});

// ── cloneRepo integration ───────────────────────────────────────────────────

describe("cloneRepo", { timeout: 90_000 }, () => {
  it("throws ClonerError with code invalid_url for a non-GitHub URL", async () => {
    await expect(cloneRepo("https://example.com/foo/bar")).rejects.toMatchObject({
      code: "invalid_url",
    });
  });

  it("throws ClonerError with code not_found for a nonexistent repo", async () => {
    await expect(
      cloneRepo("https://github.com/this-org-does-not-exist-xyz/this-repo-does-not-exist-xyz")
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("clones a small public repo and returns a valid directory path", async () => {
    // hello-world is a tiny GitHub repo (~1KB) — safe for integration tests
    const repoPath = await cloneRepo("https://github.com/octocat/Hello-World");

    try {
      const stat = await fs.stat(repoPath);
      expect(stat.isDirectory()).toBe(true);

      // .git should be removed
      await expect(fs.stat(`${repoPath}/.git`)).rejects.toThrow();
    } finally {
      await cleanupRepo(repoPath);
    }
  });

  it("cleanupRepo removes the directory", async () => {
    const repoPath = await cloneRepo("https://github.com/octocat/Hello-World");
    await cleanupRepo(repoPath);
    await expect(fs.stat(repoPath)).rejects.toThrow();
  });
});
