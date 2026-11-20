import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate } from "./evaluate.js";
import type { DeadlineRule, RequiredFieldRule, ThresholdRule } from "./types.js";

const corpusRule: ThresholdRule = {
  rule_id: "R-1",
  rule_version: 1,
  obligation_id: "OB-1",
  applies_to: ["Fund Management Entity"],
  type: "threshold",
  input_field: "corpus",
  operator: ">=",
  value: 1_000_000,
  unit: "USD",
};
const DATE = "2026-11-20";

// ── threshold ─────────────────────────────────────────────────────────────

test("threshold: below the minimum fails", () => {
  const r = evaluate(corpusRule, { corpus: 999_999, corpus_unit: "USD" }, DATE);
  assert.equal(r.result, "FAIL");
  assert.match(r.explanation, /999,999/);
});

test("threshold: exactly the minimum passes", () => {
  assert.equal(evaluate(corpusRule, { corpus: 1_000_000, corpus_unit: "USD" }, DATE).result, "PASS");
});

test("threshold: above the minimum passes", () => {
  assert.equal(evaluate(corpusRule, { corpus: 1_500_000, corpus_unit: "USD" }, DATE).result, "PASS");
});

test("threshold: every operator", () => {
  const cases: [ThresholdRule["operator"], number, string][] = [
    ["<=", 200, "PASS"], ["<=", 201, "FAIL"],
    ["<", 199, "PASS"], ["<", 200, "FAIL"],
    [">", 201, "PASS"], [">", 200, "FAIL"],
    ["==", 200, "PASS"], ["==", 201, "FAIL"],
    ["!=", 201, "PASS"], ["!=", 200, "FAIL"],
  ];
  for (const [operator, value, expected] of cases) {
    const rule: ThresholdRule = { ...corpusRule, operator, value: 200, unit: null, input_field: "investors" };
    assert.equal(evaluate(rule, { investors: value }, DATE).result, expected, `${value} ${operator} 200`);
  }
});

test("threshold: missing field is insufficient data, never a silent pass or fail", () => {
  const r = evaluate(corpusRule, { corpus_unit: "USD" }, DATE);
  assert.equal(r.result, "INSUFFICIENT_DATA");
  assert.match(r.explanation, /corpus/);
});

test("threshold: null or non-numeric value is insufficient data", () => {
  assert.equal(evaluate(corpusRule, { corpus: null, corpus_unit: "USD" }, DATE).result, "INSUFFICIENT_DATA");
  assert.equal(evaluate(corpusRule, { corpus: "lots", corpus_unit: "USD" }, DATE).result, "INSUFFICIENT_DATA");
  assert.equal(evaluate(corpusRule, { corpus: Number.NaN, corpus_unit: "USD" }, DATE).result, "INSUFFICIENT_DATA");
});

test("threshold: numeric strings are accepted", () => {
  assert.equal(evaluate(corpusRule, { corpus: "1,200,000", corpus_unit: "USD" }, DATE).result, "PASS");
});

test("threshold: wrong unit is insufficient data with an explanation", () => {
  const r = evaluate(corpusRule, { corpus: 90_000_000, corpus_unit: "INR" }, DATE);
  assert.equal(r.result, "INSUFFICIENT_DATA");
  assert.match(r.explanation, /unit/i);
  assert.match(r.explanation, /INR/);
});

test("threshold: missing unit when the rule has one is insufficient data", () => {
  assert.equal(evaluate(corpusRule, { corpus: 2_000_000 }, DATE).result, "INSUFFICIENT_DATA");
});

test("threshold: unit comparison ignores case and common aliases", () => {
  assert.equal(evaluate(corpusRule, { corpus: 2_000_000, corpus_unit: "usd" }, DATE).result, "PASS");
  const pct: ThresholdRule = { ...corpusRule, input_field: "share", value: 2.5, unit: "%" };
  assert.equal(evaluate(pct, { share: 3, share_unit: "percent" }, DATE).result, "PASS");
});

test("threshold: unitless rule ignores any unit in the profile", () => {
  const rule: ThresholdRule = { ...corpusRule, input_field: "investors", operator: "<=", value: 200, unit: null };
  assert.equal(evaluate(rule, { investors: 150 }, DATE).result, "PASS");
});

test("threshold: inputs_used records exactly what the result depends on", () => {
  const r = evaluate(corpusRule, { corpus: 1_500_000, corpus_unit: "USD", unrelated: "x" }, DATE);
  assert.deepEqual(r.inputs_used, { corpus: 1_500_000, corpus_unit: "USD" });
  assert.equal(r.rule_id, "R-1");
  assert.equal(r.rule_version, 1);
  assert.equal(r.evaluation_date, DATE);
});

// ── deadline ──────────────────────────────────────────────────────────────

const filingRule: DeadlineRule = {
  rule_id: "R-2",
  rule_version: 1,
  obligation_id: "OB-2",
  applies_to: [],
  type: "deadline",
  input_field: "annual_report_filed_on",
  due_date: "2026-12-31",
  upcoming_window_days: 30,
};

test("deadline: completed on or before the due date passes", () => {
  assert.equal(evaluate(filingRule, { annual_report_filed_on: "2026-12-31" }, "2027-01-15").result, "PASS");
  assert.equal(evaluate(filingRule, { annual_report_filed_on: "2026-10-01" }, "2027-01-15").result, "PASS");
});

