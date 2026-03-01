import path from "node:path";
import type { FileNode } from "../types/analysis.js";
import { askClaudeForJson } from "../services/claude.js";
import { buildFileRankingPrompt } from "../prompts/fileRanking.js";

const MAX_RANKED_FILES = 40;

// ── Heuristic scoring ────────────────────────────────────────────────────────

const ENTRY_POINT_NAMES = new Set(["index", "main", "app", "server", "index.ts", "main.ts", "app.ts", "server.ts"]);
const ROUTE_KEYWORDS = ["route", "routes", "router", "controller", "controllers", "handler", "handlers", "api"];
const CONFIG_KEYWORDS = ["config", "configuration", "settings", "setup", "bootstrap", "init"];

function heuristicScore(node: FileNode): number {
  if (node.type !== "file") return -Infinity;

  const name = node.name.toLowerCase();
  const baseName = path.basename(name, path.extname(name));
  const parts = node.path.toLowerCase().split("/");
  const ext = path.extname(name).toLowerCase();
  const depth = parts.length - 1;

  let score = 0;

  // Entry points
  if (ENTRY_POINT_NAMES.has(name) || ENTRY_POINT_NAMES.has(baseName)) score += 10;

  // Route/controller files
  if (ROUTE_KEYWORDS.some((k) => name.includes(k) || parts.some((p) => p === k))) score += 8;

  // Config files
  if (CONFIG_KEYWORDS.some((k) => name.includes(k))) score += 6;

  // Files in src/ root (depth 2 = src/file.ts)
  if (parts[0] === "src" && depth === 1) score += 5;

  // Test files — de-prioritise
  if (name.includes(".test.") || name.includes(".spec.") || parts.includes("__tests__") || parts.includes("test")) {
    score -= 5;
  }

  // Type-only definition files
  if (name.includes(".d.ts") || baseName === "types" || baseName === "type") score -= 3;

  // Very small files (≤10 lines)
  if (node.lines !== undefined && node.lines <= 10) score -= 5;

  // Large files (>500 lines) — likely substantial
  if (node.lines !== undefined && node.lines > 500) score += 3;

  // Depth penalty — deeper files are less likely to be entry-level important
  score -= depth * 2;

  // Schema / model files
  if (name.includes("schema") || name.includes("model") || name.includes("entity")) score += 7;

  // Prisma schema
  if (ext === ".prisma") score += 9;

  return score;
}

// ── Tree helpers ─────────────────────────────────────────────────────────────

function flattenTree(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((n) => (n.type === "directory" ? flattenTree(n.children ?? []) : [n]));
}

function treeToText(nodes: FileNode[], indent = ""): string {
  return nodes
    .map((n) => {
      if (n.type === "directory") {
        const children = treeToText(n.children ?? [], indent + "  ");
        return `${indent}${n.name}/\n${children}`;
      }
      return `${indent}${n.name}`;
    })
    .join("\n");
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Identifies the most important files to analyse.
 * Returns up to MAX_RANKED_FILES FileNode objects, ordered by importance.
 */
export async function rankFiles(
  tree: FileNode[],
  manifest: Record<string, unknown>,
  readme: string | null
): Promise<FileNode[]> {
  const allFiles = flattenTree(tree);

  // Step 1: heuristic pre-score
  const scored = allFiles
    .map((f) => ({ node: f, score: heuristicScore(f) }))
    .sort((a, b) => b.score - a.score);

  // Step 2: build tree text for LLM
  const treeText = treeToText(tree);
  const manifestText = JSON.stringify(manifest, null, 2).slice(0, 2000);

  const prompt = buildFileRankingPrompt(treeText, manifestText, readme);

  // Step 3: ask Claude for top 30 important paths
  let llmPaths: string[] = [];
  try {
    llmPaths = await askClaudeForJson<string[]>(prompt, { maxTokens: 1024 });
    if (!Array.isArray(llmPaths)) llmPaths = [];
  } catch (err) {
    console.warn("[fileRanker] LLM ranking failed, falling back to heuristics:", err);
  }

  // Build a path→score map for LLM results (rank 0 = highest priority)
  const llmRankMap = new Map<string, number>(
    llmPaths.map((p, i) => [normalise(p), llmPaths.length - i])
  );

  // Step 4: combine heuristic + LLM scores
  const combined = scored.map(({ node, score }) => {
    const llmBonus = llmRankMap.get(normalise(node.path)) ?? 0;
    return { node, combined: score + llmBonus * 2 };
  });
  combined.sort((a, b) => b.combined - a.combined);

  return combined.slice(0, MAX_RANKED_FILES).map((x) => x.node);
}

function normalise(p: string): string {
  return p.replace(/^\.\//, "").trim();
}
