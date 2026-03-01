# Codebase Sherpa — Project Specification

## Branding

- **Name:** Codebase Sherpa
- **Tagline:** "Your guide to any repository"
- **Alternate taglines (for marketing/demo):**
  - "From git clone to contribution-ready"
  - "The codebase tour you wish you'd gotten on day one"
  - "Understand any codebase in 60 seconds"

## Overview

**Codebase Sherpa** is a web application that takes a GitHub repository URL and generates an interactive onboarding guide for new developers. It answers the question: *"I just found this codebase — how do I understand it and start contributing?"*

The tool analyzes the repository's structure, code patterns, and architecture using Claude's API, then presents the results as an interactive dashboard with an AI chat interface for follow-up questions.

### Target Audience

- **Open-source maintainers** who want to reduce onboarding friction for new contributors
- **Engineering teams** onboarding new hires to a codebase
- **Solo learners** studying open-source projects to learn patterns

### Core Value Proposition

READMEs cover setup, not architecture. Generated docs (JSDoc, Sphinx) document individual functions but miss the big picture. This tool provides what a patient senior engineer would explain on your first day: how the pieces fit together, where the important stuff lives, and the mental model you need to be productive.

---

## Tech Stack

| Layer         | Technology                        |
| ------------- | --------------------------------- |
| Frontend      | React + TypeScript + Vite         |
| Backend       | Node.js + Express + TypeScript    |
| Database      | SQLite via Prisma                 |
| LLM           | Claude API (Anthropic SDK)        |
| Diagram       | React Flow                        |
| Monorepo      | npm workspaces                    |
| Styling       | Tailwind CSS                      |

---

## Project Structure

```
codebase-sherpa/
├── packages/
│   ├── frontend/                    # React + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── RepoInput.tsx              # URL input + analyze button
│   │   │   │   ├── ProgressTracker.tsx         # Real-time pipeline progress
│   │   │   │   ├── Overview.tsx                # Project summary + tech stack
│   │   │   │   ├── ArchitectureDiagram.tsx     # Interactive React Flow diagram
│   │   │   │   ├── FileExplorer.tsx            # Annotated file tree
│   │   │   │   ├── ContributorGuide.tsx        # How-to-contribute sections
│   │   │   │   └── ChatPanel.tsx               # Ask questions about the repo
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx                    # Landing page with URL input
│   │   │   │   └── Analysis.tsx                # Dashboard with all panels
│   │   │   ├── hooks/
│   │   │   │   ├── useAnalysisStatus.ts        # Polls job status
│   │   │   │   └── useChat.ts                  # Chat streaming hook
│   │   │   ├── types/
│   │   │   │   └── analysis.ts                 # Shared types (mirrors backend)
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── backend/                     # Node + Express + TypeScript
│       ├── src/
│       │   ├── routes/
│       │   │   ├── analyze.ts                  # POST /api/analyze
│       │   │   ├── status.ts                   # GET /api/status/:jobId
│       │   │   ├── results.ts                  # GET /api/results/:jobId
│       │   │   └── chat.ts                     # POST /api/chat (streamed)
│       │   ├── pipeline/
│       │   │   ├── index.ts                    # Pipeline orchestrator
│       │   │   ├── cloner.ts                   # Git clone + cleanup
│       │   │   ├── scanner.ts                  # Directory structure analysis
│       │   │   ├── fileRanker.ts               # Smart file importance ranking
│       │   │   ├── analyzer.ts                 # Per-file LLM analysis
│       │   │   ├── synthesizer.ts              # Combine into final outputs
│       │   │   └── diagramGenerator.ts         # Architecture → React Flow JSON
│       │   ├── services/
│       │   │   ├── claude.ts                   # Claude API wrapper + helpers
│       │   │   ├── github.ts                   # GitHub clone + metadata
│       │   │   └── jobManager.ts               # Job state management
│       │   ├── prompts/
│       │   │   ├── skeleton.ts                 # Pass 1: project overview prompt
│       │   │   ├── fileRanking.ts              # Pass 2: file importance prompt
│       │   │   ├── fileAnalysis.ts             # Pass 3: per-file analysis prompt
│       │   │   ├── synthesis.ts                # Pass 4: synthesis prompt
│       │   │   └── chat.ts                     # Chat context prompt
│       │   ├── types/
│       │   │   └── analysis.ts                 # Core data types
│       │   ├── app.ts                          # Express app setup
│       │   └── server.ts                       # Server entry point
│       ├── prisma/
│       │   └── schema.prisma                   # Database schema
│       ├── tsconfig.json
│       └── package.json
│
├── package.json                      # Monorepo root
├── tsconfig.base.json                # Shared TypeScript config
└── README.md
```

