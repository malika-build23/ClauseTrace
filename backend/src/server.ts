import express from "express";
import { prisma } from "./db.js";

const app = express();
app.use(express.json());

// Health check: proves the API can reach Neon Postgres.
app.get("/api/health", async (_req, res) => {
  try {
    const [row] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
    res.json({ status: "ok", db: "connected", dbTime: row.now });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable", message: (err as Error).message });
  }
});

app.get("/api/organisations", async (_req, res) => {
  const orgs = await prisma.organisation.findMany({
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(orgs);
});

app.post("/api/organisations", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const org = await prisma.organisation.create({ data: { name } });
  res.status(201).json(org);
});

app.delete("/api/organisations/:id", async (req, res) => {
  await prisma.organisation.delete({ where: { id: req.params.id } });
  res.status(204).end();
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
