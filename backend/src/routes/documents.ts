import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { prisma } from "../db.js";
import { AiServiceError, parsePdf } from "../lib/ai-client.js";
import { writeAudit } from "../lib/audit.js";
import { buildClauseRows } from "../lib/clause-tree.js";
import { currentUserId } from "../lib/current-user.js";
import { ExtractionConflictError, startExtraction } from "../lib/extraction-runner.js";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 1 } });

// Protects the free database and AI service from bulk uploads.
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

// Never send the stored PDF bytes in list/detail responses.
const versionSelect = {
  id: true,
  versionNo: true,
  fileName: true,
  fileHash: true,
  uploadedAt: true,
  parsingStatus: true,
  _count: { select: { clauses: true } },
} satisfies Prisma.DocumentVersionSelect;


/** Parse one stored version with the AI service and save its clauses. */
async function parseVersion(versionId: string, actorId: string) {
  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: { id: true, fileName: true, fileData: true },
  });
  await prisma.documentVersion.update({ where: { id: versionId }, data: { parsingStatus: "parsing" } });

  try {
    const result = await parsePdf(Buffer.from(version.fileData), version.fileName);
    const rows = buildClauseRows(versionId, result.clauses);
    await prisma.$transaction(async (tx) => {
      await tx.clause.deleteMany({ where: { documentVersionId: versionId } }); // re-parse replaces clauses
      await tx.clause.createMany({ data: rows });
      await tx.documentVersion.update({ where: { id: versionId }, data: { parsingStatus: result.status } });
      await writeAudit(tx, {
        actorId,
        eventType: "document.parsed",
        objectType: "document_version",
        objectId: versionId,
        payload: { status: result.status, pageCount: result.page_count, clauseCount: rows.length },
      });
    });
    return { parsingStatus: result.status, pageCount: result.page_count, clauseCount: rows.length };
  } catch (err) {
    await prisma.documentVersion.update({ where: { id: versionId }, data: { parsingStatus: "failed" } });
    await writeAudit(prisma, {
      actorId,
      eventType: "document.parse_failed",
      objectType: "document_version",
      objectId: versionId,
      payload: { error: (err as Error).message.slice(0, 500) },
    });
    throw err;
  }
}

function sendParseError(res: Response, err: unknown, ids: Record<string, unknown>) {
  const message = err instanceof AiServiceError ? err.message : "Parsing failed";
  res.status(502).json({ error: message, parsingStatus: "failed", ...ids });
}

/** Express 5 types route params as string | string[]. */
const param = (req: Request, name: string) => String(req.params[name]);

export const documentsRouter = Router();

// Upload a new document, or a new version of an existing one (field `documentId`).
documentsRouter.post("/", uploadLimiter, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "A PDF file is required (form field 'file')" });
    return;
  }
  if (!file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    res.status(415).json({ error: "File is not a PDF" });
    return;
  }

  const fileHash = createHash("sha256").update(file.buffer).digest("hex");
  const fileData = new Uint8Array(file.buffer); // Prisma Bytes needs an ArrayBuffer-backed view
  const documentId = typeof req.body?.documentId === "string" && req.body.documentId ? req.body.documentId : null;
  const title = (typeof req.body?.title === "string" && req.body.title.trim()) || file.originalname.replace(/\.pdf$/i, "");
  const actorId = await currentUserId();

  const duplicate = await prisma.documentVersion.findFirst({
    where: { fileHash, ...(documentId ? { documentId } : {}) },
    select: { documentId: true, versionNo: true },
  });
  if (duplicate) {
    res.status(409).json({ error: "This exact PDF was already uploaded", ...duplicate });
    return;
  }

  let version;
  if (documentId) {
    const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true } });
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const last = await prisma.documentVersion.aggregate({ where: { documentId }, _max: { versionNo: true } });
    version = await prisma.documentVersion.create({
      data: { documentId, versionNo: (last._max.versionNo ?? 0) + 1, fileName: file.originalname, fileHash, fileData },
      select: { id: true, documentId: true, versionNo: true },
    });
  } else {
    const doc = await prisma.document.create({
      data: {
        title: title.slice(0, 300),
        createdById: actorId,
        versions: { create: { versionNo: 1, fileName: file.originalname, fileHash, fileData } },
      },
      select: { id: true, versions: { select: { id: true, documentId: true, versionNo: true } } },
    });
    version = doc.versions[0];
  }

  await writeAudit(prisma, {
    actorId,
    eventType: "document.uploaded",
    objectType: "document_version",
    objectId: version.id,
    payload: { documentId: version.documentId, versionNo: version.versionNo, fileHash, bytes: file.size },
  });

  const ids = { documentId: version.documentId, versionNo: version.versionNo };
  try {
    const parsed = await parseVersion(version.id, actorId);
    res.status(201).json({ ...ids, ...parsed });
  } catch (err) {
    sendParseError(res, err, ids);
  }
});

