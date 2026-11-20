import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { writeAudit } from "./audit.js";
import { alignClauses, describe } from "./version-diff.js";

/**
 * Compare two versions of a document, store the changes and what they affect.
 * Approved obligations and rules are never changed here: every impact item
 * waits for a reviewer.
 */
export async function compareVersions(documentId: string, fromNo: number, toNo: number, actorId: string) {
  const [from, to] = await Promise.all([
    prisma.documentVersion.findUnique({ where: { documentId_versionNo: { documentId, versionNo: fromNo } }, select: { id: true } }),
    prisma.documentVersion.findUnique({ where: { documentId_versionNo: { documentId, versionNo: toNo } }, select: { id: true } }),
  ]);
  if (!from || !to) return null;

  const existing = await prisma.changeEvent.count({ where: { oldVersionId: from.id, newVersionId: to.id } });
  if (existing > 0) return { fromVersionId: from.id, toVersionId: to.id, created: false };

  const [oldClauses, newClauses] = await Promise.all([
    prisma.clause.findMany({ where: { documentVersionId: from.id }, orderBy: { position: "asc" }, select: { id: true, clauseNumber: true, text: true } }),
    prisma.clause.findMany({ where: { documentVersionId: to.id }, orderBy: { position: "asc" }, select: { id: true, clauseNumber: true, text: true } }),
  ]);
  const alignment = alignClauses(oldClauses, newClauses).filter((a) => a.type !== "unchanged");

  // Obligations (latest version, not rejected) attached to each old clause, with active rules.
  const oldIds = alignment.flatMap((a) => ("old" in a ? [a.old.id] : []));
  const obligations = await prisma.obligation.findMany({
    where: { clauseId: { in: oldIds }, nextVersion: null, status: { not: "rejected" } },
    select: { id: true, clauseId: true, rules: { where: { isActive: true }, select: { id: true } } },
  });

  await prisma.$transaction(async (tx) => {
    for (const a of alignment) {
      const oldClause = "old" in a ? a.old : null;
      const newClause = "new" in a ? a.new : null;
      const event = await tx.changeEvent.create({
        data: {
          oldVersionId: from.id,
          newVersionId: to.id,
          changeType: a.type as "added" | "removed" | "modified",
          clauseRef: newClause?.clauseNumber ?? oldClause!.clauseNumber,
          oldText: oldClause?.text ?? null,
          newText: newClause?.text ?? null,
          summary: describe(a),
        },
      });
      const affected = oldClause ? obligations.filter((o) => o.clauseId === oldClause.id) : [];
      const items: Prisma.ImpactItemCreateManyInput[] = affected.flatMap((o): Prisma.ImpactItemCreateManyInput[] =>
        o.rules.length ? o.rules.map((r) => ({ changeEventId: event.id, obligationId: o.id, ruleId: r.id })) : [{ changeEventId: event.id, obligationId: o.id, ruleId: null }],
      );
      if (items.length) await tx.impactItem.createMany({ data: items });
    }
    await writeAudit(tx, {
      actorId,
      eventType: "document.compared",
      objectType: "document",
      objectId: documentId,
      payload: {
        fromVersion: fromNo,
        toVersion: toNo,
        added: alignment.filter((a) => a.type === "added").length,
        removed: alignment.filter((a) => a.type === "removed").length,
        modified: alignment.filter((a) => a.type === "modified").length,
      },
    });
  });
  return { fromVersionId: from.id, toVersionId: to.id, created: true };
}

/** Changes between two versions with their impact (obligations, rules, latest results). */
export async function listChanges(fromVersionId: string, toVersionId: string) {
  const events = await prisma.changeEvent.findMany({
    where: { oldVersionId: fromVersionId, newVersionId: toVersionId },
    orderBy: { createdAt: "asc" },
    include: {
      impactItems: {
        include: {
          obligation: { select: { id: true, obligationKey: true, version: true, status: true, subject: true, action: true } },
          rule: { select: { id: true, ruleKey: true, ruleVersion: true, isActive: true } },
        },
      },
    },
  });
  const ruleIds = events.flatMap((e) => e.impactItems.flatMap((i) => (i.rule ? [i.rule.id] : [])));
  const results = ruleIds.length
    ? await prisma.evaluation.groupBy({ by: ["ruleId", "result"], where: { ruleId: { in: ruleIds }, isSimulation: false }, _count: { _all: true } })
    : [];
  const resultsByRule: Record<string, Record<string, number>> = {};
  for (const r of results) {
    resultsByRule[r.ruleId] ??= {};
    resultsByRule[r.ruleId][r.result] = r._count._all;
  }
  return events.map((e) => ({
    ...e,
    impactItems: e.impactItems.map((i) => ({ ...i, evaluations: i.rule ? (resultsByRule[i.rule.id] ?? {}) : {} })),
  }));
}
