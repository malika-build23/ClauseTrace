/**
 * End-to-end check of review -> compile -> evaluate (Blocks F and G).
 * WRITES DATA: approves/edits/rejects obligations of one document and stores
 * evaluations. Run it against a development database only.
 *
 *   node --env-file=.env.seed.local scripts/check-review-rules.mjs <api-base-url> <document-id>
 */
const [BASE, DOC] = process.argv.slice(2);
if (!BASE || !DOC || !process.env.SEED_REVIEWER_PASSWORD) {
  console.error("usage: check-review-rules.mjs <api-base-url> <document-id>  (SEED_* passwords in env)");
  process.exit(2);
}

let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (wanted ${JSON.stringify(wanted)})`}`);
};
async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const login = async (email, password) =>
  (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json()).token;

const reviewer = await login("reviewer@clausetrace.demo", process.env.SEED_REVIEWER_PASSWORD);
const viewer = await login("viewer@clausetrace.demo", process.env.SEED_VIEWER_PASSWORD);

const { obligations } = (await call("GET", `/api/documents/${DOC}/obligations`, reviewer)).data;
const byClause = (n) => obligations.find((o) => o.clause.clauseNumber === n);
const corpus = byClause("18");
const investors = byClause("14");
const commitment = byClause("15");
const lockIn = byClause("17");
const leverage = byClause("21");
console.log(`document has ${obligations.length} obligations`);

// Review rules
expect("viewer cannot approve", (await call("PATCH", `/api/obligations/${corpus.id}/review`, viewer, { action: "approve" })).status, 403);
expect("reject needs a comment", (await call("PATCH", `/api/obligations/${leverage.id}/review`, reviewer, { action: "reject", comment: "" })).status, 400);
expect("approve corpus", (await call("PATCH", `/api/obligations/${corpus.id}/review`, reviewer, { action: "approve" })).data?.status, "approved");
expect("approve again is refused", (await call("PATCH", `/api/obligations/${corpus.id}/review`, reviewer, { action: "approve" })).status, 409);
// Reviewers standardise metric names so rules match the entity data fields.
expect("edit investors to the standard metric name", (await call("PATCH", `/api/obligations/${investors.id}/review`, reviewer, { action: "edit", edits: { threshold: { metric: "angel_investors", operator: "<=", value: 200, unit: "investors" } } })).data?.status, "edited");
expect("approve commitment", (await call("PATCH", `/api/obligations/${commitment.id}/review`, reviewer, { action: "approve" })).data?.status, "approved");
const lockEdit = await call("PATCH", `/api/obligations/${lockIn.id}/review`, reviewer, {
  action: "edit",
  edits: { threshold: { metric: "lock_in_period", operator: ">=", value: 1, unit: "years" } },
  comment: "Unit normalised to 'years'",
});
expect("edit lock-in creates version 2", [lockEdit.data?.status, lockEdit.data?.version], ["edited", 2]);
expect("old version cannot be reviewed any more", (await call("PATCH", `/api/obligations/${lockIn.id}/review`, reviewer, { action: "approve" })).status, 409);
expect("reject leverage (not checkable here)", (await call("PATCH", `/api/obligations/${leverage.id}/review`, reviewer, { action: "reject", comment: "Covered by a separate policy check" })).data?.status, "rejected");
expect("edit cannot make a non-checkable obligation machine-checkable without data", (await call("PATCH", `/api/obligations/${byClause("9").id}/review`, reviewer, { action: "edit", edits: { machineCheckable: true } })).status, 400);

// History
const history = (await call("GET", `/api/obligations/${lockEdit.data.id}`, reviewer)).data.history;
expect("history shows 2 versions", history.map((h) => [h.version, h.status]), [[2, "edited"], [1, "proposed"]]);
expect("edit review recorded on v1 with comment", history[1].reviews.map((r) => [r.action, r.comment]), [["edit", "Unit normalised to 'years'"]]);

// Compile
const first = (await call("POST", "/api/rules/compile", reviewer, {})).data;
expect("viewer cannot compile", (await call("POST", "/api/rules/compile", viewer, {})).status, 403);
expect("first compile creates 4 rules", first.summary.created, 4);
expect("rejected/proposed never compile", first.outcomes.every((o) => ["created", "unchanged", "new_version", "skipped"].includes(o.outcome)), true);
const second = (await call("POST", "/api/rules/compile", reviewer, {})).data;
expect("second compile changes nothing", [second.summary.created, second.summary.newVersion, second.summary.unchanged], [0, 0, 4]);

// New obligation version -> new rule version
const corpusEdit = await call("PATCH", `/api/obligations/${corpus.id}/review`, reviewer, {
  action: "edit",
  edits: { threshold: { metric: "corpus", operator: ">=", value: 1000000, unit: "USD" }, condition: "Reckoned collectively under all segregated portfolios" },
});
const third = (await call("POST", "/api/rules/compile", reviewer, {})).data;
expect("edited corpus obligation gives a new rule version", third.outcomes.find((o) => o.obligationKey === corpus.obligationKey)?.ruleVersion, 2);
const corpusHistory = (await call("GET", `/api/rules/history/R-${corpus.obligationKey}`, reviewer)).data;
expect("old rule version kept and inactive", corpusHistory.map((r) => [r.ruleVersion, r.isActive]), [[2, true], [1, false]]);
expect("edit response", corpusEdit.data?.version, 2);

// Evaluate all four profiles
const profiles = (await call("GET", "/api/entity-profiles", reviewer)).data;
const results = {};
for (const p of profiles) {
  const run = await call("POST", "/api/evaluations", reviewer, { profileId: p.id, evaluationDate: "2026-11-20" });
  results[p.name.split(" ")[0]] = run.data.evaluations.map((e) => e.result).sort();
}
console.log("results by profile:", JSON.stringify(results));
expect("Alpha all PASS", results.Alpha.every((r) => r === "PASS"), true);
expect("Beta all FAIL", results.Beta.every((r) => r === "FAIL"), true);
expect("Delta has INSUFFICIENT_DATA", results.Delta.includes("INSUFFICIENT_DATA"), true);
expect("viewer cannot run evaluations", (await call("POST", "/api/evaluations", viewer, { profileId: profiles[0].id })).status, 403);

// Stored evaluation carries everything needed to explain it
const latest = (await call("GET", `/api/evaluations?latest=true&profileId=${profiles.find((p) => p.name.startsWith("Beta")).id}`, viewer)).data;
const corpusResult = latest.find((e) => e.rule.ruleKey === `R-${corpus.obligationKey}`);
expect("result has rule version", corpusResult.ruleVersion, 2);
expect("result has inputs used", corpusResult.inputRef, { corpus: 800000, corpus_unit: "USD" });
expect("result has clause reference", [corpusResult.detailsJson.source.clause, corpusResult.detailsJson.source.page], ["18", corpusResult.detailsJson.source.page]);
expect("result explanation", corpusResult.detailsJson.explanation, "corpus = 800,000 USD; required >= 1,000,000 USD: not met.");
expect("result has timestamp and date", [Boolean(corpusResult.evaluatedAt), corpusResult.evaluationDate.slice(0, 10)], [true, "2026-11-20"]);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures ? 1 : 0;
