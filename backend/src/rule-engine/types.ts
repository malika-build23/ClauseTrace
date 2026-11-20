import { z } from "zod";

/**
 * Rule definitions. Stored as JSON in `rules.definition_json` and never
 * edited: a change creates a new rule_version.
 */

export const Operator = z.enum([">=", ">", "<=", "<", "==", "!="]);
export type Operator = z.infer<typeof Operator>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const Base = z.object({
  rule_id: z.string().min(1), // stable across versions, e.g. "R-D57A1B4-c18-01"
  rule_version: z.number().int().positive(),
  obligation_id: z.string().min(1), // obligation key the rule was compiled from
  applies_to: z.array(z.string().min(1)), // entity category names; empty = all categories
});

export const ThresholdRule = Base.extend({
  type: z.literal("threshold"),
  input_field: z.string().min(1),
  operator: Operator,
  value: z.number().finite(),
  unit: z.string().min(1).nullable(), // null = unitless (counts); otherwise the profile must state the same unit
});

export const DeadlineRule = Base.extend({
  type: z.literal("deadline"),
  input_field: z.string().min(1), // date the action was completed; null in the profile = not done yet
  due_date: isoDate,
  upcoming_window_days: z.number().int().min(0).max(365),
});

export const RequiredFieldRule = Base.extend({
  type: z.literal("required_field"),
  input_field: z.string().min(1), // must be present and truthy (true, non-empty text, a number)
});

export const RuleDefinition = z.discriminatedUnion("type", [ThresholdRule, DeadlineRule, RequiredFieldRule]);
export type RuleDefinition = z.infer<typeof RuleDefinition>;
export type ThresholdRule = z.infer<typeof ThresholdRule>;
export type DeadlineRule = z.infer<typeof DeadlineRule>;
export type RequiredFieldRule = z.infer<typeof RequiredFieldRule>;

export type EvaluationResult = "PASS" | "FAIL" | "UPCOMING_DEADLINE" | "INSUFFICIENT_DATA";

/** Entity data: flat key/value pairs, e.g. { corpus: 1500000, corpus_unit: "USD" }. */
export type ProfileData = Record<string, unknown>;

export type Evaluation = {
  result: EvaluationResult;
  rule_id: string;
  rule_version: number;
  evaluation_date: string; // YYYY-MM-DD, always passed in, never "today"
  inputs_used: Record<string, unknown>; // exactly the profile values the result depends on
  explanation: string;
};
