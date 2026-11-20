import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { hasRole, signToken, verifyToken } from "./auth.js";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

test("role hierarchy: admin > reviewer > viewer", () => {
  assert.equal(hasRole("admin", "reviewer"), true);
  assert.equal(hasRole("reviewer", "reviewer"), true);
  assert.equal(hasRole("viewer", "reviewer"), false);
  assert.equal(hasRole("reviewer", "admin"), false);
  assert.equal(hasRole("viewer", "viewer"), true);
});

test("a signed token verifies to its user id", () => {
  const token = signToken({ id: "user-1", role: "reviewer" }, SECRET);
  assert.equal(verifyToken(token, SECRET), "user-1");
});

test("a token signed with another secret is rejected", () => {
  const token = signToken({ id: "user-1", role: "admin" }, "another-secret-that-is-also-32-characters!!");
  assert.equal(verifyToken(token, SECRET), null);
});

test("an expired token is rejected", () => {
  const token = jwt.sign({ role: "admin" }, SECRET, { algorithm: "HS256", subject: "user-1", issuer: "clausetrace", expiresIn: -10 });
  assert.equal(verifyToken(token, SECRET), null);
});

test("an unsigned (alg: none) token is rejected", () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: "user-1", role: "admin", iss: "clausetrace" })).toString("base64url");
  assert.equal(verifyToken(`${header}.${body}.`, SECRET), null);
});

test("a token from another issuer is rejected", () => {
  const token = jwt.sign({ role: "admin" }, SECRET, { algorithm: "HS256", subject: "user-1", issuer: "someone-else", expiresIn: 60 });
  assert.equal(verifyToken(token, SECRET), null);
});

test("garbage is rejected", () => {
  assert.equal(verifyToken("not-a-token", SECRET), null);
});