---

## Data Models

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model AnalysisJob {
  id            String   @id @default(uuid())
  repoUrl       String
  repoName      String
  status        String   @default("queued")   // queued | cloning | scanning | ranking | analyzing | synthesizing | done | error
  progress      Float    @default(0)          // 0.0 to 1.0
  currentStep   String?                        // Human-readable current step
  errorMessage  String?
  result        String?                        // JSON string of RepoAnalysis
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([repoUrl])
}
```

### Core TypeScript Types

```typescript
// packages/backend/src/types/analysis.ts
// (Mirror these in packages/frontend/src/types/analysis.ts)

export interface RepoAnalysis {
  overview: RepoOverview;
  architecture: ArchitectureData;
  fileTree: AnnotatedFileNode[];
  contributorGuide: ContributorGuide;
  fileAnalyses: FileAnalysis[];       // Powers the chat context
}

export interface RepoOverview {
  name: string;
  summary: string;                     // 2-3 paragraph plain-language summary
  purpose: string;                     // One-sentence purpose
  techStack: TechStackItem[];
  languages: { name: string; percentage: number }[];
  stats: {
    totalFiles: number;
    totalLines: number;
    analyzedFiles: number;
  };
}

export interface TechStackItem {
  name: string;                        // e.g. "Express", "React", "PostgreSQL"
  category: string;                    // e.g. "framework", "database", "testing"
  version?: string;
}

export interface ArchitectureData {
  description: string;                 // Prose description of the architecture
  components: ArchitectureComponent[];
  relationships: ArchitectureRelationship[];
}

export interface ArchitectureComponent {
  id: string;
  label: string;                       // e.g. "API Layer", "Auth Service"
  description: string;                 // What this component does
  files: string[];                     // Key files in this component
  type: "core" | "service" | "utility" | "external" | "data";
}

export interface ArchitectureRelationship {
  from: string;                        // component id
  to: string;                          // component id
  label: string;                       // e.g. "authenticates via", "queries"
}

export interface AnnotatedFileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  annotation?: string;                 // AI-generated explanation
  importance: "high" | "medium" | "low" | "ignore";
  children?: AnnotatedFileNode[];
}

export interface ContributorGuide {
  setup: string;                       // How to set up the dev environment
  addingFeatures: string;              // Typical flow for adding a feature
  fixingBugs: string;                  // How to find and fix bugs
  testing: string;                     // Testing strategy and how to run tests
  gotchas: string[];                   // Non-obvious things to watch out for
  keyCommands: { command: string; description: string }[];
}

