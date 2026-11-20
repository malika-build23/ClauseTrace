import assert from "node:assert/strict";
import { test } from "node:test";
import { ExtractedObligation } from "./obligation.js";

const valid = {
  obligation_id: "FME-EXAMPLE-c4.2-01",
  source: { document: "Example", document_version: 1, date: "2025-01-15", clause: "4.2", page: 3, quote: "Exact source text" },
  subject: "Example regulated entity",
  modality: "must",
  action: "maintain a required measure",
  condition: null,
  threshold: { metric: "example_metric", operator: ">=", value: 1000000, unit: "USD" },
  deadline: null,
  evidence: null,
  ambiguity_flag: false,
  ambiguity_reason: null,
  machine_checkable: true,
  confidence: 0.82,
};

test("valid obligation parses with defaults", () => {
  const ob = ExtractedObligation.parse(valid);
  assert.equal(ob.status, "proposed");
  assert.equal(ob.version, 1);
});

test("rejects unknown modality", () => {
  assert.equal(ExtractedObligation.safeParse({ ...valid, modality: "shall" }).success, false);
});

test("ambiguity flag requires a reason", () => {
  assert.equal(ExtractedObligation.safeParse({ ...valid, ambiguity_flag: true }).success, false);
});

test("machine_checkable requires threshold or deadline", () => {
  assert.equal(ExtractedObligation.safeParse({ ...valid, threshold: null }).success, false);
});

test("confidence must be within 0..1", () => {
  assert.equal(ExtractedObligation.safeParse({ ...valid, confidence: 1.5 }).success, false);
});
