/**
 * Background extraction: sends a document version's clauses to the AI service
 * in batches and stores the validated results as `proposed` obligations.
 *
 * - Clauses that already have obligations are skipped, so a rerun only fills
 *   gaps and never touches reviewed (approved/edited/rejected) obligations.
 * - Validated results are cached by (prompt version, clause text); clause
 *   results with rejections are not cached, so a rerun retries them.
 * - Runs in-process. If the server restarts mid-run, the run is marked failed
 *   on startup and can simply be started again.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { AiServiceError, ClauseExtraction, extractObligations, getPromptVersion } from "./ai-client.js";
import { writeAudit } from "./audit.js";
import { cacheKey, hasObligationWording, makeBatches, toObligationRow, type ClauseForExtraction } from "./extraction-plan.js";

const PAUSE_BETWEEN_BATCHES_MS = 4_000; // stay under free-tier requests-per-minute limits
const MAX_RATE_LIMIT_WAITS = 4;
const MAX_FAILED_BATCHES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running = new Set<string>(); // version ids with a run in this process

type RejectionLog = { clause: string; reason: string; quote?: string | null };

export class ExtractionConflictError extends Error {}

/** Create a run and start it in the background. Returns the queued run. */
export async function startExtraction(documentVersionId: string, actorId: string) {
  const active = await prisma.extractionRun.findFirst({
    where: { documentVersionId, status: { in: ["queued", "running"] } },
  });
  if (active || running.has(documentVersionId)) {
    throw new ExtractionConflictError("An extraction is already running for this version");
  }
  const run = await prisma.extractionRun.create({ data: { documentVersionId, createdById: actorId } });
  await writeAudit(prisma, {
    actorId,
    eventType: "extraction.started",
    objectType: "extraction_run",
    objectId: run.id,
    payload: { documentVersionId },
  });
  running.add(documentVersionId);
  void execute(run.id, actorId)
    .catch(async (err) => {
      console.error("extraction run failed", run.id, err);
      await finish(run.id, actorId, "failed", (err as Error).message);
    })
    .finally(() => running.delete(documentVersionId));
  return run;
}

/** Mark runs left queued/running by a previous process as failed. Call once at startup. */
export async function failInterruptedRuns(): Promise<number> {
  const { count } = await prisma.extractionRun.updateMany({
    where: { status: { in: ["queued", "running"] } },
    data: { status: "failed", error: "Interrupted by a server restart; start the extraction again", finishedAt: new Date() },
  });
  return count;
}

async function finish(runId: string, actorId: string, status: "completed" | "failed", error?: string) {
  const run = await prisma.extractionRun.update({
    where: { id: runId },
    data: { status, error: error?.slice(0, 1000) ?? null, finishedAt: new Date() },
  });
  await writeAudit(prisma, {
    actorId,
    eventType: status === "completed" ? "extraction.completed" : "extraction.failed",
    objectType: "extraction_run",
    objectId: runId,
    payload: {
      obligationsCreated: run.obligationsCreated,
      processedClauses: run.processedClauses,
      cachedClauses: run.cachedClauses,
      rejectedCount: run.rejectedCount,
      models: run.models,
      ...(error ? { error: error.slice(0, 300) } : {}),
    },
  });
}

