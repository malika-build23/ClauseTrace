import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser, requireRole } from "../lib/auth.js";
import { evaluateProfile } from "../lib/rules-service.js";

export const evaluationsRouter = Router();

const todayUtc = () => new Date().toISOString().slice(0, 10);

const RunBody = z.object({
  profileId: z.string().uuid(),
  evaluationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  ruleIds: z.array(z.string().uuid()).max(500).optional(),
});

// Evaluate all applicable active rules for a profile (stored, audited).
evaluationsRouter.post("/", requireRole("reviewer"), async (req, res) => {
  const body = RunBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const user = currentUser(req);
  const evaluationDate = body.data.evaluationDate ?? todayUtc();
  const result = await evaluateProfile(user.id, user.orgId, body.data.profileId, evaluationDate, body.data.ruleIds);
  if (!result) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.status(201).json({ evaluationDate, ...result });
});

const evaluationInclude = {
  rule: { select: { ruleKey: true, ruleVersion: true, type: true, definitionJson: true, isActive: true } },
  profile: { select: { id: true, name: true, isSimulation: true } },
} as const;

/**
 * Results. Simulations are excluded unless ?includeSimulation=true.
 *   ?profileId=  ?latest=true (latest result per rule key and profile)  ?limit=
 */
evaluationsRouter.get("/", async (req, res) => {
  const orgId = currentUser(req).orgId;
  const profileId = typeof req.query.profileId === "string" ? req.query.profileId : undefined;
  const includeSimulation = req.query.includeSimulation === "true";
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000);

  const evaluations = await prisma.evaluation.findMany({
    where: {
      profile: { orgId },
      ...(profileId ? { profileId } : {}),
      ...(includeSimulation ? {} : { isSimulation: false }),
    },
    include: evaluationInclude,
    orderBy: [{ evaluatedAt: "desc" }],
    take: limit,
  });

  if (req.query.latest === "true") {
    const seen = new Set<string>();
    res.json(
      evaluations.filter((e) => {
        const key = `${e.rule.ruleKey}|${e.profileId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
    return;
  }
  res.json(evaluations);
});

evaluationsRouter.get("/:id", async (req, res) => {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: String(req.params.id), profile: { orgId: currentUser(req).orgId } },
    include: evaluationInclude,
  });
  if (!evaluation) {
    res.status(404).json({ error: "Evaluation not found" });
    return;
  }
  res.json(evaluation);
});