export interface FileAnalysis {
  path: string;
  summary: string;                     // What this file does
  patterns: string[];                  // Design patterns used
  dependencies: string[];              // Other files this depends on
  keyExports: string[];                // Main things this file exports/exposes
}
```

---

## API Design

### POST /api/analyze

Starts a new analysis job.

**Request:**
```json
{
  "repoUrl": "https://github.com/expressjs/express"
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Validation:**
- URL must be a valid GitHub repository URL
- Reject if repo has already been analyzed and results exist (return existing jobId instead)
- Reject private repos (they require auth tokens — out of scope for v1)

---

### GET /api/status/:jobId

Polls the current status of an analysis job. The frontend polls this every 1-2 seconds.

**Response:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "analyzing",
  "progress": 0.45,
  "currentStep": "Analyzing src/middleware/auth.ts (7 of 24 files)"
}
```

**Status values and their progress ranges:**
| Status        | Progress Range | Description                          |
| ------------- | -------------- | ------------------------------------ |
| queued        | 0.00           | Job created, waiting to start        |
| cloning       | 0.00 – 0.10   | Cloning the repository               |
| scanning      | 0.10 – 0.20   | Analyzing directory structure        |
| ranking       | 0.20 – 0.30   | Identifying important files          |
| analyzing     | 0.30 – 0.80   | Deep analysis of individual files    |
| synthesizing  | 0.80 – 0.95   | Generating final outputs             |
| done          | 1.00           | Analysis complete                    |
| error         | —              | Something went wrong                 |

---

### GET /api/results/:jobId

Returns the full analysis results. Only available when status is "done".

**Response:**
```json
{
  "jobId": "a1b2c3d4-...",
  "repoUrl": "https://github.com/expressjs/express",
  "repoName": "express",
  "analysis": { /* RepoAnalysis object */ },
  "createdAt": "2026-03-01T12:00:00Z"
}
```

---

### POST /api/chat

Send a question about the analyzed repo. Response is streamed via Server-Sent Events.

**Request:**
```json
{
  "jobId": "a1b2c3d4-...",
  "message": "How does the middleware pipeline work?",
  "history": [
    { "role": "user", "content": "What is this project?" },
    { "role": "assistant", "content": "Express is a..." }
  ]
}
```

**Response:** Server-Sent Events stream

```
data: {"type": "text_delta", "text": "The middleware"}
data: {"type": "text_delta", "text": " pipeline in Express"}
data: {"type": "text_delta", "text": " works by..."}
data: {"type": "done"}
```

---

## Processing Pipeline — Detailed Implementation

### Pipeline Orchestrator (pipeline/index.ts)

```typescript
export async function runPipeline(jobId: string, repoUrl: string): Promise<void> {
  const updateStatus = async (status: string, progress: number, currentStep?: string) => {
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { status, progress, currentStep }
    });
  };

  try {
    // Step 1: Clone
    await updateStatus("cloning", 0.05, "Cloning repository...");
    const repoPath = await cloneRepo(repoUrl);

    // Step 2: Scan
    await updateStatus("scanning", 0.15, "Scanning directory structure...");
    const structure = await scanRepository(repoPath);

    // Step 3: Rank
    await updateStatus("ranking", 0.25, "Identifying key files...");
    const rankedFiles = await rankFiles(structure);

    // Step 4: Analyze
    const fileAnalyses = await analyzeFiles(rankedFiles, repoPath, async (current, total, fileName) => {
      const progress = 0.30 + (current / total) * 0.50;
      await updateStatus("analyzing", progress, `Analyzing ${fileName} (${current}/${total})`);
    });

    // Step 5: Synthesize
    await updateStatus("synthesizing", 0.85, "Generating overview and architecture...");
    const analysis = await synthesize(structure, fileAnalyses);

    // Done
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        progress: 1.0,
        currentStep: "Complete",
        result: JSON.stringify(analysis)
      }
    });

    // Cleanup cloned repo
    await cleanup(repoPath);

  } catch (error) {
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      }
    });
  }
}
```

---

### Step 1: Cloner (pipeline/cloner.ts)

Clones the repository with minimal overhead.

**Logic:**
1. Validate the GitHub URL format
2. Run `git clone --depth 1 --single-branch <url> <tempDir>`
3. Set a 60-second timeout on the clone operation
4. After cloning, check total size — reject if > 100MB
5. Delete `.git` directory to save space
6. Return the path to the cloned directory

**Edge cases:**
- Non-existent repo → catch git error, return meaningful message
- Private repo → detect auth failure, suggest user make it public
- Huge repo → reject with size warning after clone
- Timeout → kill process, clean up temp dir

---

### Step 2: Scanner (pipeline/scanner.ts)

Builds an annotated directory tree. **No LLM calls needed** — this is pure heuristics.

**Logic:**
1. Recursively walk the directory tree
2. For each file/directory, collect: path, name, size, extension, line count
3. Identify and tag "noise" to ignore:
   - `node_modules/`, `vendor/`, `.git/`, `dist/`, `build/`, `__pycache__/`
   - Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`
   - Binary files and images
   - Generated files (`.min.js`, `.map`, etc.)
4. Read and parse manifest files for tech stack info:
   - `package.json` → name, dependencies, scripts
   - `tsconfig.json` → TypeScript config
   - `pyproject.toml` / `requirements.txt` → Python deps
   - `Cargo.toml` → Rust deps
   - `go.mod` → Go deps
   - `Gemfile` → Ruby deps
5. Read the README if it exists
6. Calculate language breakdown from file extensions
7. Return a `RepoStructure` object:

```typescript
interface RepoStructure {
  tree: FileNode[];                    // Full directory tree (minus ignored dirs)
  manifest: Record<string, any>;       // Parsed package.json or equivalent
  readme: string | null;               // README contents
  languages: { name: string; percentage: number }[];
  totalFiles: number;
  totalLines: number;
}
```

---

### Step 3: File Ranker (pipeline/fileRanker.ts)

Identifies the most architecturally important files. Uses **1 LLM call**.

**Heuristic pre-scoring (before LLM):**
- Entry points (`index.ts`, `main.ts`, `app.ts`, `server.ts`) → +10
- Route/controller files → +8
- Config files (non-trivial) → +6
- Files in `src/` root → +5
- Deeply nested files → -2
- Test files (`*.test.ts`, `*.spec.ts`) → -5
- Type definition files → -3
- Very small files (< 10 lines) → -5
- Very large files (> 500 lines) → +3 (likely important)

