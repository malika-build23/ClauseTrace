/**
 * Conflict candidates (Block K). Flags pairs of obligations that set
 * different limits on the same metric. It never decides that something IS a
 * conflict: limits for different situations (e.g. two different fees) are
 * normal, and a reviewer marks them "not a conflict".
 */

export type ConflictInput = {
  id: string;
  obligationKey: string;
  documentId: string;
  documentVersionId: string;
  clauseId: string;
  clauseNumber: string;
  documentTitle: string;
  thresholdJson: unknown;
};

export type ConflictCandidate = { aId: string; bId: string; reason: string };

type Threshold = { metric: string; operator: string; value: number; unit: string | null };

function threshold(t: unknown): Threshold | null {
  if (!t || typeof t !== "object") return null;
  const x = t as Record<string, unknown>;
  if (typeof x.metric !== "string" || typeof x.operator !== "string" || typeof x.value !== "number") return null;
  return { metric: x.metric.toLowerCase().trim(), operator: x.operator, value: x.value, unit: typeof x.unit === "string" ? x.unit.trim().toLowerCase() : null };
}

const show = (t: Threshold) => `${t.operator} ${t.value.toLocaleString("en-US")}${t.unit ? ` ${t.unit.toUpperCase()}` : ""}`;

export function findConflictCandidates(obligations: ConflictInput[]): ConflictCandidate[] {
  const withLimits = obligations.flatMap((o) => {
    const t = threshold(o.thresholdJson);
    return t ? [{ o, t }] : [];
  });
  const out: ConflictCandidate[] = [];
  for (let i = 0; i < withLimits.length; i++) {
    for (let j = i + 1; j < withLimits.length; j++) {
      const a = withLimits[i];
      const b = withLimits[j];
      if (a.t.metric !== b.t.metric) continue;
      if (a.o.clauseId === b.o.clauseId) continue;
      // Different versions of the same document are amendments, handled by version comparison.
      if (a.o.documentId === b.o.documentId && a.o.documentVersionId !== b.o.documentVersionId) continue;
      if (a.t.operator === b.t.operator && a.t.value === b.t.value && a.t.unit === b.t.unit) continue;
      const [first, second] = a.o.id < b.o.id ? [a, b] : [b, a];
      const where = (x: typeof a) => (a.o.documentId === b.o.documentId ? `clause ${x.o.clauseNumber}` : `${x.o.documentTitle}, clause ${x.o.clauseNumber}`);
      out.push({
        aId: first.o.id,
        bId: second.o.id,
        reason: `Same metric "${a.t.metric}": ${where(first)} requires ${show(first.t)}, ${where(second)} requires ${show(second.t)}`,
      });
    }
  }
  return out;
}
