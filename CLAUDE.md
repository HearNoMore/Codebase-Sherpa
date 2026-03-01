# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Codebase Sherpa** is a hackathon web app that accepts a GitHub repo URL and generates an interactive onboarding guide for new developers. It clones the repo, runs a multi-step LLM analysis pipeline, and presents results as an interactive dashboard with an AI chat interface.

The full specification is in `int-docs/CODEBASE-SHERPA.md` — read it before starting any implementation work.

## Tech Stack

- **Monorepo**: npm workspaces (`packages/frontend`, `packages/backend`)
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + React Flow + dagre
- **Backend**: Node.js + Express + TypeScript + Prisma + SQLite
- **LLM**: Claude API via `@anthropic-ai/sdk` — model `claude-sonnet-4-6`

## Common Commands

All commands run from the monorepo root unless noted.

```bash
# Install all dependencies
npm install

# Run both frontend and backend in dev mode
npm run dev

# Backend only (packages/backend)
cd packages/backend && npm run dev     # tsx watch src/server.ts

# Frontend only (packages/frontend)
cd packages/frontend && npm run dev    # Vite dev server on :5173

# TypeScript type-check (no emit) — run in each package
cd packages/backend && npx tsc --noEmit
cd packages/frontend && npx tsc --noEmit

# Build
cd packages/backend && npm run build   # prisma generate + tsc
cd packages/frontend && npm run build  # vite build

# Database
cd packages/backend && npm run db:push       # apply schema changes
cd packages/backend && npm run db:studio     # Prisma Studio UI
cd packages/backend && npm run prisma:setup  # generate client + push (first-time setup)

# Run the full pipeline from CLI (requires ANTHROPIC_API_KEY in .env)
npm run pipeline:run -w packages/backend -- https://github.com/owner/repo
```

## Architecture

### Backend Pipeline (the core of the app)

The backend runs a 5-step analysis pipeline in `packages/backend/src/pipeline/`:

1. **cloner.ts** — `git clone --depth 1`, validates size ≤100MB, deletes `.git`
2. **scanner.ts** — Walks the directory tree (no LLM), parses manifests, skips noise (`node_modules/`, `dist/`, lock files, binaries), returns `RepoStructure`
3. **fileRanker.ts** — Heuristic pre-scoring + 1 LLM call → top 30–50 important files
4. **analyzer.ts** — Batches of 3–5 files per LLM call, 3 concurrent requests, produces `FileAnalysis[]`
5. **synthesizer.ts** — 1–2 LLM calls → final `RepoAnalysis` object (overview + architecture + contributor guide + annotated file tree)

`pipeline/index.ts` orchestrates all steps, updating the `AnalysisJob` DB record at each stage. `pipeline/diagramGenerator.ts` converts `ArchitectureData` → React Flow nodes/edges using dagre (no LLM).

### Job Lifecycle

Status flow: `queued → cloning → scanning → ranking → analyzing → synthesizing → done | error`

Progress range per step: clone (0–0.10), scan (0.10–0.20), rank (0.20–0.30), analyze (0.30–0.80), synthesize (0.80–0.95), done (1.0).

Jobs are stored as rows in the `AnalysisJob` SQLite table. The `result` column holds the full `RepoAnalysis` as a JSON string.

### API Routes

- `POST /api/analyze` → creates a job, starts pipeline async, returns `{ jobId }`
- `GET /api/status/:jobId` → returns status, progress, currentStep
- `GET /api/results/:jobId` → returns full `RepoAnalysis` (only when status is "done")
- `POST /api/chat` → SSE stream; reads stored analysis from DB, builds system prompt, streams Claude response

### Frontend Pages & Hooks

- `Home.tsx` — URL input, previously analyzed repos list
- `Analysis.tsx` — Tab dashboard: Overview / Architecture / Files / Contribute + persistent ChatPanel
- `useAnalysisStatus.ts` — polls `GET /api/status/:jobId` every 1.5 seconds
- `useChat.ts` — consumes the SSE stream from `POST /api/chat`

### API Base URL Pattern

Frontend uses `VITE_API_URL` env var for production; Vite dev proxy handles local:

```typescript
// packages/frontend/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || "";
export const apiUrl = (path: string) => `${API_BASE}${path}`;
```

## Key Constraints

- Repos must be public (no auth token support in v1)
- Max 100MB after clone, max 500 source files after filtering
- Max 3 concurrent pipeline jobs; 10 analyses/hour per IP
- Pipeline timeout: 5 minutes total; per-file analysis: 30s; clone: 60s
- If a single file analysis fails, skip it and continue — don't fail the whole job

## Context7 Library References

Always query Context7 docs before implementing against these libraries:

| Library | Context7 ID |
|---|---|
| React | `/websites/react_dev` |
| Express | `/expressjs/express` |
| Prisma | `/prisma/docs` |
| React Flow | `/xyflow/xyflow` |
| Anthropic TS SDK | `/anthropics/anthropic-sdk-typescript` |
| Vite | `/vitejs/vite` |
| Tailwind CSS v3 | `/websites/v3_tailwindcss` |
| Dagre | `/dagrejs/dagre` |

## Deployment

- **Frontend** → Vercel (root: `packages/frontend`, env: `VITE_API_URL`)
- **Backend** → Railway (root: `packages/backend`, env: `ANTHROPIC_API_KEY`, `DATABASE_URL=file:/data/codebase-sherpa.db`, `FRONTEND_URL`, `PORT=3000`)
- Railway needs a persistent volume mounted at `/data` for SQLite to survive redeployments
- On Railway, add a `postinstall` script or a start hook: `npx prisma generate && npx prisma db push` (don't add this locally — it requires DATABASE_URL in env)