**LLM call:**
Send the directory tree (paths only, not contents) plus the manifest/README to Claude and ask:

> Given this project structure and manifest, identify the top 30 most architecturally important files that a new developer should understand to grasp how this codebase works. Consider: entry points, core business logic, routing/API definitions, data models, key services, and configuration. Return as a JSON array of file paths, ordered by importance.

**Combine** the heuristic scores with the LLM ranking. Take the top 30-50 files.

---

### Step 4: Analyzer (pipeline/analyzer.ts)

Performs deep analysis on each important file. Uses **8-15 LLM calls** (batched).

**Logic:**
1. Read the contents of each ranked file
2. Group files into batches of 3-5 (to reduce number of API calls)
3. For each batch, send to Claude:

> Analyze each of the following source files from the project "[project name]". For each file, provide:
> 1. **summary**: A 2-3 sentence explanation of what this file does and why it exists
> 2. **patterns**: Design patterns or architectural patterns used (e.g., "singleton", "middleware pattern", "repository pattern", "factory")
> 3. **dependencies**: Other files in this project that this file depends on or interacts with
> 4. **keyExports**: The main functions, classes, or values this file exports
>
> Context: This is a [framework] project that [purpose from README]. The main directories are: [top-level dirs].
>
> Respond as a JSON array of objects with fields: path, summary, patterns, dependencies, keyExports.
>
> Files:
> ---
> File: [path]
> ```
> [file contents]
> ```
> ---
> [repeat for each file in batch]

4. Run batches with concurrency limit of 3 parallel requests
5. Report progress via callback after each batch completes

---

### Step 5: Synthesizer (pipeline/synthesizer.ts)

Combines everything into the final `RepoAnalysis`. Uses **1-2 LLM calls**.

**LLM Call 1 — Overview + Architecture + Contributor Guide:**

> You are analyzing the codebase of "[repo name]" to help new developers understand it.
>
> Here is the project structure:
> [directory tree with file annotations from scanner]
>
> Here is the manifest:
> [package.json or equivalent]
>
> Here is the README:
> [README contents]
>
> Here are the detailed analyses of the key files:
> [all file analyses from Step 4]
>
> Based on all of this, generate a comprehensive onboarding guide. Respond as JSON with this exact structure:
>
> {
>   "overview": {
>     "summary": "2-3 paragraph overview of the project for a new developer",
>     "purpose": "One sentence describing what this project does"
>   },
>   "architecture": {
>     "description": "2-3 paragraph description of the overall architecture",
>     "components": [
>       {
>         "id": "unique-slug",
>         "label": "Human-readable name",
>         "description": "What this component does (2-3 sentences)",
>         "files": ["key/files/in/this/component.ts"],
>         "type": "core | service | utility | external | data"
>       }
>     ],
>     "relationships": [
>       {
>         "from": "component-id",
>         "to": "component-id",
>         "label": "brief description of how they interact"
>       }
>     ]
>   },
>   "contributorGuide": {
>     "setup": "Step-by-step dev environment setup",
>     "addingFeatures": "How to add a new feature — typical flow and files to touch",
>     "fixingBugs": "How to find and fix bugs — where to look, debugging tips",
>     "testing": "Testing strategy, how to run tests, how to add new tests",
>     "gotchas": ["Non-obvious thing 1", "Non-obvious thing 2"],
>     "keyCommands": [
>       { "command": "npm run dev", "description": "Start development server" }
>     ]
>   }
> }
>
> Be specific and reference actual files, directories, and patterns from this codebase. Do not be generic.

**LLM Call 2 — File Tree Annotations (if not done during scanning):**

Generate one-liner annotations for each major directory and important file in the tree. This could also be folded into Call 1 if the context window allows.

---

### Diagram Generator (pipeline/diagramGenerator.ts)

Converts the `ArchitectureData` from the synthesizer into React Flow-compatible nodes and edges. **No LLM calls** — this is purely structural transformation.

```typescript
export function generateDiagramData(architecture: ArchitectureData) {
  const nodes = architecture.components.map((comp, index) => ({
    id: comp.id,
    type: "custom",                    // Custom node with expandable details
    data: {
      label: comp.label,
      description: comp.description,
      files: comp.files,
      componentType: comp.type
    },
    position: calculatePosition(index, architecture.components.length)
  }));

  const edges = architecture.relationships.map((rel, index) => ({
    id: `edge-${index}`,
    source: rel.from,
    target: rel.to,
    label: rel.label,
    animated: true
  }));

  return { nodes, edges };
}
```

