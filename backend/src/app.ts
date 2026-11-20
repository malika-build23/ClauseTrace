import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { prisma } from "./db.js";
import { documentsRouter } from "./routes/documents.js";
import { obligationsRouter } from "./routes/obligations.js";

export const app = express();

// Render sits behind one proxy; needed for correct client IPs in rate limiting.
app.set("trust proxy", 1);

// CORS_ORIGIN: comma-separated list of allowed origins (Vercel prod + preview).
// Unset in local dev, where Vite proxies /api and no CORS is needed.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }));
}
app.use(express.json({ limit: "1mb" }));

// Health check: proves the API can reach Neon Postgres.
app.get("/api/health", async (_req, res) => {
  try {
    const [row] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    res.json({ status: "ok", db: "connected", dbTime: row.now });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable", message: (err as Error).message });
  }
});

// Checks the backend can reach the AI service with its shared token.
app.get("/api/health/ai", async (_req, res) => {
  const base = process.env.AI_SERVICE_URL;
  const token = process.env.AI_SERVICE_TOKEN;
  if (!base || !token) {
    res.status(503).json({ status: "error", ai: "not configured" });
    return;
  }
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/health/secure`, {
      headers: { "X-Service-Token": token },
      signal: AbortSignal.timeout(60_000), // free service may be waking up
    });
    res.status(r.ok ? 200 : 502).json({ status: r.ok ? "ok" : "error", ai: r.ok ? "connected" : `HTTP ${r.status}` });
  } catch (err) {
    res.status(502).json({ status: "error", ai: "unreachable", message: (err as Error).message });
  }
});

app.use("/api/documents", documentsRouter);
app.use("/api/obligations", obligationsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express 5 forwards rejected async handlers here.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.code === "LIMIT_FILE_SIZE" ? "PDF larger than 10 MB" : err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
