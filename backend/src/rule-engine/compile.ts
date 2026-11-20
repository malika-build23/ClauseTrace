/**
 * Rule compiler: approved obligation -> rule definition, by fixed templates.
 * No AI. Anything incomplete or ambiguous is refused with a reason rather
 * than guessed.
 */
import { Operator, RuleDefinition } from "./types.js";

export type CompilableObligation = {
  obligationKey: string;
  status: "proposed" | "approved" | "edited" | "rejected";
  machineCheckable: boolean;
  referenceOnly: boolean;
  action: string;
  evidence: string | null;
  thresholdJson: unknown;
  deadline: Date | string | null;
  categories: string[]; // entity category names the obligation applies to
};

export type CompileOptions = {
  type?: "required_field"; // the only type that must be requested explicitly
  inputField?: string;
  upcomingWindowDays?: number;
};

/** Definition without rule_version: the caller assigns the version. */
export type CompiledRule = DistributiveOmit<RuleDefinition, "rule_version">;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type CompileResult = { ok: true; definition: CompiledRule } | { ok: false; reason: string };

export const DEFAULT_UPCOMING_WINDOW_DAYS = 30;

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/g, "");
}

const isoDay = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export function compileObligation(ob: CompilableObligation, opts: CompileOptions = {}): CompileResult {
  if (ob.status !== "approved" && ob.status !== "edited") {
    return { ok: false, reason: `Only approved obligations compile (status is ${ob.status})` };
  }
  if (ob.referenceOnly) return { ok: false, reason: "Approved as reference only (not executable)" };
  if (!ob.machineCheckable) return { ok: false, reason: "Not machine-checkable" };

  const common = {
    rule_id: `R-${ob.obligationKey}`,
    obligation_id: ob.obligationKey,
    applies_to: [...ob.categories].sort(),
  };

  let candidate: unknown;
  if (opts.type === "required_field") {
    const field = opts.inputField ?? (ob.evidence ? slug(ob.evidence) : "");
    if (!field) return { ok: false, reason: "required_field needs an input field or an evidence description" };
    candidate = { ...common, type: "required_field", input_field: field };
  } else if (ob.thresholdJson !== null && ob.thresholdJson !== undefined) {
    const t = ob.thresholdJson as Record<string, unknown>;
    if (typeof t !== "object" || Array.isArray(t)) return { ok: false, reason: "Threshold is not an object" };
    if (!Operator.safeParse(t.operator).success) return { ok: false, reason: `Unknown operator ${JSON.stringify(t.operator)}` };
    if (typeof t.value !== "number" || !Number.isFinite(t.value)) return { ok: false, reason: "Threshold value is not a number" };
    if (typeof t.metric !== "string" || !slug(t.metric)) return { ok: false, reason: "Threshold has no metric name" };
    candidate = {
      ...common,
      type: "threshold",
      input_field: opts.inputField ?? slug(t.metric),
      operator: t.operator,
      value: t.value,
      unit: typeof t.unit === "string" && t.unit.trim() ? t.unit.trim() : null,
    };
  } else if (ob.deadline) {
    candidate = {
      ...common,
      type: "deadline",
      input_field: opts.inputField ?? `${slug(ob.action).slice(0, 47)}_completed_on`,
      due_date: isoDay(ob.deadline),
      upcoming_window_days: opts.upcomingWindowDays ?? DEFAULT_UPCOMING_WINDOW_DAYS,
    };
  } else {
    return { ok: false, reason: "No threshold or deadline to check (use type required_field for presence checks)" };
  }

  const parsed = RuleDefinition.safeParse({ ...(candidate as object), rule_version: 1 });
  if (!parsed.success) return { ok: false, reason: `Invalid rule: ${parsed.error.issues[0]?.message}` };
  const { rule_version: _v, ...definition } = parsed.data;
  return { ok: true, definition: definition as CompiledRule };
}

/** True when two definitions are the same rule apart from the version number. */
export function sameRule(stored: object, compiled: CompiledRule): boolean {
  const strip = (o: object) => {
    const { rule_version: _v, ...rest } = o as Record<string, unknown>;
    return JSON.stringify(Object.keys(rest).sort().map((k) => [k, rest[k]]));
  };
  return strip(stored) === strip(compiled);
}