The `calculatePosition` function should arrange nodes in a sensible layout. Options:
- **Layered layout**: Group by component type (external → core → data, left to right)
- **Force-directed**: Let React Flow's built-in layout handle it
- **Dagre layout**: Use the `dagre` library for automatic directed graph layout (recommended — produces clean, readable diagrams)

Use the `dagre` library with React Flow for automatic layout:
```
npm install dagre @types/dagre
```

---

## Frontend Components — Detailed

### Home.tsx (Landing Page)

Simple, clean landing page:
- App title and one-line description
- Large input field for GitHub URL
- "Analyze" button
- Below: list of previously analyzed repos (from database) as clickable cards
- Validates URL format before submission

### ProgressTracker.tsx

Shown while the pipeline is running:
- Visual progress bar (0-100%)
- Current step label (e.g., "Analyzing src/routes/auth.ts (7 of 24 files)")
- Animated pipeline visualization showing which stage is active:
  `Clone → Scan → Rank → Analyze → Synthesize`
- Polls `GET /api/status/:jobId` every 1.5 seconds

### Analysis.tsx (Dashboard Page)

Main dashboard, shown when analysis is complete. Uses a tab or panel layout:
- **Overview tab**: `<Overview />` component
- **Architecture tab**: `<ArchitectureDiagram />` component
- **Files tab**: `<FileExplorer />` component
- **Contribute tab**: `<ContributorGuide />` component
- **Chat**: `<ChatPanel />` as a persistent sidebar or slide-out panel

### Overview.tsx

Displays the project summary:
- Project name and one-line purpose
- Tech stack as labeled badges/chips
- Language breakdown as a simple bar chart or horizontal segments
- Repo stats (files, lines, analyzed files)
- Full summary paragraphs

### ArchitectureDiagram.tsx

Interactive diagram using React Flow:
- Renders components as styled nodes (color-coded by type)
- Renders relationships as labeled edges
- Clicking a node opens a detail panel showing:
  - Component description
  - List of key files (clickable → jumps to file explorer)
  - Patterns used
- Supports zoom and pan
- Uses dagre for automatic layout

### FileExplorer.tsx

An annotated file tree:
- Collapsible tree structure
- Each directory and important file has an AI-generated annotation shown next to it
- Color or icon indicates importance (high / medium / low)
- Clicking a file shows its full analysis in a side panel:
  - Summary
  - Patterns used
  - Dependencies
  - Key exports

### ContributorGuide.tsx

Rendered markdown-style sections:
- Setup instructions (with copy-able code blocks)
- "Adding a Feature" walkthrough
- "Fixing a Bug" walkthrough
- Testing guide
- Gotchas as a highlighted callout list
- Key commands as a table

### ChatPanel.tsx

Persistent chat interface:
- Text input at the bottom
- Scrollable message history
- Streams responses in real-time (SSE)
- Pre-populated with suggested questions:
  - "How does the authentication work?"
  - "Where would I add a new API endpoint?"
  - "What are the most important files to understand?"
- Maintains conversation history and sends it with each request

---

## Chat Implementation

### Backend (routes/chat.ts)

```typescript
router.post("/api/chat", async (req, res) => {
  const { jobId, message, history } = req.body;

  // Fetch the stored analysis
  const job = await prisma.analysisJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "done") {
    return res.status(400).json({ error: "Analysis not complete" });
  }

  const analysis: RepoAnalysis = JSON.parse(job.result!);

  // Build context from the analysis
  const systemPrompt = buildChatSystemPrompt(analysis);

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Stream Claude's response
  const stream = await claude.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      ...history,
      { role: "user", content: message }
    ]
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ type: "text_delta", text: event.delta.text })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
});
```

### Chat System Prompt (prompts/chat.ts)

```typescript
export function buildChatSystemPrompt(analysis: RepoAnalysis): string {
  return `You are an expert developer who deeply understands the ${analysis.overview.name} codebase. You are helping a new developer get up to speed.

Here is the complete analysis of this codebase:

## Project Overview
${analysis.overview.summary}

## Architecture
${analysis.architecture.description}

### Components
${analysis.architecture.components.map(c =>
  `- **${c.label}** (${c.files.join(", ")}): ${c.description}`
).join("\n")}

### How Components Connect
${analysis.architecture.relationships.map(r =>
  `- ${r.from} → ${r.to}: ${r.label}`
).join("\n")}

