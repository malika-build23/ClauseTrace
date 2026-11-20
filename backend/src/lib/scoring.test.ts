import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RISK_WEIGHTS, reviewPriority, riskScore } from "./scoring.js";

const plain = { ambiguityFlag: false, ambiguityReason: null, machineCheckable: false, confidence: 0.95, condition: null, deadline: null };

test("priority: plain obligation is low", () => {
  assert.deepEqual(reviewPriority(plain), { level: "low", reasons: ["Plain obligation, no flags"] });
});

test("priority: ambiguity, executable rules and low confidence are high, with reasons", () => {
  const p = reviewPriority({ ...plain, ambiguityFlag: true, ambiguityReason: "adequate", machineCheckable: true });
  assert.equal(p.level, "high");
  assert.deepEqual(p.reasons.slice(0, 2), ["Ambiguous: adequate", "Becomes an executable rule if approved, so a wrong value would change results"]);
  assert.equal(reviewPriority({ ...plain, confidence: 0.5 }).level, "high");
});

test("priority: conditions, deadlines and moderate confidence are medium", () => {
  assert.equal(reviewPriority({ ...plain, condition: "for retail schemes" }).level, "medium");
  assert.equal(reviewPriority({ ...plain, deadline: "2027-03-31" }).level, "medium");
  assert.equal(reviewPriority({ ...plain, confidence: 0.8 }).level, "medium");
  assert.equal(reviewPriority({ ...plain, confidence: null }).level, "medium");
});

test("risk: pass with nothing pending is low and says why", () => {
  assert.deepEqual(riskScore({ result: "PASS", ruleType: "threshold", daysToDue: null, upcomingWindowDays: null, pendingChange: false }), {
    score: 0,
    level: "low",
    reasons: ["No risk factors"],
  });
});

test("risk: a failing check is high", () => {
  const r = riskScore({ result: "FAIL", ruleType: "threshold", daysToDue: null, upcomingWindowDays: null, pendingChange: false });
  assert.deepEqual([r.score, r.level], [6, "high"]);
  assert.deepEqual(r.reasons, ["Check fails (+6)"]);
});

test("risk: an overdue deadline outranks a plain failure", () => {
  const overdue = riskScore({ result: "FAIL", ruleType: "deadline", daysToDue: -3, upcomingWindowDays: 30, pendingChange: false });
  assert.equal(overdue.score, 8);
  assert.match(overdue.reasons[0], /missed 3 day/);
});

test("risk: upcoming deadlines grow closer to the due date", () => {
  const far = riskScore({ result: "UPCOMING_DEADLINE", ruleType: "deadline", daysToDue: 29, upcomingWindowDays: 30, pendingChange: false });
  const near = riskScore({ result: "UPCOMING_DEADLINE", ruleType: "deadline", daysToDue: 2, upcomingWindowDays: 30, pendingChange: false });
  assert.ok(near.score > far.score);
  assert.equal(far.level, "medium");
  assert.equal(near.level, "medium"); // 3 + 2.8 = 5.8
});

test("risk: unreviewed source changes add to any result", () => {
  const r = riskScore({ result: "INSUFFICIENT_DATA", ruleType: "threshold", daysToDue: null, upcomingWindowDays: null, pendingChange: true });
  assert.deepEqual([r.score, r.level], [6, "high"]);
  assert.equal(r.reasons.length, 2);
});

test("risk: weights are configurable", () => {
  const r = riskScore({ result: "FAIL", ruleType: "threshold", daysToDue: null, upcomingWindowDays: null, pendingChange: false }, { ...DEFAULT_RISK_WEIGHTS, fail: 1 });
  assert.equal(r.level, "low");
});
