import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze.js";
import statusRouter from "./routes/status.js";
import resultsRouter from "./routes/results.js";
import chatRouter from "./routes/chat.js";
import recentRouter from "./routes/recent.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(analyzeRouter);
app.use(statusRouter);
app.use(resultsRouter);
app.use(chatRouter);
app.use(recentRouter);

export default app;