## Key File Analyses
${analysis.fileAnalyses.map(f =>
  `### ${f.path}\n${f.summary}\nPatterns: ${f.patterns.join(", ")}\nKey exports: ${f.keyExports.join(", ")}`
).join("\n\n")}

## Contributor Guide
Setup: ${analysis.contributorGuide.setup}
Adding features: ${analysis.contributorGuide.addingFeatures}
Fixing bugs: ${analysis.contributorGuide.fixingBugs}
Testing: ${analysis.contributorGuide.testing}
Gotchas: ${analysis.contributorGuide.gotchas.join("; ")}

---

Answer the developer's questions about this codebase. Be specific — reference actual file names, functions, and patterns. If they ask about something not covered in the analysis, say so honestly and suggest where they might look. Keep answers focused and practical.`;
}
```

---

## Constraints and Guardrails

### Repo Size Limits (v1)
- Maximum 100MB after clone
- Maximum 500 source files (after filtering out noise)
- If exceeded, show a friendly message suggesting the user analyze a subdirectory
- Add a URL parameter option: `?path=src/` to scope analysis to a subdir

### API Cost Management
- Use `claude-sonnet-4-20250514` for file analysis (good balance of quality and cost)
- Use `claude-sonnet-4-20250514` for synthesis and chat (better reasoning)
- Estimated cost per analysis: $0.10-0.50 depending on repo size
- For the hackathon, this is fine — but note it for future optimization

### Error Handling
- If any pipeline step fails, mark the job as "error" with a useful message
- If a single file analysis fails, skip that file and continue (don't fail the whole job)
- Clone timeout: 60 seconds
- Per-file analysis timeout: 30 seconds
- Total pipeline timeout: 5 minutes

### Rate Limiting (v1 — lightweight)
- Max 3 concurrent analysis jobs
- Max 10 analyses per hour per IP
- Queue additional requests

---

## Build Order (Day-by-Day Plan)

### Day 1 (March 1) — Foundation + Pipeline Core
- [ ] Initialize monorepo with npm workspaces
- [ ] Set up backend: Express + TypeScript + Prisma + SQLite
- [ ] Implement `cloner.ts` and `scanner.ts`
- [ ] Write tests for cloner and scanner using a small test repo
- **Milestone:** Can clone a repo and output its structure as JSON

### Day 2 (March 2) — Pipeline Completion
- [ ] Implement `fileRanker.ts` with heuristics + LLM call
- [ ] Implement `analyzer.ts` with batched parallel analysis
- [ ] Implement `synthesizer.ts` + `diagramGenerator.ts`
- [ ] Wire up the full pipeline orchestrator
- [ ] Set up Claude API service with error handling
- **Milestone:** Can run full pipeline from CLI and get complete `RepoAnalysis` JSON

### Day 3 (March 3) — API + Frontend Foundation
- [ ] Implement all API routes (analyze, status, results, chat)
- [ ] Set up frontend: Vite + React + TypeScript + Tailwind
- [ ] Build `Home.tsx` with `RepoInput.tsx`
- [ ] Build `ProgressTracker.tsx` with status polling
- **Milestone:** Can submit a URL in the browser and watch the analysis progress

### Day 4 (March 4) — Dashboard: Overview + File Explorer
- [ ] Build `Analysis.tsx` dashboard layout with tabs/panels
- [ ] Build `Overview.tsx` with tech stack badges and stats
- [ ] Build `FileExplorer.tsx` with annotated tree
- **Milestone:** Can view overview and browse annotated file tree

### Day 5 (March 5) — Architecture Diagram
- [ ] Install and set up React Flow + dagre
- [ ] Build `ArchitectureDiagram.tsx` with custom node components
- [ ] Implement click-to-expand detail panels on nodes
- [ ] Style and polish the diagram
- **Milestone:** Interactive architecture diagram working — the "wow" moment

### Day 6 (March 6) — Chat + Contributor Guide
- [ ] Implement SSE streaming on the backend for chat
- [ ] Build `ChatPanel.tsx` with streaming responses
- [ ] Build `ContributorGuide.tsx` with rendered sections
- [ ] Add suggested questions to chat
- **Milestone:** Full feature set complete

### Day 7 (March 7) — Polish + Demo Prep
- [ ] Error handling and edge cases
- [ ] Loading states and empty states
- [ ] UI polish — consistent styling, responsive layout
- [ ] Test with 3-5 different repos (small, medium, different languages)
- [ ] Prepare demo: pick a well-known repo to analyze live
- [ ] Write README with screenshots
- **Milestone:** Demo-ready

---

## Demo Strategy

For the hackathon demo, prepare two things:

1. **Pre-analyzed repo**: Have a popular, well-known repo already analyzed so you can show the full dashboard instantly without waiting for processing. Good candidates:
   - `expressjs/express` (everyone knows it, medium size)
   - `sindresorhus/got` (clean architecture, manageable size)
   - `fastify/fastify` (well-structured, interesting patterns)

2. **Live analysis**: Take a suggestion from the audience ("give me a GitHub URL!") and analyze it in real-time. The progress tracker makes the wait engaging, and the reveal of the architecture diagram is the wow moment.

Demo talking points:
- "New to a codebase? Paste the URL, get the mental model in 60 seconds."
- Show the architecture diagram — click through components
- Show the chat: "Where would I add a new route?" and get a specific, grounded answer
- Show the contributor guide: "Ready to contribute? Here's exactly how."

---

## Context7 Library References

When using Claude Code, **always reference Context7 documentation** before writing code for any of these libraries. This ensures you're using current APIs, correct patterns, and up-to-date best practices.

### How to Use

Before implementing any feature that involves one of these libraries, query Context7 with the library ID and a description of what you're trying to do. For example:

```
Use context7 to look up: /xyflow/xyflow — "how to create custom nodes with click handlers in React Flow"
```

### Library Reference Table

| Library             | Context7 ID                                  | Use In Project                              |
| ------------------- | -------------------------------------------- | ------------------------------------------- |
| React               | `/websites/react_dev`                        | All frontend components, hooks, state       |
| Express             | `/expressjs/express`                         | Backend API routes, middleware, SSE          |
| Prisma              | `/prisma/docs`                               | Database schema, queries, migrations        |
| React Flow          | `/xyflow/xyflow`                             | Architecture diagram rendering              |
| Anthropic TS SDK    | `/anthropics/anthropic-sdk-typescript`        | Claude API calls, streaming responses       |
| Vite                | `/vitejs/vite`                               | Frontend build tooling, dev server config   |
| Tailwind CSS v3     | `/websites/v3_tailwindcss`                   | All frontend styling                        |
| Dagre               | `/dagrejs/dagre`                             | Auto-layout for architecture diagram nodes  |

### When to Query Context7

Always query Context7 before:
- **Setting up a new library** (e.g., initializing Prisma, configuring Vite, setting up React Flow)
- **Using an API you're unsure about** (e.g., Claude SDK streaming, React Flow custom nodes, Prisma relations)
- **Handling an error** related to a library — check if the API has changed
- **Writing integration code** between libraries (e.g., SSE streaming from Express to React)

### Specific Lookups to Do Early

These are the most critical Context7 lookups to do at the start of each implementation day:

**Day 1-2 (Backend pipeline):**
- `/anthropics/anthropic-sdk-typescript` — "how to make a streaming message request and parse JSON responses"
- `/prisma/docs` — "how to set up Prisma with SQLite and define a schema"
- `/expressjs/express` — "how to set up Express with TypeScript and define API routes"

**Day 3 (API + Frontend foundation):**
- `/expressjs/express` — "how to implement Server-Sent Events (SSE) streaming endpoint"
- `/vitejs/vite` — "how to set up a React TypeScript project with Vite and proxy API requests"
- `/websites/v3_tailwindcss` — "how to install and configure Tailwind CSS with Vite"

**Day 4 (Dashboard components):**
- `/websites/react_dev` — "how to build a collapsible tree component with state"
- `/websites/v3_tailwindcss` — "responsive layout with grid and flexbox utilities"

**Day 5 (Architecture diagram):**
- `/xyflow/xyflow` — "how to create custom node types with expandable content in React Flow"
- `/xyflow/xyflow` — "how to use dagre layout with React Flow for automatic node positioning"
- `/dagrejs/dagre` — "how to configure dagre layout options for a directed graph"

**Day 6 (Chat + streaming):**
- `/anthropics/anthropic-sdk-typescript` — "how to stream a message response and forward events"
- `/websites/react_dev` — "how to consume an SSE stream in a React component with useEffect"

---

## Deployment & CI/CD

### Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│   Vercel             │         │   Railway            │
│   (Frontend)         │ ──API──▶│   (Backend)          │
│                      │         │                      │
│   React + Vite       │         │   Express + Prisma   │
│   Static assets      │         │   SQLite (persistent) │
│   Auto-deploy from   │         │   Git clone workspace │
│   GitHub main branch │         │   Long-running jobs   │
└─────────────────────┘         └─────────────────────┘
```

