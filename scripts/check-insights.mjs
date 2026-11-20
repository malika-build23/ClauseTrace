/**
 * End-to-end check of audit (I), priority/risk/graph (J) and conflicts (K).
 * WRITES DATA (risk weights, conflict flags): development database only.
 * Run after check-review-rules.mjs so rules and results exist.
 *
 *   node --env-file=.env.seed.local scripts/check-insights.mjs <api-base-url>
 */
const [BASE] = process.argv.slice(2);
if (!BASE || !process.env.SEED_ADMIN_PASSWORD) {
  console.error("usage: check-insights.mjs <api-base-url>  (SEED_* passwords in env)");
  process.exit(2);
}
let failures = 0;
const expect = (label, actual, wanted) => {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (wanted ${JSON.stringify(wanted)})`}`);
};
const login = async (email, password) =>
  (await (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json()).token;
const admin = await login("admin@clausetrace.demo", process.env.SEED_ADMIN_PASSWORD);
const reviewer = await login("reviewer@clausetrace.demo", process.env.SEED_REVIEWER_PASSWORD);
const viewer = await login("viewer@clausetrace.demo", process.env.SEED_VIEWER_PASSWORD);
const call = async (token, method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};

// I: audit
expect("viewer cannot read the audit log", (await call(viewer, "GET", "/api/audit")).status, 403);
const audit = (await call(reviewer, "GET", "/api/audit?eventType=obligation.&limit=5")).data;
expect("audit filter by event prefix", audit.entries.every((e) => e.eventType.startsWith("obligation.")), true);
expect("audit pages", typeof audit.nextBefore === "string" || audit.nextBefore === null, true);
const facets = (await call(reviewer, "GET", "/api/audit/facets")).data;
expect("audit facets include evaluation.run", facets.eventTypes.includes("evaluation.run"), true);
expect("there is no way to delete audit entries", (await call(admin, "DELETE", `/api/audit/${audit.entries[0].id}`)).status === 404, true);

// J: priority
const queue = (await call(reviewer, "GET", "/api/obligations?status=proposed&limit=500")).data;
const order = { high: 0, medium: 1, low: 2 };
expect("every obligation has a priority with reasons", queue.every((o) => o.reviewPriority && o.priorityReasons.length > 0), true);
expect("queue is sorted high -> low", queue.every((o, i) => i === 0 || order[queue[i - 1].reviewPriority] <= order[o.reviewPriority]), true);

// J: risk
const dash = (await call(viewer, "GET", "/api/dashboard/summary")).data;
expect("attention items carry risk with reasons", dash.attention.every((a) => a.risk && a.risk.reasons.length > 0), true);
expect("attention sorted by risk", dash.attention.every((a, i) => i === 0 || dash.attention[i - 1].risk.score >= a.risk.score), true);
expect("reviewer cannot change risk weights", (await call(reviewer, "PUT", "/api/risk-config", { weights: dash.riskWeights })).status, 403);
expect("invalid weights rejected", (await call(admin, "PUT", "/api/risk-config", { weights: { ...dash.riskWeights, mediumThreshold: 99, highThreshold: 1 } })).status, 400);
expect("admin saves weights", (await call(admin, "PUT", "/api/risk-config", { weights: { ...dash.riskWeights, fail: 7 } })).data?.weights?.fail, 7);
expect("dashboard uses saved weights", (await call(viewer, "GET", "/api/dashboard/summary")).data.riskWeights.fail, 7);
await call(admin, "PUT", "/api/risk-config", { weights: dash.riskWeights });

// J: graph
const rule = (await call(viewer, "GET", "/api/rules?active=true")).data[0];
const graph = (await call(viewer, "GET", `/api/graph/obligation/${rule.obligation.id}`)).data;
const kinds = [...new Set(graph.nodes.map((n) => n.kind))].sort();
expect("graph spans regulator to results", ["clause", "document", "obligation", "regulator", "result", "rule", "version"].every((k) => kinds.includes(k)), true);
expect("graph impact counts", graph.impact.rules >= 1 && graph.impact.entities >= 1, true);
expect("every edge points at a node", graph.edges.every((e) => graph.nodes.some((n) => n.id === e.from) && graph.nodes.some((n) => n.id === e.to)), true);

// K: conflicts
expect("viewer cannot scan", (await call(viewer, "POST", "/api/conflicts/scan", {})).status, 403);
const scan = (await call(reviewer, "POST", "/api/conflicts/scan", {})).data;
const flags = (await call(viewer, "GET", "/api/conflicts")).data;
const fee = flags.find((f) => f.reason.includes('"fee"'));
expect("the two fee obligations are flagged", Boolean(fee), true);
expect("re-scan adds nothing new", (await call(reviewer, "POST", "/api/conflicts/scan", {})).data.newFlags, 0);
expect("reviewer marks it not a conflict", (await call(reviewer, "PATCH", `/api/conflicts/${fee.id}`, { status: "not_a_conflict" })).data?.status, "not_a_conflict");
expect("amended versions are not flagged as conflicts", flags.some((f) => f.obligationA.clause.documentVersion.document.id === f.obligationB.clause.documentVersion.document.id && f.obligationA.clause.documentVersion.versionNo !== f.obligationB.clause.documentVersion.versionNo), false);
console.log(`scan: ${JSON.stringify(scan)}, flags: ${flags.length}`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures ? 1 : 0;
