import cors from "cors";
import express from "express";
import { prisma } from "./db.js";

const app = express();

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
      signal: AbortSignal.timeout(60_000), // free Space may be waking up
    });
    res.status(r.ok ? 200 : 502).json({ status: r.ok ? "ok" : "error", ai: r.ok ? "connected" : `HTTP ${r.status}` });
  } catch (err) {
    res.status(502).json({ status: "error", ai: "unreachable", message: (err as Error).message });
  }
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`ClauseTrace backend listening on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
