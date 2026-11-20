/**
 * Deterministic rule evaluator. Pure: no I/O, no clock, no randomness, no AI.
 * Same rule + same data + same evaluation date => the same result, always.
 */
import type {
  DeadlineRule,
  Evaluation,
  EvaluationResult,
  ProfileData,
  RequiredFieldRule,
  RuleDefinition,
  ThresholdRule,
} from "./types.js";

const UNIT_ALIASES: Record<string, string> = {
  percent: "%",
  pct: "%",
  "us$": "usd",
  "$": "usd",
  rs: "inr",
  "₹": "inr",
  year: "years",
  yr: "years",
  yrs: "years",
  day: "days",
  month: "months",
};

const normaliseUnit = (unit: string) => {
  const u = unit.trim().toLowerCase();
  return UNIT_ALIASES[u] ?? u;
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

const has = (data: ProfileData, key: string) => Object.prototype.hasOwnProperty.call(data, key);

/** Parse a YYYY-MM-DD date as a UTC day number; null if not a real calendar date. */
function dayNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return null; // rejects 2026-02-30
  return ms / 86_400_000;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^\s*-?[\d,]+(\.\d+)?\s*$/.test(value)) {
    const n = Number(value.replace(/[,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function compare(actual: number, operator: ThresholdRule["operator"], expected: number): boolean {
  switch (operator) {
    case ">=": return actual >= expected;
    case ">": return actual > expected;
    case "<=": return actual <= expected;
    case "<": return actual < expected;
    case "==": return actual === expected;
    case "!=": return actual !== expected;
  }
}

type Outcome = { result: EvaluationResult; inputs: Record<string, unknown>; explanation: string };

function evaluateThreshold(rule: ThresholdRule, data: ProfileData): Outcome {
  const field = rule.input_field;
  const unitField = `${field}_unit`;
  const inputs: Record<string, unknown> = {};
  if (has(data, field)) inputs[field] = data[field];
  if (rule.unit !== null && has(data, unitField)) inputs[unitField] = data[unitField];

  if (!has(data, field)) {
    return { result: "INSUFFICIENT_DATA", inputs, explanation: `No value for "${field}" in the entity data.` };
  }
  const actual = toNumber(data[field]);
  if (actual === null) {
    return { result: "INSUFFICIENT_DATA", inputs, explanation: `"${field}" is not a number (${JSON.stringify(data[field])}).` };
  }
  if (rule.unit !== null) {
    const stated = data[unitField];
    if (typeof stated !== "string" || !stated.trim()) {
      return {
        result: "INSUFFICIENT_DATA",
        inputs,
        explanation: `The rule is in ${rule.unit} but the entity data does not state a unit ("${unitField}").`,
      };
    }
    if (normaliseUnit(stated) !== normaliseUnit(rule.unit)) {
      return {
        result: "INSUFFICIENT_DATA",
        inputs,
        explanation: `Unit mismatch: the rule is in ${rule.unit}, the entity data is in ${stated}. No conversion is made.`,
      };
    }
  }
  const unit = rule.unit ? ` ${rule.unit}` : "";
  const ok = compare(actual, rule.operator, rule.value);
  return {
    result: ok ? "PASS" : "FAIL",
    inputs,
    explanation: `${field} = ${fmt(actual)}${unit}; required ${rule.operator} ${fmt(rule.value)}${unit}: ${ok ? "met" : "not met"}.`,
  };
}

function evaluateDeadline(rule: DeadlineRule, data: ProfileData, today: number): Outcome {
  const field = rule.input_field;
  const due = dayNumber(rule.due_date)!;
  if (!has(data, field)) {
    return {
      result: "INSUFFICIENT_DATA",
      inputs: {},
      explanation: `No information on "${field}" (completion date, or null if not done yet).`,
    };
  }
  const inputs = { [field]: data[field] };
  const value = data[field];

  if (value === null || value === "") {
    const daysLeft = due - today;
    if (daysLeft < 0) {
      return { result: "FAIL", inputs, explanation: `Not done and overdue: due ${rule.due_date}, ${-daysLeft} day(s) ago.` };
    }
    if (daysLeft <= rule.upcoming_window_days) {
      return {
        result: "UPCOMING_DEADLINE",
        inputs,
        explanation: `Not done yet; due ${rule.due_date} in ${daysLeft} day(s) (within the ${rule.upcoming_window_days} days window).`,
      };
    }
    return { result: "PASS", inputs, explanation: `Not yet due: due ${rule.due_date} in ${daysLeft} day(s).` };
  }

  const done = dayNumber(value);
  if (done === null) {
    return { result: "INSUFFICIENT_DATA", inputs, explanation: `"${field}" is not a valid YYYY-MM-DD date (${JSON.stringify(value)}).` };
  }
  return done <= due
    ? { result: "PASS", inputs, explanation: `Done on ${value}, on or before the due date ${rule.due_date}.` }
    : { result: "FAIL", inputs, explanation: `Done on ${value}, after the due date ${rule.due_date}.` };
}

function evaluateRequired(rule: RequiredFieldRule, data: ProfileData): Outcome {
  const field = rule.input_field;
  if (!has(data, field)) {
    return { result: "INSUFFICIENT_DATA", inputs: {}, explanation: `No information on "${field}".` };
  }
  const value = data[field];
  const present =
    typeof value === "number" ? Number.isFinite(value) : typeof value === "string" ? value.trim() !== "" : value === true;
  return {
    result: present ? "PASS" : "FAIL",
    inputs: { [field]: value },
    explanation: present ? `"${field}" is present.` : `"${field}" is missing or false.`,
  };
}

export function evaluate(rule: RuleDefinition, data: ProfileData, evaluationDate: string): Evaluation {
  const today = dayNumber(evaluationDate);
  if (today === null) throw new Error(`evaluationDate must be a YYYY-MM-DD date, got ${JSON.stringify(evaluationDate)}`);

  const outcome =
    rule.type === "threshold"
      ? evaluateThreshold(rule, data)
      : rule.type === "deadline"
        ? evaluateDeadline(rule, data, today)
        : evaluateRequired(rule, data);

  return {
    result: outcome.result,
    rule_id: rule.rule_id,
    rule_version: rule.rule_version,
    evaluation_date: evaluationDate,
    inputs_used: outcome.inputs,
    explanation: outcome.explanation,
  };
}

/** A rule applies when it names no categories, or names the entity's category. */
export function appliesTo(rule: RuleDefinition, categoryName: string): boolean {
  return rule.applies_to.length === 0 || rule.applies_to.includes(categoryName);
}
