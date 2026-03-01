import { Router, type Request, type Response } from "express";
import { getJob } from "../services/jobManager.js";

const router = Router();

router.get("/api/status/:jobId", async (req: Request, res: Response) => {
  const jobId = req.params["jobId"] as string;

  const job = await getJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep ?? null,
    errorMessage: job.status === "error" ? (job.errorMessage ?? null) : undefined,
  });
});

export default router;
