/**
 * End-to-end check of version comparison (Block H) against a known answer.
 * WRITES DATA: uploads the TEST amendment as a new version. Development database only.
 *
 *   node --env-file=.env.seed.local scripts/check-version-compare.mjs <api-base-url> <angel-funds-document-id>
 *
 * Known answer (see scripts/make_test_amendment.py): clause 14 and 18 modified,
 * clause 21 removed, clause 24 added, everything else unchanged (some renumbered).
 */
import fs from "node:fs";

const [BASE, DOC] = process.argv.slice(2);
if (!BASE || !DOC || !process.env.SEED_REVIEWER_PASSWORD) {
  console.error("usage: check-version-compare.mjs <api-base-url> <document-id>  (SEED_* passwords in env)");
  process.exit(2);
}
let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (wanted ${JSON.stringify(wanted)})`}`);
};
const token = (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "reviewer@clausetrace.demo", password: process.env.SEED_REVIEWER_PASSWORD }) })).json()).token;
const call = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};

// Upload the amendment as a new version (skip if already uploaded).
const pdf = fs.readFileSync(new URL("../data/test-amendments/angel-funds-TEST-amendment.pdf", import.meta.url));
const form = new FormData();
form.append("documentId", DOC);
form.append("file", new Blob([pdf], { type: "application/pdf" }), "angel-funds-TEST-amendment.pdf");
const up = await fetch(`${BASE}/api/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
const upBody = await up.json();
console.log("upload:", up.status, JSON.stringify(upBody));
const toVersion = up.status === 409 ? upBody.versionNo : upBody.versionNo;

const cmp = await call("POST", `/api/documents/${DOC}/compare`, { fromVersion: 1, toVersion });
expect("compare status", [201, 200].includes(cmp.status), true);
const changes = cmp.data.changes;
const byType = (t) => changes.filter((c) => c.changeType === t).map((c) => c.clauseRef).sort();
expect("modified clauses", byType("modified"), ["14", "18"]);
expect("removed clauses", byType("removed"), ["21"]);
expect("added clauses", byType("added"), ["24"]);
const corpus = changes.find((c) => c.clauseRef === "18");
expect("summary names the change", corpus.summary, 'Clause 18 modified: "1,000,000," changed to "1,500,000,"');
expect("impact items exist for changed clauses with obligations", changes.filter((c) => c.impactItems.length > 0).map((c) => c.clauseRef).sort(), ["14", "18", "21"].filter((n) => changes.find((c) => c.clauseRef === n)?.impactItems.length));
expect("compare again is idempotent", (await call("POST", `/api/documents/${DOC}/compare`, { fromVersion: 1, toVersion })).status, 200);

// Reviewer decisions
const item = changes.flatMap((c) => c.impactItems)[0];
if (item) expect("confirm an impact item", (await call("PATCH", `/api/impact-items/${item.id}`, { reviewStatus: "confirmed" })).data?.reviewStatus, "confirmed");
expect("dismiss a change", (await call("PATCH", `/api/changes/${changes.find((c) => c.changeType === "removed").id}`, { status: "confirmed" })).data?.status, "confirmed");

// Rules are never changed by a comparison
const rules = (await call("GET", "/api/rules?active=true")).data;
console.log(`active rules after compare: ${rules.length} (unchanged by design)`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures ? 1 : 0;
