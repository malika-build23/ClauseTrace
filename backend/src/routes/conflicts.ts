import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser, requireRole } from "../lib/auth.js";
import { findConflictCandidates } from "../lib/conflicts.js";

// Conflict flags (Block K). Flag only, never conclude: a reviewer decides.
export const conflictsRouter = Router();

const obligationSelect = {
  id: true,
  obligationKey: true,
  version: true,
  status: true,
  subject: true,
  action: true,
  quote: true,
  thresholdJson: true,
  clause: { select: { clauseNumber: true, page: true, documentVersion: { select: { versionNo: true, document: { select: { id: true, title: true } } } } } },
} as const;

conflictsRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const flags = await prisma.conflictFlag.findMany({
    where: status ? { status: status as "flagged" | "confirmed" | "resolved" | "not_a_conflict" } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { obligationA: { select: obligationSelect }, obligationB: { select: obligationSelect }, reviewedBy: { select: { name: true } } },
  });
  res.json(flags);
});

// Scan the latest, non-rejected obligations for candidate pairs. Existing flags (and their review) are kept.
conflictsRouter.post("/scan", requireRole("reviewer"), async (req, res) => {
  const obligations = await prisma.obligation.findMany({
    where: { nextVersion: null, status: { not: "rejected" }, NOT: { thresholdJson: { equals: Prisma.DbNull } } },
    select: {
      id: true,
      obligationKey: true,
      thresholdJson: true,
      clauseId: true,
      clause: { select: { clauseNumber: true, documentVersionId: true, documentVersion: { select: { documentId: true, document: { select: { title: true } } } } } },
    },
  });
  const candidates = findConflictCandidates(
    obligations.map((o) => ({
      id: o.id,
      obligationKey: o.obligationKey,
      thresholdJson: o.thresholdJson,
      clauseId: o.clauseId,
      clauseNumber: o.clause.clauseNumber,
      documentVersionId: o.clause.documentVersionId,
      documentId: o.clause.documentVersion.documentId,
      documentTitle: o.clause.documentVersion.document.title,
    })),
  );
  const created = await prisma.conflictFlag.createManyAndReturn({
    data: candidates.map((c) => ({ obligationAId: c.aId, obligationBId: c.bId, reason: c.reason })),
    skipDuplicates: true,
    select: { id: true },
  });
  const user = currentUser(req);
  for (const f of created) {
    await writeAudit(prisma, { actorId: user.id, eventType: "conflict.flagged", objectType: "conflict_flag", objectId: f.id });
  }
  res.json({ candidates: candidates.length, newFlags: created.length });
});

const Review = z.object({ status: z.enum(["flagged", "confirmed", "resolved", "not_a_conflict"]), comment: z.string().trim().max(1000).optional() });

conflictsRouter.patch("/:id", requireRole("reviewer"), async (req, res) => {
  const body = Review.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid status" });
    return;
  }
  const before = await prisma.conflictFlag.findUnique({ where: { id: String(req.params.id) } });
  if (!before) {
    res.status(404).json({ error: "Conflict flag not found" });
    return;
  }
  const user = currentUser(req);
  const flag = await prisma.conflictFlag.update({ where: { id: before.id }, data: { status: body.data.status, reviewedById: user.id } });
  await writeAudit(prisma, {
    actorId: user.id,
    eventType: "conflict.reviewed",
    objectType: "conflict_flag",
    objectId: flag.id,
    payload: { before: before.status, after: flag.status, comment: body.data.comment ?? null, reason: flag.reason },
  });
  res.json(flag);
});