test("deadline: completed after the due date fails", () => {
  const r = evaluate(filingRule, { annual_report_filed_on: "2027-01-02" }, "2027-01-15");
  assert.equal(r.result, "FAIL");
  assert.match(r.explanation, /after/);
});

test("deadline: not done and past due fails", () => {
  assert.equal(evaluate(filingRule, { annual_report_filed_on: null }, "2027-01-01").result, "FAIL");
});

test("deadline: not done, due date is today, counts as upcoming", () => {
  assert.equal(evaluate(filingRule, { annual_report_filed_on: null }, "2026-12-31").result, "UPCOMING_DEADLINE");
});

test("deadline: not done, inside the upcoming window", () => {
  const r = evaluate(filingRule, { annual_report_filed_on: null }, "2026-12-01");
  assert.equal(r.result, "UPCOMING_DEADLINE");
  assert.match(r.explanation, /30 days/);
});

test("deadline: not done, window boundary is inclusive", () => {
  assert.equal(evaluate(filingRule, { annual_report_filed_on: null }, "2026-12-01").result, "UPCOMING_DEADLINE"); // 30 days
  assert.equal(evaluate(filingRule, { annual_report_filed_on: null }, "2026-11-30").result, "PASS"); // 31 days
});

test("deadline: not done and not yet due outside the window passes", () => {
  const r = evaluate(filingRule, { annual_report_filed_on: null }, DATE);
  assert.equal(r.result, "PASS");
  assert.match(r.explanation, /not yet due/i);
});

test("deadline: field absent means unknown, not 'not done'", () => {
  assert.equal(evaluate(filingRule, {}, "2027-01-15").result, "INSUFFICIENT_DATA");
});

test("deadline: invalid completion date is insufficient data", () => {
  assert.equal(evaluate(filingRule, { annual_report_filed_on: "31/12/2026" }, DATE).result, "INSUFFICIENT_DATA");
  assert.equal(evaluate(filingRule, { annual_report_filed_on: "2026-02-30" }, DATE).result, "INSUFFICIENT_DATA");
});

test("deadline: a different window changes the result", () => {
  const wide: DeadlineRule = { ...filingRule, upcoming_window_days: 60 };
  assert.equal(evaluate(wide, { annual_report_filed_on: null }, DATE).result, "UPCOMING_DEADLINE");
});

// ── required_field ────────────────────────────────────────────────────────

const officerRule: RequiredFieldRule = {
  rule_id: "R-3",
  rule_version: 1,
  obligation_id: "OB-3",
  applies_to: [],
  type: "required_field",
  input_field: "compliance_officer_appointed",
};

test("required_field: present and truthy passes", () => {
  assert.equal(evaluate(officerRule, { compliance_officer_appointed: true }, DATE).result, "PASS");
  assert.equal(evaluate(officerRule, { compliance_officer_appointed: "Jane Doe (fictional)" }, DATE).result, "PASS");
  assert.equal(evaluate(officerRule, { compliance_officer_appointed: 0 }, DATE).result, "PASS"); // a number is a value
});

test("required_field: false, null or empty fails", () => {
  assert.equal(evaluate(officerRule, { compliance_officer_appointed: false }, DATE).result, "FAIL");
  assert.equal(evaluate(officerRule, { compliance_officer_appointed: null }, DATE).result, "FAIL");
  assert.equal(evaluate(officerRule, { compliance_officer_appointed: "  " }, DATE).result, "FAIL");
});

test("required_field: absent is insufficient data", () => {
  assert.equal(evaluate(officerRule, {}, DATE).result, "INSUFFICIENT_DATA");
});

// ── versions and determinism ──────────────────────────────────────────────

test("different rule versions give results tagged with their own version", () => {
  const v2: ThresholdRule = { ...corpusRule, rule_version: 2, value: 2_000_000 };
  const data = { corpus: 1_500_000, corpus_unit: "USD" };
  const r1 = evaluate(corpusRule, data, DATE);
  const r2 = evaluate(v2, data, DATE);
  assert.deepEqual([r1.result, r1.rule_version], ["PASS", 1]);
  assert.deepEqual([r2.result, r2.rule_version], ["FAIL", 2]);
});

test("100 repeated evaluations produce identical results", () => {
  const rules = [corpusRule, filingRule, officerRule];
  const data = { corpus: 1_000_000, corpus_unit: "USD", annual_report_filed_on: null, compliance_officer_appointed: true };
  for (const rule of rules) {
    const first = JSON.stringify(evaluate(rule, data, "2026-12-15"));
    for (let i = 0; i < 100; i++) {
      assert.equal(JSON.stringify(evaluate(rule, data, "2026-12-15")), first);
    }
  }
});

test("evaluation does not modify the profile data", () => {
  const data = Object.freeze({ corpus: 1_500_000, corpus_unit: "USD" });
  assert.doesNotThrow(() => evaluate(corpusRule, data, DATE));
});

test("an invalid evaluation date is rejected", () => {
  assert.throws(() => evaluate(corpusRule, { corpus: 1, corpus_unit: "USD" }, "today"));
});
