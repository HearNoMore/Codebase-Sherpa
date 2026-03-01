import { Router, type Request, type Response } from "express";
import { parseGitHubUrl } from "../pipeline/cloner.js";
import { runPipeline } from "../pipeline/index.js";
import {
  createJob,
  findExistingJob,
  updateJobStatus,
  failJob,
} from "../services/jobManager.js";
import {
  isConcurrencyLimitReached,
  isIpRateLimited,
  recordIpRequest,
  incrementActiveJobs,
  decrementActiveJobs,
} from "../services/rateLimiter.js";

const router = Router();

router.post("/api/analyze", async (req: Request, res: Response) => {
  const { repoUrl } = req.body as { repoUrl?: string };

  if (!repoUrl || typeof repoUrl !== "string") {
    res.status(400).json({ error: "repoUrl is required" });
    return;
  }

  const parsed = parseGitHubUrl(repoUrl.trim());
  if (!parsed) {
    res.status(400).json({ error: "Invalid GitHub repository URL" });
    return;
  }

  // Normalise the URL to https://github.com/owner/repo
  const normalisedUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;

  // IP rate limiting
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  if (isIpRateLimited(ip)) {
    res.status(429).json({ error: "Too many requests. Please wait before submitting another repository." });
    return;
  }

  // Return existing completed analysis rather than re-running
  const existing = await findExistingJob(normalisedUrl);
  if (existing) {
    res.status(200).json({ jobId: existing.id, cached: true });
    return;
  }

  // Concurrency guard
  if (isConcurrencyLimitReached()) {
    res.status(503).json({ error: "Server is busy. Please try again in a moment." });
    return;
  }

  recordIpRequest(ip);

  const repoName = `${parsed.owner}/${parsed.repo}`;
  const jobId = await createJob(normalisedUrl, repoName);

  // Fire-and-forget: pipeline runs async, we return the jobId immediately
  incrementActiveJobs();
  runPipeline(jobId, normalisedUrl)
    .catch(async (err: unknown) => {
      console.error(`[analyze] unhandled pipeline error for job ${jobId}:`, err);
      await failJob(jobId, String(err)).catch(() => {});
    })
    .finally(() => decrementActiveJobs());

  res.status(202).json({ jobId });
});

export default router;
