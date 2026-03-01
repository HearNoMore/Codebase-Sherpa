import { promises as fs, type Dirent } from "node:fs";
import path from "node:path";
import type { FileNode, RepoStructure } from "../types/analysis.js";

const MAX_FILE_COUNT = 500;

// Directories to skip entirely
const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "out", ".next", ".nuxt",
  "__pycache__", ".pytest_cache", "venv", ".venv", "env",
  "vendor", "target", ".cargo", "coverage", ".nyc_output",
  ".turbo", ".cache", "tmp", "temp",
]);

// File patterns to ignore
const IGNORED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif",
  ".mp4", ".mp3", ".wav", ".pdf", ".zip", ".tar", ".gz", ".7z",
  ".ttf", ".woff", ".woff2", ".eot",
  ".pyc", ".pyo", ".class", ".o", ".so", ".dll", ".exe",
]);

const IGNORED_FILENAMES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Gemfile.lock",
  "poetry.lock", "Cargo.lock", "composer.lock",
  ".DS_Store", "Thumbs.db",
]);

const IGNORED_FILENAME_PATTERNS = [
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.d\.ts$/,
  /\.snap$/,
];

// Extensions that map to language names
const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript",
  ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".cpp": "C++", ".cc": "C++", ".cxx": "C++",
  ".c": "C", ".h": "C",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".scala": "Scala",
  ".ex": "Elixir", ".exs": "Elixir",
  ".hs": "Haskell",
  ".lua": "Lua",
  ".r": "R",
  ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
  ".html": "HTML",
  ".css": "CSS", ".scss": "SCSS", ".sass": "SASS", ".less": "Less",
  ".json": "JSON",
  ".yaml": "YAML", ".yml": "YAML",
  ".md": "Markdown", ".mdx": "Markdown",
  ".sql": "SQL",
  ".prisma": "Prisma",
  ".graphql": "GraphQL", ".gql": "GraphQL",
};

// Manifest files to parse for project metadata
const MANIFEST_FILES = [
  "package.json", "pyproject.toml", "requirements.txt",
  "Cargo.toml", "go.mod", "Gemfile",
];

const README_PATTERNS = ["README.md", "README.rst", "README.txt", "README", "readme.md"];

function shouldIgnoreDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || name.startsWith(".");
}

function shouldIgnoreFile(name: string): boolean {
  if (IGNORED_FILENAMES.has(name)) return true;
  const ext = path.extname(name).toLowerCase();
  if (IGNORED_EXTENSIONS.has(ext)) return true;
  return IGNORED_FILENAME_PATTERNS.some((p) => p.test(name));
}

async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

interface WalkResult {
  nodes: FileNode[];
  fileCount: number;
  lineCount: number;
  languageCounts: Map<string, number>;
}

async function walkDir(
  dirPath: string,
  rootPath: string,
  fileCountRef: { count: number }
): Promise<WalkResult> {
  const nodes: FileNode[] = [];
  let lineCount = 0;
  const languageCounts = new Map<string, number>();

  let entries: Dirent<string>[];
  try {
    entries = (await fs.readdir(dirPath, { withFileTypes: true, encoding: "utf-8" })) as Dirent<string>[];
  } catch {
    return { nodes, fileCount: 0, lineCount, languageCounts };
  }

  // Sort: directories first, then files
  entries.sort((a, b) => {
    if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
    return a.isDirectory() ? -1 : 1;
  });

  for (const entry of entries) {
    if (fileCountRef.count >= MAX_FILE_COUNT) break;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);

    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) continue;

      const childResult = await walkDir(fullPath, rootPath, fileCountRef);
      // fileCountRef is incremented inside the recursive call for each file — no need to add childResult.fileCount again
      lineCount += childResult.lineCount;
      childResult.languageCounts.forEach((count, lang) => {
        languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + count);
      });

      nodes.push({
        path: relativePath,
        name: entry.name,
        type: "directory",
        children: childResult.nodes,
      });
    } else if (entry.isFile()) {
      if (shouldIgnoreFile(entry.name)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const lines = await countLines(fullPath);
      let size = 0;
      try {
        const stat = await fs.stat(fullPath);
        size = stat.size;
      } catch {
        // ignore
      }

      lineCount += lines;
      fileCountRef.count += 1;

      const lang = EXT_TO_LANGUAGE[ext];
      if (lang) {
        languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + lines);
      }

      nodes.push({
        path: relativePath,
        name: entry.name,
        type: "file",
        size,
        lines,
        extension: ext || undefined,
      });
    }
  }

  return { nodes, fileCount: nodes.filter((n) => n.type === "file").length, lineCount, languageCounts };
}

function computeLanguageBreakdown(
  languageCounts: Map<string, number>
): { name: string; percentage: number }[] {
  const total = Array.from(languageCounts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Array.from(languageCounts.entries())
    .map(([name, count]) => ({ name, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage)
    .filter((l) => l.percentage > 0);
}

async function parseManifest(repoPath: string): Promise<Record<string, unknown>> {
  for (const filename of MANIFEST_FILES) {
    const filePath = path.join(repoPath, filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      if (filename === "package.json") {
        return JSON.parse(content) as Record<string, unknown>;
      }
      // Return raw text for non-JSON manifests
      return { _raw: content, _file: filename };
    } catch {
      // File doesn't exist, try next
    }
  }
  return {};
}

async function readReadme(repoPath: string): Promise<string | null> {
  for (const filename of README_PATTERNS) {
    const filePath = path.join(repoPath, filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      // Truncate to 10k chars to avoid overloading LLM context
      return content.slice(0, 10_000);
    } catch {
      // Try next
    }
  }
  return null;
}

/**
 * Scans a cloned repository and returns its structure.
 * No LLM calls — pure filesystem analysis.
 */
export async function scanRepository(repoPath: string): Promise<RepoStructure> {
  const fileCountRef = { count: 0 };

  const [walkResult, manifest, readme] = await Promise.all([
    walkDir(repoPath, repoPath, fileCountRef),
    parseManifest(repoPath),
    readReadme(repoPath),
  ]);

  const languages = computeLanguageBreakdown(walkResult.languageCounts);

  return {
    tree: walkResult.nodes,
    manifest,
    readme,
    languages,
    totalFiles: fileCountRef.count,
    totalLines: walkResult.lineCount,
  };
}
