/**
 * Pure helpers for planning an extraction run. No I/O here, so it is unit-tested.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { ExtractedObligation } from "../schemas/obligation.js";
import { reviewPriority } from "./scoring.js";

/** Words that signal a clause may contain an obligation. Clauses without them are not sent to the LLM. */
const OBLIGATION_WORDING =
  /\b(shall|must|should|may|required|requires|require|ensure|ensures|prohibited|not permitted|obliged|obligation|need to|needs to|is to|are to)\b/i;

export const MIN_CLAUSE_CHARS = 25;
export const MAX_BATCH_CLAUSES = 12;
export const MAX_BATCH_CHARS = 24_000;

export type ClauseForExtraction = { id: string; clauseNumber: string; page: number; text: string };

export function hasObligationWording(text: string): boolean {
  return text.length >= MIN_CLAUSE_CHARS && OBLIGATION_WORDING.test(text);
}

/** Group clauses into request-sized batches (count and character limits). */
export function makeBatches<T extends { text: string }>(
  clauses: T[],
  maxClauses = MAX_BATCH_CLAUSES,
  maxChars = MAX_BATCH_CHARS,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const clause of clauses) {
    const size = clause.text.length;
    if (current.length > 0 && (current.length >= maxClauses || chars + size > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(clause);
    chars += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Cache key: same prompt + same clause text = same validated answer. */
export function cacheKey(promptVersion: string, clauseText: string): string {
  return createHash("sha256").update(`${promptVersion}\n${clauseText}`).digest("hex");
}

/** Short stable document code, e.g. "D73834E", used in obligation keys. */
export function documentCode(documentId: string): string {
  return `D${documentId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/**
 * e.g. "D73834E-c2(B)(I)-01" for document version 1 and "D73834E-v2-c18-01"
 * for later versions, so an amended clause never collides with the key of
 * the obligation it replaces.
 */
export function obligationKey(documentId: string, documentVersion: number, clauseNumber: string, index: number): string {
  const version = documentVersion > 1 ? `-v${documentVersion}` : "";
  return `${documentCode(documentId)}${version}-c${clauseNumber}-${String(index).padStart(2, "0")}`;
}

/** Map a validated AI obligation to an `obligations` row (status: proposed). */
export function toObligationRow(
  ob: ExtractedObligation,
  ctx: { documentId: string; documentVersion: number; clauseId: string; clauseNumber: string; index: number; runId: string },
): Prisma.ObligationCreateManyInput {
  return {
    obligationKey: obligationKey(ctx.documentId, ctx.documentVersion, ctx.clauseNumber, ctx.index),
    version: 1,
    clauseId: ctx.clauseId,
    quote: ob.source.quote,
    subject: ob.subject,
    modality: ob.modality,
    action: ob.action,
    condition: ob.condition,
    thresholdJson: ob.threshold ?? undefined,
    deadline: ob.deadline ? new Date(`${ob.deadline}T00:00:00Z`) : null,
    evidence: ob.evidence,
    machineCheckable: ob.machine_checkable,
    ambiguityFlag: ob.ambiguity_flag,
    ambiguityReason: ob.ambiguity_reason,
    confidence: ob.confidence,
    reviewPriority: reviewPriority({
      ambiguityFlag: ob.ambiguity_flag,
      ambiguityReason: ob.ambiguity_reason,
      machineCheckable: ob.machine_checkable,
      confidence: ob.confidence,
      condition: ob.condition,
      deadline: ob.deadline,
    }).level,
    status: "proposed",
    extractionRunId: ctx.runId,
  };
}
