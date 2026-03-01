import prisma from "../db.js";

export type JobStatus =
  | "queued"
  | "cloning"
  | "scanning"
  | "ranking"
  | "analyzing"
  | "synthesizing"
  | "done"
  | "error";

export async function createJob(repoUrl: string, repoName: string): Promise<string> {
  const job = await prisma.analysisJob.create({
    data: { repoUrl, repoName, status: "queued", progress: 0 },
  });
  return job.id;
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  progress: number,
  currentStep?: string
): Promise<void> {
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status, progress, currentStep: currentStep ?? null },
  });
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "error", errorMessage },
  });
}

export async function completeJob(jobId: string, result: string): Promise<void> {
  await prisma.analysisJob.update({
    where: { id: jobId },
    data: { status: "done", progress: 1.0, currentStep: "Complete", result },
  });
}

export async function getJob(jobId: string) {
  return prisma.analysisJob.findUnique({ where: { id: jobId } });
}

export async function findExistingJob(repoUrl: string) {
  return prisma.analysisJob.findFirst({
    where: { repoUrl, status: "done" },
    orderBy: { createdAt: "desc" },
  });
}
