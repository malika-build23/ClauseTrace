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

/** Send a PDF to the AI service and return its validated clause list. */
export async function parsePdf(pdf: Buffer, fileName: string): Promise<ParseResponse> {
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