// Retry parsing, e.g. after the AI service was asleep or failed.
documentsRouter.post("/:id/versions/:versionNo/parse", uploadLimiter, async (req, res) => {
  const version = await prisma.documentVersion.findUnique({
    where: { documentId_versionNo: { documentId: param(req, "id"), versionNo: Number(param(req, "versionNo")) } },
    select: { id: true },
  });
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  const ids = { documentId: param(req, "id"), versionNo: Number(param(req, "versionNo")) };
  try {
    res.json({ ...ids, ...(await parseVersion(version.id, await currentUserId())) });
  } catch (err) {
    sendParseError(res, err, ids);
  }
});

documentsRouter.get("/", async (_req, res) => {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      regulator: true,
      createdAt: true,
      versions: { orderBy: { versionNo: "desc" }, select: versionSelect },
    },
  });
  res.json(docs);
});

documentsRouter.get("/:id", async (req, res) => {
  const doc = await prisma.document.findUnique({
    where: { id: param(req, "id") },
    select: {
      id: true,
      title: true,
      regulator: true,
      publishDate: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      versions: { orderBy: { versionNo: "desc" }, select: versionSelect },
    },
  });
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(doc);
});

// Clauses of one version (latest by default): ?version=2
documentsRouter.get("/:id/clauses", async (req, res) => {
  const requested = req.query.version ? Number(req.query.version) : null;
  const version = await prisma.documentVersion.findFirst({
    where: { documentId: param(req, "id"), ...(requested ? { versionNo: requested } : {}) },
    orderBy: { versionNo: "desc" },
    select: { id: true, versionNo: true, parsingStatus: true },
  });
  if (!version) {
    res.status(404).json({ error: "Document or version not found" });
    return;
  }
  const clauses = await prisma.clause.findMany({
    where: { documentVersionId: version.id },
    orderBy: { position: "asc" },
    select: { id: true, clauseNumber: true, page: true, text: true, parentClauseId: true, position: true },
  });
  res.json({ versionNo: version.versionNo, parsingStatus: version.parsingStatus, clauses });
});

// The original PDF, for checking a clause against its source page.
documentsRouter.get("/:id/versions/:versionNo/file", async (req, res) => {
  const version = await prisma.documentVersion.findUnique({
    where: { documentId_versionNo: { documentId: param(req, "id"), versionNo: Number(param(req, "versionNo")) } },
    select: { fileName: true, fileData: true },
  });
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${version.fileName.replace(/["\r\n]/g, "")}"`);
  res.send(Buffer.from(version.fileData));
});

// ─── Obligation extraction ──────────────────────────────────────────────────

// Each run spends free-tier LLM quota, so starts are limited per IP.
const extractLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: "draft-7", legacyHeaders: false });

async function findVersion(documentId: string, versionNo: number | null) {
  return prisma.documentVersion.findFirst({
    where: { documentId, ...(versionNo ? { versionNo } : {}) },
    orderBy: { versionNo: "desc" },
    select: { id: true, versionNo: true, parsingStatus: true },
  });
}

const versionFrom = (value: unknown) => (value === undefined || value === null || value === "" ? null : Number(value));

// Start AI extraction for a version (latest by default). Body: { versionNo? }
documentsRouter.post("/:id/extract", extractLimiter, async (req, res) => {
  const version = await findVersion(param(req, "id"), versionFrom(req.body?.versionNo));
  if (!version) {
    res.status(404).json({ error: "Document or version not found" });
    return;
  }
  if (version.parsingStatus !== "parsed" && version.parsingStatus !== "needs_manual_split") {
    res.status(409).json({ error: `Version is not parsed yet (status: ${version.parsingStatus})` });
    return;
  }
  try {
    const run = await startExtraction(version.id, await currentUserId());
    res.status(202).json({ runId: run.id, versionNo: version.versionNo, status: run.status });
  } catch (err) {
    if (err instanceof ExtractionConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Latest extraction run for a version: ?version=N
documentsRouter.get("/:id/extraction", async (req, res) => {
  const version = await findVersion(param(req, "id"), versionFrom(req.query.version));
  if (!version) {
    res.status(404).json({ error: "Document or version not found" });
    return;
  }
  const run = await prisma.extractionRun.findFirst({
    where: { documentVersionId: version.id },
    orderBy: { startedAt: "desc" },
    omit: { documentVersionId: true, createdById: true },
  });
  res.json({ versionNo: version.versionNo, run });
});

// Obligations of a version, in clause order: ?version=N
documentsRouter.get("/:id/obligations", async (req, res) => {
  const version = await findVersion(param(req, "id"), versionFrom(req.query.version));
  if (!version) {
    res.status(404).json({ error: "Document or version not found" });
    return;
  }
  const obligations = await prisma.obligation.findMany({
    where: { clause: { documentVersionId: version.id } },
    orderBy: [{ clause: { position: "asc" } }, { obligationKey: "asc" }, { version: "desc" }],
    omit: { previousVersionId: true, approvedById: true },
    include: { clause: { select: { clauseNumber: true, page: true } } },
  });
  res.json({ versionNo: version.versionNo, obligations });
});
