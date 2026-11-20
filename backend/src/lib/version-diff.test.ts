import assert from "node:assert/strict";
import { test } from "node:test";
import { alignClauses, describe, similarity, wordDiff, type Alignment } from "./version-diff.js";

const c = (clauseNumber: string, text: string) => ({ clauseNumber, text });
const types = (a: Alignment[]) =>
  a
    .map((x) => `${x.type}:${"old" in x ? x.old.clauseNumber : "-"}>${"new" in x ? x.new.clauseNumber : "-"}`)
    .sort();

const v1 = [
  c("1", "This circular applies to angel schemes launched by FMEs."),
  c("2", "An angel scheme shall have a corpus of at least USD 1,000,000."),
  c("3", "Angel schemes shall not undertake leverage."),
  c("4", "The FME shall pay a fee of USD 3,000 at the time of filing."),
];

test("identical versions are all unchanged", () => {
  assert.deepEqual(types(alignClauses(v1, v1)), ["unchanged:1>1", "unchanged:2>2", "unchanged:3>3", "unchanged:4>4"]);
});

test("a changed number is a modification of the same clause", () => {
  const v2 = [...v1];
  v2[1] = c("2", "An angel scheme shall have a corpus of at least USD 1,500,000.");
  const a = alignClauses(v1, v2);
  assert.deepEqual(types(a), ["modified:2>2", "unchanged:1>1", "unchanged:3>3", "unchanged:4>4"]);
  const mod = a.find((x) => x.type === "modified")!;
  assert.equal(describe(mod), 'Clause 2 modified: "1,000,000." changed to "1,500,000."');
});

test("removed and added clauses", () => {
  const v2 = [v1[0], v1[1], v1[3], c("5", "The FME shall submit an annual compliance report by March 31, 2027.")];
  assert.deepEqual(types(alignClauses(v1, v2)), ["added:->5", "removed:3>-", "unchanged:1>1", "unchanged:2>2", "unchanged:4>4"]);
});

test("inserting a clause does not mark renumbered clauses as modified", () => {
  const v2 = [v1[0], c("2", "Each angel investor shall be an accredited investor."), { ...v1[1], clauseNumber: "3" }, { ...v1[2], clauseNumber: "4" }, { ...v1[3], clauseNumber: "5" }];
  const a = alignClauses(v1, v2);
  assert.deepEqual(types(a), ["added:->2", "unchanged:1>1", "unchanged:2>3", "unchanged:3>4", "unchanged:4>5"]);
  assert.equal(a.filter((x) => x.type === "unchanged" && x.renumbered).length, 3);
});

test("a moved and edited clause is matched by similarity", () => {
  const v2 = [v1[0], v1[2], v1[3], c("9", "An angel scheme shall have a corpus of at least USD 2,000,000.")];
  const a = alignClauses(v1, v2);
  const moved = a.find((x) => x.type === "modified");
  assert.ok(moved && moved.type === "modified" && moved.renumbered);
  assert.equal(moved.old.clauseNumber, "2");
  assert.equal(moved.new.clauseNumber, "9");
});

test("same number but unrelated text is removed + added, not modified", () => {
  const v2 = [v1[0], c("2", "Definitions in the FM Regulations apply to this circular."), v1[2], v1[3]];
  assert.deepEqual(types(alignClauses(v1, v2)), ["added:->2", "removed:2>-", "unchanged:1>1", "unchanged:3>3", "unchanged:4>4"]);
});

test("whitespace, case and quote style do not count as changes", () => {
  const v2 = [c("1", "This  circular applies to ANGEL schemes launched by FMEs."), v1[1], v1[2], v1[3]];
  assert.equal(alignClauses(v1, v2).every((x) => x.type === "unchanged"), true);
});

test("every clause appears exactly once", () => {
  const v2 = [v1[3], c("7", "Something new entirely."), v1[0]];
  const a = alignClauses(v1, v2);
  const olds = a.flatMap((x) => ("old" in x ? [x.old.clauseNumber] : []));
  const news = a.flatMap((x) => ("new" in x ? [x.new.clauseNumber] : []));
  assert.deepEqual(olds.sort(), ["1", "2", "3", "4"]);
  assert.deepEqual(news.sort(), ["1", "4", "7"]);
});

test("similarity bounds", () => {
  assert.equal(similarity("a b c", "a b c"), 1);
  assert.equal(similarity("a b c", "x y z"), 0);
  assert.ok(similarity(v1[1].text, v1[1].text.replace("1,000,000", "1,500,000")) > 0.8);
});

test("word diff marks only the changed words", () => {
  const d = wordDiff("shall not exceed 200 investors", "shall not exceed 250 investors");
  assert.deepEqual(d, [
    { op: "equal", text: "shall not exceed" },
    { op: "delete", text: "200" },
    { op: "insert", text: "250" },
    { op: "equal", text: "investors" },
  ]);
});

test("curly and straight apostrophes are the same word", () => {
  const a = alignClauses([c("1", "The FME\u2019s report \u2013 annual")], [c("1", "The FME's report - annual")]);
  assert.equal(a[0].type, "unchanged");
  assert.deepEqual(wordDiff("the FME\u2019s report", "the FME's report"), [{ op: "equal", text: "the FME's report" }]);
});

test("a hyphen inside a word is not a change", () => {
  const a = alignClauses([c("1", "investment in an earlystage venture")], [c("1", "investment in an early-stage venture")]);
  assert.equal(a[0].type, "unchanged");
});
