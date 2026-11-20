import { z } from "zod";

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
  constructor(message: string, readonly status?: number) {
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
