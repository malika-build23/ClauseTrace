import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";

/**
 * Read-only audit log (Block I). There are deliberately no write, update or
 * delete endpoints, and the table itself rejects UPDATE/DELETE.
 * Filters: ?objectType= ?objectId= ?eventType= (prefix, e.g. "obligation.")
 *          ?actor=<email or "system"> ?from=YYYY-MM-DD ?to=YYYY-MM-DD ?before=<ISO time> ?limit=
 */
export const auditRouter = Router();

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

auditRouter.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const actor = str(req.query.actor);
  const from = day(req.query.from);
  const to = day(req.query.to);
  const before = str(req.query.before);

  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00Z`);
  if (to) createdAt.lt = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000);
  if (before && !Number.isNaN(Date.parse(before))) createdAt.lt = new Date(before);

  const where: Prisma.AuditLogWhereInput = {
    ...(str(req.query.objectType) ? { objectType: str(req.query.objectType) } : {}),
    ...(str(req.query.objectId) ? { objectId: str(req.query.objectId) } : {}),
    ...(str(req.query.eventType) ? { eventType: { startsWith: str(req.query.eventType) } } : {}),
    ...(actor === "system" ? { actorId: null } : actor ? { actor: { email: actor.toLowerCase() } } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { actor: { select: { name: true, email: true } } },
  });
  const page = rows.slice(0, limit);
  res.json({ entries: page, nextBefore: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null });
});

// Distinct values for the filter dropdowns.
auditRouter.get("/facets", async (_req, res) => {
  const [events, objects, actors] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["eventType"], select: { eventType: true }, orderBy: { eventType: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["objectType"], select: { objectType: true }, orderBy: { objectType: "asc" } }),
    prisma.user.findMany({ select: { email: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  res.json({ eventTypes: events.map((e) => e.eventType), objectTypes: objects.map((o) => o.objectType), actors });
});