**Why this split:**
- Vercel excels at static/SPA hosting with instant global CDN
- Railway provides a persistent Node.js server with disk access, required for:
  - SQLite database (needs persistent filesystem)
  - Git clone operations (needs shell + disk)
  - Long-running pipeline jobs (1-5 minutes, exceeds Vercel function limits)

---

### Frontend Deployment (Vercel)

**Setup:**
1. Connect the GitHub repo to Vercel
2. Set the root directory to `packages/frontend`
3. Vercel auto-detects Vite — no special build config needed

**Vercel project settings:**
```
Framework Preset: Vite
Root Directory: packages/frontend
Build Command: npm run build
Output Directory: dist
```

**Environment variables (Vercel dashboard):**
```
VITE_API_URL=https://<your-railway-app>.railway.app
```

**vite.config.ts — proxy for local dev, env var for production:**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

**Frontend API calls should use a base URL helper:**
```typescript
// packages/frontend/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// Usage:
// fetch(apiUrl("/api/analyze"), { method: "POST", ... })
// fetch(apiUrl(`/api/status/${jobId}`))
```

---

### Backend Deployment (Railway)

**Setup:**
1. Connect the GitHub repo to Railway
2. Configure the service to use `packages/backend` as the root directory
3. Railway auto-detects Node.js and runs `npm start`

