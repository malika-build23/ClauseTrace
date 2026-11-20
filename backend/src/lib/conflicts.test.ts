import assert from "node:assert/strict";
import { test } from "node:test";
import { findConflictCandidates, type ConflictInput } from "./conflicts.js";

const ob = (id: string, over: Partial<ConflictInput> & { t?: unknown }): ConflictInput => ({
  id,
  obligationKey: `K-${id}`,
  documentId: "doc1",
  documentVersionId: "v1",
  clauseId: `clause-${id}`,
  clauseNumber: id,
  documentTitle: "Angel Funds",
  thresholdJson: over.t ?? { metric: "fee", operator: "==", value: 3000, unit: "USD" },
  ...over,
});

test("same metric, different limits in the same version is flagged with a readable reason", () => {
  const c = findConflictCandidates([ob("23", {}), ob("24", { t: { metric: "fee", operator: "==", value: 500, unit: "USD" } })]);
  assert.equal(c.length, 1);
  assert.equal(c[0].reason, 'Same metric "fee": clause 23 requires == 3,000 USD, clause 24 requires == 500 USD');
});

test("identical limits are not flagged", () => {
  assert.equal(findConflictCandidates([ob("1", {}), ob("2", {})]).length, 0);
});

test("different metrics are not compared", () => {
  assert.equal(findConflictCandidates([ob("1", {}), ob("2", { t: { metric: "corpus", operator: ">=", value: 1, unit: "USD" } })]).length, 0);
});

test("versions of the same document are amendments, not conflicts", () => {
  assert.equal(findConflictCandidates([ob("18", {}), ob("18b", { documentVersionId: "v2", t: { metric: "fee", operator: "==", value: 9, unit: "USD" } })]).length, 0);
});

test("across documents the reason names both documents", () => {
  const c = findConflictCandidates([ob("1", {}), ob("2", { documentId: "doc2", documentVersionId: "x1", documentTitle: "ESG circular", t: { metric: "FEE", operator: "<=", value: 100, unit: "usd" } })]);
  assert.equal(c.length, 1);
  assert.match(c[0].reason, /Angel Funds, clause 1 .* ESG circular, clause 2|ESG circular, clause 2 .* Angel Funds, clause 1/);
});

test("pairs are ordered by id so a re-scan finds the same pair", () => {
  const a = findConflictCandidates([ob("b", {}), ob("a", { t: { metric: "fee", operator: "==", value: 1, unit: "USD" } })]);
  assert.deepEqual([a[0].aId, a[0].bId], ["a", "b"]);
});

test("obligations without a threshold are ignored", () => {
  assert.equal(findConflictCandidates([ob("1", {}), ob("2", { t: null })]).length, 0);
});
