import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { prisma } from "./db.js";
import { wakeInBackground } from "./lib/ai-client.js";
import { requireAuth, requireRole } from "./lib/auth.js";
import { authRouter } from "./routes/auth.js";
import { documentsRouter } from "./routes/documents.js";
import { obligationsRouter } from "./routes/obligations.js";
import { auditRouter } from "./routes/audit.js";
import { changesRouter } from "./routes/changes.js";
import { conflictsRouter } from "./routes/conflicts.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { evaluationsRouter } from "./routes/evaluations.js";
import { insightsRouter } from "./routes/insights.js";
import { profilesRouter } from "./routes/profiles.js";
import { rulesRouter } from "./routes/rules.js";
import { usersRouter } from "./routes/users.js";

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
  wakeInBackground(); // the site is being used: get the sleeping AI service booting now
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

// Public: health checks above and sign-in. Everything below needs a valid token.
app.use("/api/auth", authRouter);
app.use("/api/documents", requireAuth, documentsRouter);
app.use("/api/obligations", requireAuth, obligationsRouter);
app.use("/api/users", requireAuth, requireRole("admin"), usersRouter);
app.use("/api/rules", requireAuth, rulesRouter);
app.use("/api/evaluations", requireAuth, evaluationsRouter);
app.use("/api/entity-profiles", requireAuth, profilesRouter);
app.use("/api/profiles", requireAuth, profilesRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/conflicts", requireAuth, conflictsRouter);
app.use("/api/audit", requireAuth, requireRole("reviewer"), auditRouter); // contains emails of failed sign-ins
app.use("/api", requireAuth, insightsRouter); // /api/risk-config, /api/graph/...
app.use("/api", requireAuth, changesRouter); // GET /api/changes, PATCH /api/changes/:id, PATCH /api/impact-items/:id

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

