import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser, requireRole } from "../lib/auth.js";

// PATCH /api/changes/:id and /api/impact-items/:id (reviewer decisions on detected changes)
export const changesRouter = Router();

const ChangeStatus = z.object({ status: z.enum(["pending", "confirmed", "dismissed"]), comment: z.string().trim().max(1000).optional() });
const ImpactStatus = z.object({
  reviewStatus: z.enum(["pending", "confirmed", "draft_created", "dismissed"]),
  comment: z.string().trim().max(1000).optional(),
});

changesRouter.get("/changes", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const events = await prisma.changeEvent.findMany({
    where: status ? { status: status as "pending" | "confirmed" | "dismissed" } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      newVersion: { select: { versionNo: true, document: { select: { id: true, title: true } } } },
      oldVersion: { select: { versionNo: true } },
      _count: { select: { impactItems: true } },
    },
  });
  res.json(events);
});

changesRouter.patch("/changes/:id", requireRole("reviewer"), async (req, res) => {
  const body = ChangeStatus.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid status" });
    return;
  }
  const before = await prisma.changeEvent.findUnique({ where: { id: String(req.params.id) } });
  if (!before) {
    res.status(404).json({ error: "Change not found" });
    return;
  }
  const event = await prisma.changeEvent.update({ where: { id: before.id }, data: { status: body.data.status } });
  await writeAudit(prisma, {
    actorId: currentUser(req).id,
    eventType: "change.reviewed",
    objectType: "change_event",
    objectId: event.id,
    payload: { before: before.status, after: event.status, comment: body.data.comment ?? null, summary: event.summary },
  });
  res.json(event);
});

changesRouter.patch("/impact-items/:id", requireRole("reviewer"), async (req, res) => {
  const body = ImpactStatus.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid status" });
    return;
  }
  const before = await prisma.impactItem.findUnique({ where: { id: String(req.params.id) } });
  if (!before) {
    res.status(404).json({ error: "Impact item not found" });
    return;
  }
  const item = await prisma.impactItem.update({ where: { id: before.id }, data: { reviewStatus: body.data.reviewStatus } });
  await writeAudit(prisma, {
    actorId: currentUser(req).id,
    eventType: "impact.reviewed",
    objectType: "impact_item",
    objectId: item.id,
    payload: { before: before.reviewStatus, after: item.reviewStatus, comment: body.data.comment ?? null, obligationId: item.obligationId, ruleId: item.ruleId },
  });
  res.json(item);
});
