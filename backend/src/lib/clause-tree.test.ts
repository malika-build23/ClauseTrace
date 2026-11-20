import assert from "node:assert/strict";
import { test } from "node:test";
import { buildClauseRows } from "./clause-tree.js";

const clause = (clause_number: string, parent: string | null, position: number) => ({
  clause_number,
  parent,
  position,
  page: 1,
  text: `text ${clause_number}`,
  level: 1,
});

test("resolves parent clause numbers to generated ids", () => {
  const rows = buildClauseRows("v1", [clause("1", null, 0), clause("1(a)", "1", 1), clause("1(a)(i)", "1(a)", 2)]);
  const byNumber = new Map(rows.map((r) => [r.clauseNumber, r]));
  assert.equal(byNumber.get("1")!.parentClauseId, null);
  assert.equal(byNumber.get("1(a)")!.parentClauseId, byNumber.get("1")!.id);
  assert.equal(byNumber.get("1(a)(i)")!.parentClauseId, byNumber.get("1(a)")!.id);
  assert.ok(rows.every((r) => r.documentVersionId === "v1"));
});

test("orders rows by position so parents come first", () => {
  const rows = buildClauseRows("v1", [clause("1(a)", "1", 1), clause("1", null, 0)]);
  assert.deepEqual(rows.map((r) => r.clauseNumber), ["1", "1(a)"]);
  assert.deepEqual(rows.map((r) => r.position), [0, 1]);
});

test("unknown parent becomes null instead of a dangling reference", () => {
  const [row] = buildClauseRows("v1", [clause("2.1", "2", 0)]);
  assert.equal(row.parentClauseId, null);
});

test("ids are unique", () => {
  const rows = buildClauseRows("v1", [clause("1", null, 0), clause("2", null, 1), clause("3", null, 2)]);
  assert.equal(new Set(rows.map((r) => r.id)).size, 3);
});
