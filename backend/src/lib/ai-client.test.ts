import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { AiServiceError, ensureAwake, resetAwakeState } from "./ai-client.js";

const realFetch = globalThis.fetch;
let calls = 0;

beforeEach(() => {
  process.env.AI_SERVICE_URL = "http://ai.test";
  process.env.AI_SERVICE_TOKEN = "t";
  resetAwakeState();
  calls = 0;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

function fakeFetch(responses: (number | "network")[]) {
  globalThis.fetch = (async () => {
    const next = responses[Math.min(calls++, responses.length - 1)];
    if (next === "network") throw new TypeError("fetch failed");
    return new Response("{}", { status: next });
  }) as typeof fetch;
}

test("waits through network errors and 503s until the service answers", async () => {
  fakeFetch(["network", 503, 502, 200]);
  await ensureAwake(5_000, 1);
  assert.equal(calls, 4);
});

test("a recent success skips the check", async () => {
  fakeFetch([200]);
  await ensureAwake(5_000, 1);
  await ensureAwake(5_000, 1);
  assert.equal(calls, 1);
});

test("gives up after the time budget with a clear error", async () => {
  fakeFetch(["network"]);
  await assert.rejects(ensureAwake(50, 5), (err: unknown) => err instanceof AiServiceError && /did not wake up/.test(err.message));
});
