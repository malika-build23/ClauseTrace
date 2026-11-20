/**
 * Transparent, deterministic scoring (Block J). Every label comes with the
 * reasons that produced it. These are review aids: they say where to look
 * first, not whether something is correct or compliant.
 */

// ─── Review priority for AI-proposed obligations ─────────────────────────

export type PriorityInput = {
  ambiguityFlag: boolean;
  ambiguityReason: string | null;
  machineCheckable: boolean;
  confidence: number | null;
  condition: string | null;
  deadline: Date | string | null;
};

export type Priority = { level: "high" | "medium" | "low"; reasons: string[] };

export function reviewPriority(o: PriorityInput): Priority {
  const high: string[] = [];
  const medium: string[] = [];
  if (o.ambiguityFlag) high.push(o.ambiguityReason ? `Ambiguous: ${o.ambiguityReason}` : "Marked ambiguous");
  if (o.machineCheckable) high.push("Becomes an executable rule if approved, so a wrong value would change results");
  if (o.confidence !== null && o.confidence < 0.7) high.push(`Low model confidence (${Math.round(o.confidence * 100)}%)`);
  if (o.deadline) medium.push("Has a deadline");
  if (o.condition) medium.push("Has a condition that limits when it applies");
  if (o.confidence === null) medium.push("No model confidence recorded");
  else if (o.confidence >= 0.7 && o.confidence < 0.9) medium.push(`Moderate model confidence (${Math.round(o.confidence * 100)}%)`);
  if (high.length) return { level: "high", reasons: [...high, ...medium] };
  if (medium.length) return { level: "medium", reasons: medium };
  return { level: "low", reasons: ["Plain obligation, no flags"] };
}

// ─── Risk score for evaluation results ───────────────────────────────────

export type RiskWeights = {
  fail: number;
  overdue: number; // a deadline already missed
  upcoming: number; // a deadline inside its window
  upcomingPerDayInside: number; // extra per day closer to the due date (max window)
  insufficient: number;
  pendingChange: number; // the source clause changed and the change is not reviewed yet
  highThreshold: number;
  mediumThreshold: number;
};

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  fail: 6,
  overdue: 8,
  upcoming: 3,
  upcomingPerDayInside: 0.1,
  insufficient: 2,
  pendingChange: 4,
  highThreshold: 6,
  mediumThreshold: 3,
};

export type RiskInput = {
  result: "PASS" | "FAIL" | "UPCOMING_DEADLINE" | "INSUFFICIENT_DATA";
  ruleType: "threshold" | "deadline" | "required_field";
  daysToDue: number | null; // deadline rules only
  upcomingWindowDays: number | null;
  pendingChange: boolean;
};

export type Risk = { score: number; level: "high" | "medium" | "low"; reasons: string[] };

export function riskScore(i: RiskInput, w: RiskWeights = DEFAULT_RISK_WEIGHTS): Risk {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    if (points <= 0) return;
    score += points;
    reasons.push(`${reason} (+${Math.round(points * 10) / 10})`);
  };
  if (i.result === "FAIL") {
    if (i.ruleType === "deadline" && i.daysToDue !== null && i.daysToDue < 0) add(w.overdue, `Deadline missed ${-i.daysToDue} day(s) ago`);
    else add(w.fail, "Check fails");
  }
  if (i.result === "UPCOMING_DEADLINE") {
    add(w.upcoming, `Due in ${i.daysToDue ?? "?"} day(s)`);
    if (i.daysToDue !== null && i.upcomingWindowDays !== null) {
      add((i.upcomingWindowDays - i.daysToDue) * w.upcomingPerDayInside, "Closer to the due date");
    }
  }
  if (i.result === "INSUFFICIENT_DATA") add(w.insufficient, "Missing or unusable data");
  if (i.pendingChange) add(w.pendingChange, "Source clause changed and is not reviewed yet");
  const rounded = Math.round(score * 10) / 10;
  const level = rounded >= w.highThreshold ? "high" : rounded >= w.mediumThreshold ? "medium" : "low";
  return { score: rounded, level, reasons: reasons.length ? reasons : ["No risk factors"] };
}
