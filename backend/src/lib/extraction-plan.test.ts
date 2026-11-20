import assert from "node:assert/strict";
import { test } from "node:test";
import { ExtractedObligation } from "../schemas/obligation.js";
import { cacheKey, hasObligationWording, makeBatches, obligationKey, toObligationRow } from "./extraction-plan.js";

test("obligation wording filter", () => {
  assert.equal(hasObligationWording("An angel scheme shall have a corpus of at least USD 1,000,000."), true);
  assert.equal(hasObligationWording("The FME should transparently disclose the objectives."), true);
  assert.equal(hasObligationWording("“angel investor” means an investor including a scheme."), false);
  assert.equal(hasObligationWording("Name of the scheme"), false); // heading, too short
});

test("batches respect clause count and character limits", () => {
  const clauses = Array.from({ length: 30 }, (_, i) => ({ text: "x".repeat(i === 5 ? 9000 : 100) }));
  const batches = makeBatches(clauses, 12, 10_000);
  assert.ok(batches.every((b) => b.length <= 12));
  assert.ok(batches.every((b) => b.reduce((n, c) => n + c.text.length, 0) <= 10_000 || b.length === 1));
  assert.equal(batches.flat().length, 30);
});

test("an oversized clause still gets its own batch", () => {
  const batches = makeBatches([{ text: "a".repeat(50) }, { text: "b".repeat(500) }, { text: "c" }], 12, 100);
  assert.deepEqual(batches.map((b) => b.length), [1, 1, 1]);
});

test("cache key depends on prompt version and text", () => {
  assert.equal(cacheKey("v1", "text"), cacheKey("v1", "text"));
  assert.notEqual(cacheKey("v1", "text"), cacheKey("v2", "text"));
  assert.notEqual(cacheKey("v1", "text"), cacheKey("v1", "text."));
});

test("obligation key format", () => {
  assert.equal(obligationKey("73834e7f-b730-47f4", "2(B)(I)", 1), "D73834E-c2(B)(I)-01");
});

test("AI obligation maps to a proposed row with source quote and run link", () => {
  const ob = ExtractedObligation.parse({
    obligation_id: "18-01",
    source: { document: "Angel", document_version: 1, date: null, clause: "18", page: 4, quote: "shall have a corpus of at least USD 1,000,000" },
    subject: "Angel scheme",
    modality: "must",
    action: "maintain a minimum corpus",
    condition: null,
    threshold: { metric: "corpus", operator: ">=", value: 1000000, unit: "USD" },
    deadline: "2026-03-31",
    evidence: null,
    ambiguity_flag: false,
    ambiguity_reason: null,
    machine_checkable: true,
    confidence: 0.9,
  });
  const row = toObligationRow(ob, { documentId: "57a1b42e-xx", clauseId: "c1", clauseNumber: "18", index: 1, runId: "r1" });
  assert.equal(row.obligationKey, "D57A1B4-c18-01");
  assert.equal(row.status, "proposed");
  assert.equal(row.quote, "shall have a corpus of at least USD 1,000,000");
  assert.equal(row.extractionRunId, "r1");
  assert.equal((row.deadline as Date).toISOString(), "2026-03-31T00:00:00.000Z");
});
