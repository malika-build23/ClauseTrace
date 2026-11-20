import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { compileObligation, sameRule, type CompileOptions } from "../rule-engine/compile.js";
import { appliesTo, evaluate } from "../rule-engine/evaluate.js";
import { RuleDefinition } from "../rule-engine/types.js";
import { writeAudit } from "./audit.js";

export type CompileOutcome = {
  obligationId: string;
  obligationKey: string;
  outcome: "created" | "new_version" | "unchanged" | "skipped";
  ruleKey?: string;
  ruleVersion?: number;
  reason?: string;
};

/**
 * Compile approved obligations into rules. Only the latest version of each
 * obligation is used. Rules are never edited: an identical definition is a
 * no-op, a different one deactivates the old version and adds a new one.
 */
export async function compileRules(
  actorId: string,
  obligationIds?: string[],
  options: Record<string, CompileOptions> = {},
): Promise<CompileOutcome[]> {
  const obligations = await prisma.obligation.findMany({
    where: {
      status: { in: ["approved", "edited"] },
      nextVersion: null, // latest version only
      ...(obligationIds?.length ? { id: { in: obligationIds } } : {}),
    },
    include: { entityCategories: { include: { entityCategory: { select: { name: true } } } } },
    orderBy: { obligationKey: "asc" },
  });

  const outcomes: CompileOutcome[] = [];
  for (const ob of obligations) {
    const compiled = compileObligation(
      {
        obligationKey: ob.obligationKey,
        status: ob.status,
        machineCheckable: ob.machineCheckable,
        referenceOnly: ob.referenceOnly,
        action: ob.action,
        evidence: ob.evidence,
        thresholdJson: ob.thresholdJson,
        deadline: ob.deadline,
        categories: ob.entityCategories.map((c) => c.entityCategory.name),
      },
      options[ob.id],
    );
    const base = { obligationId: ob.id, obligationKey: ob.obligationKey };
    if (!compiled.ok) {
      outcomes.push({ ...base, outcome: "skipped", reason: compiled.reason });
      continue;
    }

    const ruleKey = compiled.definition.rule_id;
    const outcome = await prisma.$transaction(async (tx) => {
      const latest = await tx.rule.findFirst({ where: { ruleKey }, orderBy: { ruleVersion: "desc" } });
      if (latest && latest.isActive && latest.obligationId === ob.id && sameRule(latest.definitionJson as object, compiled.definition)) {
        return { ...base, outcome: "unchanged" as const, ruleKey, ruleVersion: latest.ruleVersion };
      }
      const ruleVersion = (latest?.ruleVersion ?? 0) + 1;
      await tx.rule.updateMany({ where: { ruleKey, isActive: true }, data: { isActive: false } });
      const definition = { ...compiled.definition, rule_version: ruleVersion };
      const rule = await tx.rule.create({
        data: {
          ruleKey,
          ruleVersion,
          obligationId: ob.id,
          type: definition.type,
          definitionJson: definition as unknown as Prisma.InputJsonValue,
          createdById: actorId,
        },
      });
      await writeAudit(tx, {
        actorId,
        eventType: latest ? "rule.new_version" : "rule.created",
        objectType: "rule",
        objectId: rule.id,
        payload: { ruleKey, ruleVersion, obligationKey: ob.obligationKey, obligationVersion: ob.version, definition },
      });
      return { ...base, outcome: latest ? ("new_version" as const) : ("created" as const), ruleKey, ruleVersion };
    });
    outcomes.push(outcome);
  }
  return outcomes;
}

/** Evaluate every active, applicable rule for one entity profile and store the results. */
export async function evaluateProfile(actorId: string, orgId: string, profileId: string, evaluationDate: string, ruleIds?: string[]) {
  const profile = await prisma.entityProfile.findFirst({
    where: { id: profileId, orgId },
    include: { category: { select: { name: true } } },
  });
  if (!profile) return null;

  const rules = await prisma.rule.findMany({
    where: { isActive: true, ...(ruleIds?.length ? { id: { in: ruleIds } } : {}) },
    include: {
      obligation: {
        select: {
          obligationKey: true,
          version: true,
          quote: true,
          approvedBy: { select: { name: true } },
          clause: {
            select: {
              clauseNumber: true,
              page: true,
              documentVersion: { select: { versionNo: true, document: { select: { id: true, title: true } } } },
            },
          },
        },
      },
    },
    orderBy: { ruleKey: "asc" },
  });

  const data = (profile.dataJson ?? {}) as Record<string, unknown>;
  const rows: Prisma.EvaluationCreateManyInput[] = [];
  for (const rule of rules) {
    const definition = RuleDefinition.parse(rule.definitionJson);
    if (!appliesTo(definition, profile.category.name)) continue;
    const result = evaluate(definition, data, evaluationDate);
    const clause = rule.obligation.clause;
    rows.push({
      ruleId: rule.id,
      ruleVersion: rule.ruleVersion,
      profileId: profile.id,
      inputRef: result.inputs_used as Prisma.InputJsonValue,
      evaluationDate: new Date(`${evaluationDate}T00:00:00Z`),
      result: result.result,
      isSimulation: profile.isSimulation,
      detailsJson: {
        explanation: result.explanation,
        ruleKey: rule.ruleKey,
        obligation: {
          key: rule.obligation.obligationKey,
          version: rule.obligation.version,
          quote: rule.obligation.quote,
          approvedBy: rule.obligation.approvedBy?.name ?? null,
        },
        source: {
          documentId: clause.documentVersion.document.id,
          document: clause.documentVersion.document.title,
          documentVersion: clause.documentVersion.versionNo,
          clause: clause.clauseNumber,
          page: clause.page,
        },
      },
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const evaluations = rows.length ? await tx.evaluation.createManyAndReturn({ data: rows }) : [];
    for (const ev of evaluations) {
      await writeAudit(tx, {
        actorId,
        eventType: profile.isSimulation ? "evaluation.simulated" : "evaluation.run",
        objectType: "evaluation",
        objectId: ev.id,
        payload: { ruleId: ev.ruleId, ruleVersion: ev.ruleVersion, profileId: ev.profileId, result: ev.result, evaluationDate },
      });
    }
    return evaluations;
  });
  return { profile: { id: profile.id, name: profile.name, isSimulation: profile.isSimulation }, evaluations: created };
}
