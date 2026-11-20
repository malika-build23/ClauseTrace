import assert from "node:assert/strict";
import { test } from "node:test";
import { compileObligation, sameRule, slug, type CompilableObligation } from "./compile.js";

const base: CompilableObligation = {
  obligationKey: "D57A1B4-c18-01",
  status: "approved",
  machineCheckable: true,
  referenceOnly: false,
  action: "have a corpus of at least USD 1,000,000",
  evidence: null,
  thresholdJson: { metric: "corpus", operator: ">=", value: 1000000, unit: "USD" },
  deadline: null,
  categories: ["Fund Management Entity"],
};

test("approved threshold obligation compiles to a threshold rule", () => {
  const r = compileObligation(base);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.definition, {
    rule_id: "R-D57A1B4-c18-01",
    obligation_id: "D57A1B4-c18-01",
    applies_to: ["Fund Management Entity"],
    type: "threshold",
    input_field: "corpus",
    operator: ">=",
    value: 1000000,
    unit: "USD",
  });
});

test("edited (approved with changes) obligations compile too", () => {
  assert.equal(compileObligation({ ...base, status: "edited" }).ok, true);
});

test("proposed or rejected obligations never compile", () => {
  for (const status of ["proposed", "rejected"] as const) {
    const r = compileObligation({ ...base, status });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /approved/);
  }
});

test("reference-only and non machine-checkable obligations never compile", () => {
  assert.equal(compileObligation({ ...base, referenceOnly: true }).ok, false);
  assert.equal(compileObligation({ ...base, machineCheckable: false }).ok, false);
});

test("deadline obligation compiles with a derived completion field and default window", () => {
  const r = compileObligation({ ...base, thresholdJson: null, deadline: "2026-12-31", action: "File the annual report" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.definition.type, "deadline");
  if (r.definition.type !== "deadline") return;
  assert.equal(r.definition.due_date, "2026-12-31");
  assert.equal(r.definition.input_field, "file_the_annual_report_completed_on");
  assert.equal(r.definition.upcoming_window_days, 30);
});

test("deadline accepts a Date and an explicit field and window", () => {
  const r = compileObligation(
    { ...base, thresholdJson: null, deadline: new Date("2026-12-31T00:00:00Z") },
    { inputField: "report_filed_on", upcomingWindowDays: 45 },
  );
  assert.equal(r.ok && r.definition.type === "deadline" && r.definition.input_field, "report_filed_on");
  assert.equal(r.ok && r.definition.type === "deadline" && r.definition.upcoming_window_days, 45);
});

test("required_field needs an explicit request and an input field", () => {
  const ob = { ...base, thresholdJson: null, evidence: "Board resolution appointing a compliance officer" };
  assert.equal(compileObligation(ob).ok, false); // nothing checkable without a request
  const r = compileObligation(ob, { type: "required_field" });
  assert.equal(r.ok && r.definition.type, "required_field");
  assert.equal(r.ok && r.definition.input_field, "board_resolution_appointing_a_compliance_officer");
  const custom = compileObligation(ob, { type: "required_field", inputField: "compliance_officer_appointed" });
  assert.equal(custom.ok && custom.definition.input_field, "compliance_officer_appointed");
});

test("malformed thresholds are rejected, not guessed", () => {
  const bad = [
    { metric: "corpus", operator: "about", value: 1, unit: "USD" },
    { metric: "corpus", operator: ">=", value: "a lot", unit: "USD" },
    { metric: "", operator: ">=", value: 1, unit: "USD" },
    "not an object",
  ];
  for (const thresholdJson of bad) {
    const r = compileObligation({ ...base, thresholdJson });
    assert.equal(r.ok, false, JSON.stringify(thresholdJson));
  }
});

test("no categories means the rule applies to all", () => {
  const r = compileObligation({ ...base, categories: [] });
  assert.deepEqual(r.ok && r.definition.applies_to, []);
});

test("sameRule ignores the version number and key order", () => {
  const r = compileObligation(base);
  assert.ok(r.ok);
  if (!r.ok) return;
  const stored = { ...r.definition, rule_version: 3 };
  const reordered = Object.fromEntries(Object.entries(r.definition).reverse());
  assert.equal(sameRule(stored, reordered as typeof r.definition), true);
  assert.equal(sameRule(stored, { ...r.definition, value: 2 } as typeof r.definition), false);
});

test("slug makes safe field names", () => {
  assert.equal(slug("File the Annual Report (Form A)!"), "file_the_annual_report_form_a");
  assert.equal(slug("x".repeat(100)).length, 60);
});