**Railway service settings:**
```
Root Directory: packages/backend
Build Command: npm run build
Start Command: npm start
```

**package.json scripts (packages/backend):**
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "npx prisma generate && tsc",
    "start": "node dist/server.js",
    "db:push": "npx prisma db push",
    "db:studio": "npx prisma studio",
    "postinstall": "npx prisma generate && npx prisma db push"
  }
}
```

**Note:** The `postinstall` script ensures Prisma client is generated and the database schema is applied on every deploy. This is critical for Railway where each deploy creates a fresh build.

**Environment variables (Railway dashboard):**
```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=file:./dev.db
PORT=3000
FRONTEND_URL=https://<your-vercel-app>.vercel.app
NODE_ENV=production
```

**CORS configuration (packages/backend/src/app.ts):**
```typescript
import cors from "cors";

const allowedOrigins = [
  "http://localhost:5173",                    // Vite dev server
  process.env.FRONTEND_URL,                   // Production Vercel URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
```

**Railway persistent storage:**
Railway provides a persistent volume for SQLite. Attach a volume in the Railway dashboard:
- Mount path: `/data`
- Update DATABASE_URL to: `file:/data/codebase-sherpa.db`

This ensures the database survives redeployments.

---

### CI/CD Pipeline

Both Vercel and Railway auto-deploy from GitHub pushes to `main`. No separate CI/CD config is needed for basic deployment. However, add a GitHub Actions workflow for linting and type checking on PRs:

**.github/workflows/ci.yml:**
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - run: npm ci

      - name: Lint backend
        working-directory: packages/backend
        run: npx tsc --noEmit

      - name: Lint frontend
        working-directory: packages/frontend
        run: npx tsc --noEmit

      - name: Build frontend
        working-directory: packages/frontend
        run: npm run build
```

---

### Deployment Checklist (Day 7)

- [ ] Create Railway project, connect GitHub repo, set root to `packages/backend`
- [ ] Add Railway environment variables (ANTHROPIC_API_KEY, FRONTEND_URL, DATABASE_URL)
- [ ] Attach Railway persistent volume at `/data`
- [ ] Run initial deploy on Railway, verify API responds at `https://<app>.railway.app/api/status`
- [ ] Create Vercel project, connect GitHub repo, set root to `packages/frontend`
- [ ] Add Vercel environment variable (VITE_API_URL pointing to Railway URL)
- [ ] Deploy frontend, verify it connects to backend
- [ ] Test full flow: paste a repo URL → watch progress → view results → chat
- [ ] Update CORS to include the final Vercel production URL

---

## Future Enhancements (Out of Scope for Hackathon)

These are good to mention during the demo as "what's next":
- GitHub Action integration (auto-generate on push, keep docs up to date)
- Data flow visualization (trace a request through the system)
- VS Code extension (browse the onboarding guide alongside the code)
- Support for private repos (GitHub token auth)
- Monorepo support (analyze individual packages)
- Staleness detection (flag when code changes make the guide outdated)
- Export as markdown (for adding to the repo as ONBOARDING.md)
- Team features: let multiple people annotate and add notes
