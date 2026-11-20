import type { ObligationStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { requireRole } from "../lib/auth.js";
import { getObligation, reviewObligation } from "./obligation-review.js";

const STATUSES: ObligationStatus[] = ["proposed", "approved", "edited", "rejected"];

export const obligationsRouter = Router();

/**
 * List obligations with source references, lowest confidence and ambiguous
 * first (the review order from the plan). Filters:
 *   ?status=proposed  ?documentId=<id>  ?ambiguous=true  ?limit=100  ?allVersions=true
 */
obligationsRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status && !STATUSES.includes(status as ObligationStatus)) {
    res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
    return;
  }
  const documentId = typeof req.query.documentId === "string" ? req.query.documentId : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  const where: Prisma.ObligationWhereInput = {
    ...(req.query.allVersions === "true" ? {} : { nextVersion: null }), // latest version of each obligation
    ...(status ? { status: status as ObligationStatus } : {}),
    ...(req.query.ambiguous === "true" ? { ambiguityFlag: true } : {}),
    ...(documentId ? { clause: { documentVersion: { documentId } } } : {}),
  };

  const obligations = await prisma.obligation.findMany({
    where,
    take: limit,
    orderBy: [{ ambiguityFlag: "desc" }, { confidence: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    omit: { previousVersionId: true, approvedById: true },
    include: {
      clause: {
        select: {
          clauseNumber: true,
          page: true,
          documentVersion: { select: { versionNo: true, document: { select: { id: true, title: true } } } },
        },
      },
    },
  });
  res.json(obligations);
});

obligationsRouter.get("/:id", getObligation);
obligationsRouter.patch("/:id/review", requireRole("reviewer"), reviewObligation);
