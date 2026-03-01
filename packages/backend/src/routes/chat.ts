import { Router, type Request, type Response } from "express";
import { getJob } from "../services/jobManager.js";
import { getStreamingClient, MODEL } from "../services/claude.js";
import { buildChatSystemPrompt } from "../prompts/chat.js";
import type { RepoAnalysis } from "../types/analysis.js";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const router = Router();

router.post("/api/chat", async (req: Request, res: Response) => {
  const { jobId, message, history = [] } = req.body as {
    jobId?: string;
    message?: string;
    history?: ChatMessage[];
  };

  if (!jobId || !message) {
    res.status(400).json({ error: "jobId and message are required" });
    return;
  }

  const job = await getJob(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "done" || !job.result) {
    res.status(400).json({ error: "Analysis is not complete yet" });
    return;
  }

  const analysis = JSON.parse(job.result) as RepoAnalysis;
  const systemPrompt = buildChatSystemPrompt(analysis);

  // Set up Server-Sent Events
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const client = getStreamingClient();
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        sendEvent({ type: "text_delta", text: event.delta.text });
      }
    }

    sendEvent({ type: "done" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stream error";
    sendEvent({ type: "error", message });
  } finally {
    res.end();
  }
});

export default router;
