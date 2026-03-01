import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanRepository } from "./scanner.js";

let fixtureDir: string;

// Build a small fixture repo on disk before tests run
beforeAll(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "sherpa-scan-test-"));

  // package.json
  await fs.writeFile(
    path.join(fixtureDir, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0", dependencies: { express: "^4.0.0" } })
  );

  // README
  await fs.writeFile(path.join(fixtureDir, "README.md"), "# Fixture\nA test fixture.");

  // src/index.ts
  await fs.mkdir(path.join(fixtureDir, "src"), { recursive: true });
  await fs.writeFile(
    path.join(fixtureDir, "src/index.ts"),
    'import express from "express";\nconst app = express();\n'
  );
  await fs.writeFile(
    path.join(fixtureDir, "src/utils.ts"),
    "export const add = (a: number, b: number) => a + b;\n"
  );

  // node_modules (should be ignored)
  await fs.mkdir(path.join(fixtureDir, "node_modules/some-pkg"), { recursive: true });
  await fs.writeFile(
    path.join(fixtureDir, "node_modules/some-pkg/index.js"),
    "module.exports = {};\n"
  );

  // dist (should be ignored)
  await fs.mkdir(path.join(fixtureDir, "dist"), { recursive: true });
  await fs.writeFile(path.join(fixtureDir, "dist/index.js"), "// compiled\n");

  // Binary image file (should be ignored)
  await fs.writeFile(path.join(fixtureDir, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  // Lock file (should be ignored)
  await fs.writeFile(path.join(fixtureDir, "package-lock.json"), "{}");
});

afterAll(async () => {
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

describe("scanRepository", () => {
  it("returns a RepoStructure with the correct shape", async () => {
    const result = await scanRepository(fixtureDir);

    expect(result).toHaveProperty("tree");
    expect(result).toHaveProperty("manifest");
    expect(result).toHaveProperty("readme");
    expect(result).toHaveProperty("languages");
    expect(result).toHaveProperty("totalFiles");
    expect(result).toHaveProperty("totalLines");
  });

  it("reads the manifest from package.json", async () => {
    const result = await scanRepository(fixtureDir);
    expect(result.manifest).toMatchObject({ name: "fixture", version: "1.0.0" });
  });

  it("reads the README", async () => {
    const result = await scanRepository(fixtureDir);
    expect(result.readme).toContain("# Fixture");
  });

  it("excludes node_modules from the file tree", async () => {
    const result = await scanRepository(fixtureDir);
    const paths = result.tree.map((n) => n.name);
    expect(paths).not.toContain("node_modules");
  });

  it("excludes dist from the file tree", async () => {
    const result = await scanRepository(fixtureDir);
    const paths = result.tree.map((n) => n.name);
    expect(paths).not.toContain("dist");
  });

  it("excludes binary files (png)", async () => {
    const result = await scanRepository(fixtureDir);
    const allFiles = flattenTree(result.tree);
    expect(allFiles.map((f) => f.name)).not.toContain("logo.png");
  });

  it("excludes lock files", async () => {
    const result = await scanRepository(fixtureDir);
    const allFiles = flattenTree(result.tree);
    expect(allFiles.map((f) => f.name)).not.toContain("package-lock.json");
  });

  it("includes TypeScript source files", async () => {
    const result = await scanRepository(fixtureDir);
    const allFiles = flattenTree(result.tree);
    const names = allFiles.map((f) => f.name);
    expect(names).toContain("index.ts");
    expect(names).toContain("utils.ts");
  });

  it("reports TypeScript in language breakdown", async () => {
    const result = await scanRepository(fixtureDir);
    const langNames = result.languages.map((l) => l.name);
    expect(langNames).toContain("TypeScript");
  });

  it("counts files correctly (only non-ignored source files)", async () => {
    const result = await scanRepository(fixtureDir);
    // src/index.ts + src/utils.ts + README.md + package.json = 4
    expect(result.totalFiles).toBe(4);
  });

  it("reports positive totalLines", async () => {
    const result = await scanRepository(fixtureDir);
    expect(result.totalLines).toBeGreaterThan(0);
  });
});

function flattenTree(nodes: { name: string; type: string; children?: typeof nodes }[]): { name: string; type: string }[] {
  return nodes.flatMap((n) => [n, ...(n.children ? flattenTree(n.children) : [])]);
}