async function execute(runId: string, actorId: string) {
  const run = await prisma.extractionRun.findUniqueOrThrow({
    where: { id: runId },
    select: {
      documentVersion: {
        select: { id: true, versionNo: true, document: { select: { id: true, title: true, publishDate: true } } },
      },
    },
  });
  const version = run.documentVersion;
  const doc = version.document;

  const clauses = await prisma.clause.findMany({
    where: { documentVersionId: version.id },
    orderBy: { position: "asc" },
    select: { id: true, clauseNumber: true, page: true, text: true, _count: { select: { obligations: true } } },
  });
  const candidates: ClauseForExtraction[] = clauses
    .filter((c) => c._count.obligations === 0 && hasObligationWording(c.text))
    .map(({ id, clauseNumber, page, text }) => ({ id, clauseNumber, page, text }));

  const promptVersion = await getPromptVersion();
  await prisma.extractionRun.update({
    where: { id: runId },
    data: {
      status: "running",
      promptVersion,
      totalClauses: candidates.length,
      skippedClauses: clauses.length - candidates.length,
    },
  });

  const models = new Set<string>();
  const rejections: RejectionLog[] = [];

  // 1. Serve what we can from the cache.
  const keys = new Map(candidates.map((c) => [c.id, cacheKey(promptVersion, c.text)]));
  const cached = await prisma.extractionCache.findMany({ where: { key: { in: [...keys.values()] } } });
  const cachedByKey = new Map(cached.map((c) => [c.key, c]));
  const fromCache: { clause: ClauseForExtraction; result: ClauseExtraction }[] = [];
  const toSend: ClauseForExtraction[] = [];
  for (const clause of candidates) {
    const hit = cachedByKey.get(keys.get(clause.id)!);
    const parsed = hit ? ClauseExtraction.safeParse(hit.resultJson) : null;
    if (hit && parsed?.success) {
      fromCache.push({ clause, result: parsed.data });
      models.add(hit.model);
    } else {
      toSend.push(clause);
    }
  }
  if (fromCache.length > 0) {
    await store(runId, actorId, doc.id, fromCache, rejections, { cached: true });
  }

  // 2. Send the rest in batches.
  let failedBatches = 0;
  const batches = makeBatches(toSend);
  for (const [i, batch] of batches.entries()) {
    if (i > 0) await sleep(PAUSE_BETWEEN_BATCHES_MS);
    const request = {
      document: {
        title: doc.title,
        version_no: version.versionNo,
        date: doc.publishDate ? doc.publishDate.toISOString().slice(0, 10) : null,
      },
      clauses: batch.map((c) => ({ clause_number: c.clauseNumber, page: c.page, text: c.text })),
    };

    let response;
    for (let wait = 0; ; wait++) {
      try {
        response = await extractObligations(request);
        break;
      } catch (err) {
        if (err instanceof AiServiceError && err.status === 429 && wait < MAX_RATE_LIMIT_WAITS) {
          await sleep(Math.min(err.retryAfterSeconds ?? 60, 120) * 1000);
          continue;
        }
        response = null;
        failedBatches++;
        for (const c of batch) rejections.push({ clause: c.clauseNumber, reason: `request failed: ${(err as Error).message.slice(0, 200)}` });
        break;
      }
    }

    if (response) {
      response.extractor.model.split(",").forEach((m) => models.add(m));
      const byNumber = new Map(response.results.map((r) => [r.clause_number, r]));
      const results = batch.flatMap((clause) => {
        const result = byNumber.get(clause.clauseNumber);
        return result ? [{ clause, result }] : [];
      });
      // Cache only clean results so rejected clauses are retried next time.
      const clean = results.filter((r) => r.result.rejected.length === 0);
      if (clean.length > 0) {
        await prisma.extractionCache.createMany({
          data: clean.map(({ clause, result }) => ({
            key: keys.get(clause.id)!,
            promptVersion,
            model: response.extractor.model,
            resultJson: result as unknown as Prisma.InputJsonValue,
          })),
          skipDuplicates: true,
        });
      }
      await store(runId, actorId, doc.id, results, rejections, { cached: false });
    } else {
      await prisma.extractionRun.update({
        where: { id: runId },
        data: { processedClauses: { increment: batch.length }, rejectionsJson: rejections, rejectedCount: rejections.length },
      });
      if (failedBatches >= MAX_FAILED_BATCHES) {
        await prisma.extractionRun.update({ where: { id: runId }, data: { models: [...models].join(",") || null } });
        await finish(runId, actorId, "failed", `Stopped after ${failedBatches} failed batches: ${rejections.at(-1)?.reason}`);
        return;
      }
    }
    await prisma.extractionRun.update({ where: { id: runId }, data: { models: [...models].join(",") || null } });
  }

  await prisma.extractionRun.update({ where: { id: runId }, data: { models: [...models].join(",") || null } });
  await finish(runId, actorId, "completed");
}

/** Save obligations for a set of clause results and update run progress. */
async function store(
  runId: string,
  actorId: string,
  documentId: string,
  results: { clause: ClauseForExtraction; result: ClauseExtraction }[],
  rejections: RejectionLog[],
  opts: { cached: boolean },
) {
  for (const { clause, result } of results) {
    for (const r of result.rejected) rejections.push({ clause: clause.clauseNumber, reason: r.reason, quote: r.quote ?? null });
  }
  const rows = results.flatMap(({ clause, result }) =>
    result.obligations.map((ob, i) =>
      toObligationRow(ob, { documentId, clauseId: clause.id, clauseNumber: clause.clauseNumber, index: i + 1, runId }),
    ),
  );

  await prisma.$transaction(async (tx) => {
    const created = rows.length
      ? await tx.obligation.createManyAndReturn({ data: rows, skipDuplicates: true, select: { id: true, obligationKey: true } })
      : [];
    for (const ob of created) {
      await writeAudit(tx, {
        actorId,
        eventType: "obligation.proposed",
        objectType: "obligation",
        objectId: ob.id,
        payload: { obligationKey: ob.obligationKey, extractionRunId: runId, fromCache: opts.cached },
      });
    }
    await tx.extractionRun.update({
      where: { id: runId },
      data: {
        processedClauses: { increment: results.length },
        cachedClauses: opts.cached ? { increment: results.length } : undefined,
        obligationsCreated: { increment: created.length },
        rejectedCount: rejections.length,
        rejectionsJson: rejections as unknown as Prisma.InputJsonValue,
      },
    });
  });
}
