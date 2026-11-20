import type { EvaluationResult } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { currentUser } from "../lib/auth.js";
import { loadRiskWeights } from "../lib/risk-config.js";
import { riskScore } from "../lib/scoring.js";

export const dashboardRouter = Router();

const RESULTS: EvaluationResult[] = ["PASS", "UPCOMING_DEADLINE", "FAIL", "INSUFFICIENT_DATA"];

/**
 * Aggregates for the dashboard. Results use only the latest evaluation per
 * (rule, profile) and never include simulations.
 */
dashboardRouter.get("/summary", async (req, res) => {
  const orgId = currentUser(req).orgId;

  const [obligationGroups, ambiguousProposed, activeRules, profiles, evaluations, documents, unresolvedChanges] = await Promise.all([
    prisma.obligation.groupBy({ by: ["status"], where: { nextVersion: null }, _count: { _all: true } }),
    prisma.obligation.count({ where: { nextVersion: null, status: "proposed", ambiguityFlag: true } }),
    prisma.rule.findMany({ where: { isActive: true }, select: { id: true, type: true } }),
    prisma.entityProfile.findMany({ where: { orgId, isSimulation: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.evaluation.findMany({
      where: { isSimulation: false, profile: { orgId } },
      orderBy: { evaluatedAt: "desc" },
      take: 5000,
      select: {
        id: true,
        result: true,
        ruleId: true,
        ruleVersion: true,
        profileId: true,
        evaluatedAt: true,
        evaluationDate: true,
        detailsJson: true,
        rule: { select: { ruleKey: true, isActive: true, definitionJson: true, type: true, obligationId: true } },
      },
    }),
    prisma.document.count(),
    prisma.changeEvent.count({ where: { status: "pending" } }),
  ]);

  // Latest result per (rule key, profile), active rules only.
  const seen = new Set<string>();
  const latest = evaluations.filter((e) => {
    if (!e.rule.isActive) return false;
    const key = `${e.rule.ruleKey}|${e.profileId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const emptyCounts = () => Object.fromEntries(RESULTS.map((r) => [r, 0])) as Record<EvaluationResult, number>;
  const totals = emptyCounts();
  const byProfile = new Map(profiles.map((p) => [p.id, { ...p, counts: emptyCounts(), lastEvaluatedAt: null as Date | null }]));
  for (const e of latest) {
    totals[e.result]++;
    const p = byProfile.get(e.profileId);
    if (p) {
      p.counts[e.result]++;
      if (!p.lastEvaluatedAt || e.evaluatedAt > p.lastEvaluatedAt) p.lastEvaluatedAt = e.evaluatedAt;
    }
  }

  // Unreviewed source changes touching a rule or its obligation raise the risk of every result that uses it.
  const pending = await prisma.impactItem.findMany({ where: { reviewStatus: "pending", changeEvent: { status: "pending" } }, select: { ruleId: true, obligationId: true } });
  const pendingRules = new Set(pending.flatMap((p) => (p.ruleId ? [p.ruleId] : [])));
  const pendingObligations = new Set(pending.flatMap((p) => (p.obligationId ? [p.obligationId] : [])));
  const weights = await loadRiskWeights(orgId);
  const scored = latest.map((e) => {
    const def = e.rule.definitionJson as { due_date?: string; upcoming_window_days?: number };
    const daysToDue = def.due_date ? Math.round((Date.parse(`${def.due_date}T00:00:00Z`) - e.evaluationDate.getTime()) / 86_400_000) : null;
    const risk = riskScore(
      { result: e.result, ruleType: e.rule.type, daysToDue, upcomingWindowDays: def.upcoming_window_days ?? null, pendingChange: pendingRules.has(e.ruleId) || pendingObligations.has(e.rule.obligationId) },
      weights,
    );
    return { e, risk };
  });

  const obligations = { proposed: 0, approved: 0, edited: 0, rejected: 0 };
  for (const g of obligationGroups) obligations[g.status] = g._count._all;

  res.json({
    documents,
    obligations: { ...obligations, ambiguousProposed },
    rules: { active: activeRules.length, byType: countBy(activeRules.map((r) => r.type)) },
    results: totals,
    profiles: [...byProfile.values()],
    riskWeights: weights,
    attention: scored
      .filter(({ risk }) => risk.score > 0)
      .sort((a, b) => b.risk.score - a.risk.score || RESULTS.indexOf(a.e.result) - RESULTS.indexOf(b.e.result))
      .slice(0, 50)
      .map(({ e, risk }) => ({
        risk,
        evaluationId: e.id,
        result: e.result,
        ruleKey: e.rule.ruleKey,
        ruleVersion: e.ruleVersion,
        profileId: e.profileId,
        profileName: byProfile.get(e.profileId)?.name ?? null,
        evaluatedAt: e.evaluatedAt,
        details: e.detailsJson,
      })),
    unresolvedChanges,
  });
});

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}
