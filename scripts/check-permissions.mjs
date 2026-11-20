/**
 * End-to-end permission check for the API (Block E).
 *
 *   node --env-file=.env.seed.local scripts/check-permissions.mjs <api-base-url> <document-id> [--read-only]
 *
 * Needs SEED_ADMIN_PASSWORD, SEED_REVIEWER_PASSWORD and SEED_VIEWER_PASSWORD in the
 * environment (never printed). --read-only skips creating and changing users,
 * so it is safe to run against production.
 */
const [BASE = "http://localhost:4000", DOC, flag] = process.argv.slice(2);
const READ_ONLY = flag === "--read-only";
const env = process.env;
if (!DOC || !env.SEED_ADMIN_PASSWORD) {
  console.error("usage: check-permissions.mjs <api-base-url> <document-id> [--read-only]  (SEED_* passwords in env)");
  process.exit(2);
}

let failures = 0;
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
function expect(label, actual, wanted) {
  const ok = actual === wanted;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (wanted ${wanted})`}`);
}
const login = async (email, password) => (await call("POST", "/api/auth/login", { body: { email, password } }));

// 1. Signed out
expect("no token -> documents", (await call("GET", "/api/documents")).status, 401);
expect("health stays public", (await call("GET", "/api/health")).status, 200);
expect("bad token -> documents", (await call("GET", "/api/documents", { token: "abc.def.ghi" })).status, 401);

// 2. Login failures look identical
const wrong = await login("admin@clausetrace.demo", "wrong-password-123");
const unknown = await login("nobody@clausetrace.demo", "wrong-password-123");
expect("wrong password", wrong.status, 401);
expect("unknown email", unknown.status, 401);
expect("same message for both", wrong.data?.error === unknown.data?.error, true);
expect("invalid body", (await call("POST", "/api/auth/login", { body: { email: "x" } })).status, 400);

// 3. Real logins
const admin = (await login("admin@clausetrace.demo", env.SEED_ADMIN_PASSWORD)).data;
const reviewer = (await login("reviewer@clausetrace.demo", env.SEED_REVIEWER_PASSWORD)).data;
const viewer = (await login("viewer@clausetrace.demo", env.SEED_VIEWER_PASSWORD)).data;
expect("admin login role", admin?.user?.role, "admin");
expect("reviewer login role", reviewer?.user?.role, "reviewer");
expect("viewer login role", viewer?.user?.role, "viewer");
expect("me (viewer)", (await call("GET", "/api/auth/me", { token: viewer.token })).data?.email, "viewer@clausetrace.demo");

// 4. Viewer is read-only
expect("viewer reads documents", (await call("GET", "/api/documents", { token: viewer.token })).status, 200);
expect("viewer reads obligations", (await call("GET", "/api/obligations?limit=1", { token: viewer.token })).status, 200);
expect("viewer reads PDF", (await call("GET", `/api/documents/${DOC}/versions/1/file`, { token: viewer.token })).status, 200);
expect("viewer upload", (await call("POST", "/api/documents", { token: viewer.token })).status, 403);
expect("viewer re-parse", (await call("POST", `/api/documents/${DOC}/versions/1/parse`, { token: viewer.token })).status, 403);
expect("viewer extract", (await call("POST", `/api/documents/${DOC}/extract`, { token: viewer.token, body: {} })).status, 403);
expect("viewer users list", (await call("GET", "/api/users", { token: viewer.token })).status, 403);

// 5. Reviewer can act but not manage users
expect("reviewer upload passes role check (400: no file)", (await call("POST", "/api/documents", { token: reviewer.token })).status, 400);
expect("reviewer users list", (await call("GET", "/api/users", { token: reviewer.token })).status, 403);

// 6. Admin user management
expect("admin users list", (await call("GET", "/api/users", { token: admin.token })).status, 200);
if (!READ_ONLY) {
const email = `temp-${Date.now()}@clausetrace.demo`;
const tempPassword = `Temp-${Math.random().toString(36).slice(2)}-pass`;
expect("short password rejected", (await call("POST", "/api/users", { token: admin.token, body: { name: "T", email, role: "viewer", password: "short" } })).status, 400);
const created = await call("POST", "/api/users", { token: admin.token, body: { name: "Temp Tester", email, role: "viewer", password: tempPassword } });
expect("admin creates user", created.status, 201);
expect("duplicate email", (await call("POST", "/api/users", { token: admin.token, body: { name: "T", email, role: "viewer", password: tempPassword } })).status, 409);
const temp = (await login(email, tempPassword)).data;
expect("new user logs in", temp?.user?.role, "viewer");
expect("new viewer cannot upload", (await call("POST", "/api/documents", { token: temp.token })).status, 403);
expect("promote to reviewer", (await call("PATCH", `/api/users/${created.data.id}`, { token: admin.token, body: { role: "reviewer" } })).data?.role, "reviewer");
expect("same token now passes reviewer check (400: no file)", (await call("POST", "/api/documents", { token: temp.token })).status, 400);
expect("deactivate", (await call("PATCH", `/api/users/${created.data.id}`, { token: admin.token, body: { isActive: false } })).data?.isActive, false);
expect("deactivated user's token stops working", (await call("GET", "/api/documents", { token: temp.token })).status, 401);
expect("deactivated user cannot log in", (await login(email, tempPassword)).status, 401);
expect("admin cannot demote self", (await call("PATCH", `/api/users/${admin.user.id}`, { token: admin.token, body: { role: "viewer" } })).status, 400);
expect("admin cannot deactivate self", (await call("PATCH", `/api/users/${admin.user.id}`, { token: admin.token, body: { isActive: false } })).status, 400);
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exitCode = failures ? 1 : 0;
