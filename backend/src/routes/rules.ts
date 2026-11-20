import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser, requireRole } from "../lib/auth.js";
import { compileRules } from "../lib/rules-service.js";

export const rulesRouter = Router();

const ruleInclude = {
  obligation: {
    select: {
      id: true,
      obligationKey: true,
      version: true,
      subject: true,
      action: true,
      quote: true,
      clause: {
        select: {
          clauseNumber: true,
          page: true,
          documentVersion: { select: { versionNo: true, document: { select: { id: true, title: true } } } },
        },
      },
    },
  },
  createdBy: { select: { name: true } },
} as const;

// ?active=true (default) | false | all
rulesRouter.get("/", async (req, res) => {
  const active = req.query.active === "all" ? undefined : req.query.active !== "false";
  const rules = await prisma.rule.findMany({
    where: active === undefined ? {} : { isActive: active },
    include: ruleInclude,
    orderBy: [{ ruleKey: "asc" }, { ruleVersion: "desc" }],
  });
  res.json(rules);
});

// All versions of one rule key, newest first.
rulesRouter.get("/history/:ruleKey", async (req, res) => {
  const rules = await prisma.rule.findMany({
    where: { ruleKey: String(req.params.ruleKey) },
    include: ruleInclude,
    orderBy: { ruleVersion: "desc" },
  });
  if (rules.length === 0) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  res.json(rules);
});

const CompileBody = z.object({
  obligationIds: z.array(z.string().uuid()).max(500).optional(),
  // per-obligation options, keyed by obligation id
  options: z
    .record(
      z.object({
        type: z.literal("required_field").optional(),
        inputField: z.string().regex(/^[a-z][a-z0-9_.]{0,79}$/, "lowercase letters, digits, _ and .").optional(),
        upcomingWindowDays: z.number().int().min(0).max(365).optional(),
      }),
    )
    .optional(),
});

// Compile approved, machine-checkable obligations into versioned rules.
rulesRouter.post("/compile", requireRole("reviewer"), async (req, res) => {
  const body = CompileBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  const outcomes = await compileRules(currentUser(req).id, body.data.obligationIds, body.data.options);
  const count = (o: string) => outcomes.filter((x) => x.outcome === o).length;
  res.json({
    summary: { created: count("created"), newVersion: count("new_version"), unchanged: count("unchanged"), skipped: count("skipped") },
    outcomes,
  });
});
