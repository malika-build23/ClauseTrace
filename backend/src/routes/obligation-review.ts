import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser } from "../lib/auth.js";
import { reviewPriority } from "../lib/scoring.js";

const Threshold = z.object({
  metric: z.string().trim().regex(/^[a-z][a-z0-9_]{0,59}$/, "metric: lowercase snake_case"),
  operator: z.enum([">=", ">", "<=", "<", "==", "!="]),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(30).nullable(),
});

// Fields a reviewer may change. The quote and clause are never editable: they are the source.
const Edits = z.object({
  subject: z.string().trim().min(1).max(300).optional(),
  modality: z.enum(["must", "must_not", "may", "should"]).optional(),
  action: z.string().trim().min(1).max(1000).optional(),
  condition: z.string().trim().max(1000).nullable().optional(),
  threshold: Threshold.nullable().optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  evidence: z.string().trim().max(1000).nullable().optional(),
  machineCheckable: z.boolean().optional(),
  ambiguityFlag: z.boolean().optional(),
  ambiguityReason: z.string().trim().max(500).nullable().optional(),
});

const Categories = z.array(z.string().min(1)).max(20).optional();

export const ReviewBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    comment: z.string().trim().max(2000).optional(),
    referenceOnly: z.boolean().optional(),
    categories: Categories,
  }),
  z.object({
    action: z.literal("edit"),
    edits: Edits,
    comment: z.string().trim().max(2000).optional(),
    referenceOnly: z.boolean().optional(),
    categories: Categories,
  }),
  z.object({ action: z.literal("reject"), comment: z.string().trim().min(3, "A comment is required to reject").max(2000) }),
]);

const DEFAULT_CATEGORY = "Fund Management Entity";

const include = { entityCategories: { include: { entityCategory: true } }, nextVersion: { select: { id: true } } } as const;
type ObligationWithCategories = Prisma.ObligationGetPayload<{ include: typeof include }>;

function snapshot(o: ObligationWithCategories) {
  return {
    obligationKey: o.obligationKey,
    version: o.version,
    status: o.status,
    subject: o.subject,
    modality: o.modality,
    action: o.action,
    condition: o.condition,
    threshold: o.thresholdJson,
    deadline: o.deadline ? o.deadline.toISOString().slice(0, 10) : null,
    evidence: o.evidence,
    machineCheckable: o.machineCheckable,
    ambiguityFlag: o.ambiguityFlag,
    ambiguityReason: o.ambiguityReason,
    referenceOnly: o.referenceOnly,
    categories: o.entityCategories.map((c) => c.entityCategory.name).sort(),
  } satisfies Prisma.InputJsonValue;
}

/**
 * PATCH /api/obligations/:id/review: approve, edit-and-approve, or reject.
 * - Only the latest version can be reviewed.
 * - Editing creates a new obligation version (status "edited"); the old one is kept unchanged.
 * - Rejecting, or editing, deactivates rules compiled from the previous text.
 */
