import { z } from "zod";
import { ExtractedObligation } from "../schemas/obligation.js";

// Shape returned by the AI service's POST /parse (ai-service/app/parser/clauses.py).
export const ParsedClause = z.object({
  clause_number: z.string().min(1),
  page: z.number().int().positive(),
  text: z.string(),
  parent: z.string().nullable(),
  level: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
});
export const ParseResponse = z.object({
  status: z.enum(["parsed", "needs_manual_split"]),
  page_count: z.number().int().nonnegative(),
  clauses: z.array(ParsedClause),
});
export type ParsedClause = z.infer<typeof ParsedClause>;
export type ParseResponse = z.infer<typeof ParseResponse>;

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number, // set on 429: every model busy or quota used up
  ) {
    super(message);
  }
}

function config() {
  const base = process.env.AI_SERVICE_URL;
  const token = process.env.AI_SERVICE_TOKEN;
  if (!base || !token) throw new AiServiceError("AI service is not configured (AI_SERVICE_URL / AI_SERVICE_TOKEN)");
  return { base: base.replace(/\/$/, ""), token };
}

// ─── Waking the free-tier service ──────────────────────────────────────────
// Render's free plan stops the AI service after ~15 idle minutes; the first
// request then fails or hangs while it boots (about 30-60 s). Every call
// first makes sure the service answers /health.

const AWAKE_FOR_MS = 60_000; // trust a successful answer for a minute
let lastAwakeAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until the AI service answers /health, up to budgetMs. */
export async function ensureAwake(budgetMs = 90_000, intervalMs = 3_000): Promise<void> {
  if (Date.now() - lastAwakeAt < AWAKE_FOR_MS) return;
  const { base } = config();
  const deadline = Date.now() + budgetMs;
  let lastError = "no answer";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(Math.max(1_000, Math.min(20_000, deadline - Date.now()))) });
      if (res.ok) {
        lastAwakeAt = Date.now();
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = (err as Error).message;
    }
    await sleep(intervalMs);
  }
  throw new AiServiceError(`AI service did not wake up within ${Math.round(budgetMs / 1000)} s (${lastError}). Please try again.`);
}

/** Start waking the AI service without waiting (called when the site loads). */
export function wakeInBackground(): void {
  if (!process.env.AI_SERVICE_URL || !process.env.AI_SERVICE_TOKEN) return;
  ensureAwake().catch(() => undefined);
}

/** Test hook: forget that the service was recently awake. */
export function resetAwakeState(): void {
  lastAwakeAt = 0;
}

/** Send a PDF to the AI service and return its validated clause list. */
export async function parsePdf(pdf: Buffer, fileName: string): Promise<ParseResponse> {
  await ensureAwake();
  const { base, token } = config();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), fileName);

  let res: Response;
  try {
    res = await fetch(`${base}/parse`, {
      method: "POST",
      headers: { "X-Service-Token": token },
      body: form,
      signal: AbortSignal.timeout(120_000), // free tier may need ~60 s to wake up
    });
  } catch (err) {
    throw new AiServiceError(`AI service unreachable: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiServiceError(`AI service returned ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const parsed = ParseResponse.safeParse(await res.json());
  if (!parsed.success) throw new AiServiceError(`AI service response invalid: ${parsed.error.message.slice(0, 300)}`);
  return parsed.data;
}

// ─── Obligation extraction ─────────────────────────────────────────────────

const Rejection = z.object({ reason: z.string(), quote: z.string().nullable().optional() });
export const ClauseExtraction = z.object({
  clause_number: z.string(),
  obligations: z.array(ExtractedObligation), // re-validated here with the shared Zod schema
  rejected: z.array(Rejection),
  notes: z.array(z.string()),
  attempts: z.number().int(),
});
export const ExtractResponse = z.object({
  extractor: z.object({ model: z.string(), prompt_version: z.string() }),
  results: z.array(ClauseExtraction),
});
export type ClauseExtraction = z.infer<typeof ClauseExtraction>;
export type ExtractResponse = z.infer<typeof ExtractResponse>;

export type ExtractRequest = {
  document: { title: string; version_no: number; date: string | null };
  clauses: { clause_number: string; page: number; text: string }[];
};

async function callJson(method: "GET" | "POST", path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  await ensureAwake();
  const { base, token } = config();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: { "X-Service-Token": token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new AiServiceError(`AI service unreachable: ${(err as Error).message}`);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const retryAfter = res.status === 429 ? Number(res.headers.get("retry-after") ?? 60) : undefined;
    throw new AiServiceError(`AI service returned ${res.status}: ${detail.slice(0, 300)}`, res.status, retryAfter);
  }
  return res.json();
}

/** Prompt version of the AI service; part of the extraction cache key. */
export async function getPromptVersion(): Promise<string> {
  const data = (await callJson("GET", "/extract/info", undefined, 90_000)) as { prompt_version?: unknown };
  if (typeof data.prompt_version !== "string") throw new AiServiceError("AI service /extract/info returned no prompt_version");
  return data.prompt_version;
}

/** Ask the AI service to propose obligations for up to 20 clauses. */
export async function extractObligations(request: ExtractRequest): Promise<ExtractResponse> {
  // Up to 3 models x 75 s each, plus one retry call, on the AI-service side.
  const data = await callJson("POST", "/extract", request, 420_000);
  const parsed = ExtractResponse.safeParse(data);
  if (!parsed.success) throw new AiServiceError(`AI extraction response invalid: ${parsed.error.message.slice(0, 300)}`);
  return parsed.data;
}
