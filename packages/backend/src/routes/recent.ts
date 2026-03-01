import { Router, type Request, type Response } from "express";
import prisma from "../db.js";

const router = Router();

// Returns the 10 most recently completed analyses for the Home page list
router.get("/api/recent", async (_req: Request, res: Response) => {
  const jobs = await prisma.analysisJob.findMany({
    where: { status: "done" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      repoUrl: true,
      repoName: true,
      createdAt: true,
    },
  });
  res.json({ jobs });
});

export default router;