export async function reviewObligation(req: Request, res: Response) {
  const body = ReviewBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid review" });
    return;
  }
  const reviewer = currentUser(req);
  const ob = await prisma.obligation.findUnique({ where: { id: String(req.params.id) }, include });
  if (!ob) {
    res.status(404).json({ error: "Obligation not found" });
    return;
  }
  if (ob.nextVersion) {
    res.status(409).json({ error: "A newer version of this obligation exists; review that one", nextVersionId: ob.nextVersion.id });
    return;
  }
  const review = body.data;
  if (review.action === "approve" && ob.status !== "proposed") {
    res.status(409).json({ error: `Already ${ob.status}. Use edit to change an approved obligation.` });
    return;
  }
  if (review.action === "reject" && ob.status === "rejected") {
    res.status(409).json({ error: "Already rejected" });
    return;
  }

  const categoryNames = review.action !== "reject" && review.categories?.length ? review.categories : null;
  const categories = categoryNames
    ? await prisma.entityCategory.findMany({ where: { name: { in: categoryNames } } })
    : ob.entityCategories.length
      ? ob.entityCategories.map((c) => c.entityCategory)
      : await prisma.entityCategory.findMany({ where: { name: DEFAULT_CATEGORY } });
  if (categoryNames && categories.length !== new Set(categoryNames).size) {
    res.status(400).json({ error: "Unknown entity category" });
    return;
  }

  if (review.action === "edit") {
    const e = review.edits;
    const threshold = e.threshold === undefined ? ob.thresholdJson : e.threshold;
    const deadline = e.deadline === undefined ? ob.deadline : e.deadline;
    const evidence = e.evidence === undefined ? ob.evidence : e.evidence;
    const checkable = e.machineCheckable ?? ob.machineCheckable;
    if (checkable && !threshold && !deadline && !evidence) {
      res.status(400).json({ error: "A machine-checkable obligation needs a threshold, a deadline or an evidence field" });
      return;
    }
  }

  const before = snapshot(ob);
  const result = await prisma.$transaction(async (tx) => {
    let target: ObligationWithCategories;
    if (review.action === "reject") {
      target = await tx.obligation.update({ where: { id: ob.id }, data: { status: "rejected", approvedById: null }, include });
      await tx.rule.updateMany({ where: { obligationId: ob.id, isActive: true }, data: { isActive: false } });
    } else if (review.action === "approve") {
      target = await tx.obligation.update({
        where: { id: ob.id },
        data: {
          status: "approved",
          approvedById: reviewer.id,
          referenceOnly: review.referenceOnly ?? false,
          entityCategories: { deleteMany: {}, create: categories.map((c) => ({ entityCategoryId: c.id })) },
        },
        include,
      });
    } else {
      const e = review.edits;
      const threshold = e.threshold === undefined ? ob.thresholdJson : e.threshold;
      target = await tx.obligation.create({
        data: {
          obligationKey: ob.obligationKey,
          version: ob.version + 1,
          previousVersionId: ob.id,
          clauseId: ob.clauseId,
          quote: ob.quote,
          subject: e.subject ?? ob.subject,
          modality: e.modality ?? ob.modality,
          action: e.action ?? ob.action,
          condition: e.condition === undefined ? ob.condition : e.condition,
          thresholdJson: threshold === null ? Prisma.DbNull : (threshold as Prisma.InputJsonValue),
          deadline: e.deadline === undefined ? ob.deadline : e.deadline ? new Date(`${e.deadline}T00:00:00Z`) : null,
          evidence: e.evidence === undefined ? ob.evidence : e.evidence,
          machineCheckable: e.machineCheckable ?? ob.machineCheckable,
          ambiguityFlag: e.ambiguityFlag ?? ob.ambiguityFlag,
          ambiguityReason: e.ambiguityReason === undefined ? ob.ambiguityReason : e.ambiguityReason,
          referenceOnly: review.referenceOnly ?? ob.referenceOnly,
          confidence: ob.confidence,
          reviewPriority: reviewPriority({
            ambiguityFlag: e.ambiguityFlag ?? ob.ambiguityFlag,
            ambiguityReason: e.ambiguityReason === undefined ? ob.ambiguityReason : e.ambiguityReason,
            machineCheckable: e.machineCheckable ?? ob.machineCheckable,
            confidence: ob.confidence,
            condition: e.condition === undefined ? ob.condition : e.condition,
            deadline: e.deadline === undefined ? ob.deadline : e.deadline,
          }).level,
          status: "edited",
          approvedById: reviewer.id,
          extractionRunId: ob.extractionRunId,
          entityCategories: { create: categories.map((c) => ({ entityCategoryId: c.id })) },
        },
        include,
      });
      await tx.rule.updateMany({ where: { obligationId: ob.id, isActive: true }, data: { isActive: false } });
    }
    const after = snapshot(target);
    await tx.obligationReview.create({
      data: { obligationId: ob.id, reviewerId: reviewer.id, action: review.action, beforeJson: before, afterJson: after, comment: review.comment ?? null },
    });
    const eventType = review.action === "edit" ? "obligation.edited" : review.action === "approve" ? "obligation.approved" : "obligation.rejected";
    await writeAudit(tx, {
      actorId: reviewer.id,
      eventType,
      objectType: "obligation",
      objectId: target.id,
      payload: { before, after, comment: review.comment ?? null, previousVersionId: review.action === "edit" ? ob.id : null },
    });
    return target;
  });

  res.json({ id: result.id, obligationKey: result.obligationKey, version: result.version, status: result.status });
}

/** GET /api/obligations/:id: one obligation with its version chain, reviews and rules. */
export async function getObligation(req: Request, res: Response) {
  const ob = await prisma.obligation.findUnique({
    where: { id: String(req.params.id) },
    include: {
      clause: {
        select: {
          id: true,
          clauseNumber: true,
          page: true,
          text: true,
          documentVersion: { select: { versionNo: true, document: { select: { id: true, title: true } } } },
        },
      },
      approvedBy: { select: { name: true } },
      entityCategories: { include: { entityCategory: { select: { name: true } } } },
      nextVersion: { select: { id: true } },
      rules: { select: { id: true, ruleKey: true, ruleVersion: true, isActive: true }, orderBy: { ruleVersion: "desc" } },
    },
  });
  if (!ob) {
    res.status(404).json({ error: "Obligation not found" });
    return;
  }
  const history = await prisma.obligation.findMany({
    where: { obligationKey: ob.obligationKey },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      createdAt: true,
      approvedBy: { select: { name: true } },
      reviews: {
        orderBy: { createdAt: "asc" },
        select: { action: true, comment: true, createdAt: true, beforeJson: true, afterJson: true, reviewer: { select: { name: true } } },
      },
    },
  });
  res.json({ ...ob, history });
}
