import { Router, type Request, type Response } from "express";
import { getJob } from "../services/jobManager.js";
import type { RepoAnalysis } from "../types/analysis.js";

const router = Router();

router.get("/api/results/:jobId", async (req: Request, res: Response) => {
  const jobId = req.params["jobId"] as string;

  const job = await getJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "done") {
    res.status(400).json({
      error: "Analysis is not complete yet",
      status: job.status,
    });
    return;
  }

  if (!job.result) {
    res.status(500).json({ error: "Result data is missing" });
    return;
  }

  const analysis = JSON.parse(job.result) as RepoAnalysis;

  res.json({
    jobId: job.id,
    repoUrl: job.repoUrl,
    repoName: job.repoName,
    analysis,
    createdAt: job.createdAt,
  });
});

export default router;
