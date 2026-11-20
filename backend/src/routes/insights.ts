import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser, requireRole } from "../lib/auth.js";
import { loadRiskWeights, RiskWeightsSchema } from "../lib/risk-config.js";
import { DEFAULT_RISK_WEIGHTS } from "../lib/scoring.js";

// Risk configuration and the knowledge graph (Block J).
export const insightsRouter = Router();

insightsRouter.get("/risk-config", async (req, res) => {
  res.json({ weights: await loadRiskWeights(currentUser(req).orgId), defaults: DEFAULT_RISK_WEIGHTS });
});

insightsRouter.put("/risk-config", requireRole("admin"), async (req, res) => {
  const body = RiskWeightsSchema.safeParse(req.body?.weights);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid weights" });
    return;
  }
  const user = currentUser(req);
  const before = await loadRiskWeights(user.orgId);
  const saved = await prisma.riskConfig.create({ data: { orgId: user.orgId, weightsJson: body.data, updatedById: user.id } });
  await writeAudit(prisma, { actorId: user.id, eventType: "risk_config.updated", objectType: "risk_config", objectId: saved.id, payload: { before, after: body.data } });
  res.json({ weights: body.data });
});

type Node = { id: string; kind: "regulator" | "document" | "version" | "clause" | "obligation" | "category" | "rule" | "result"; label: string; detail?: string; href?: string };
type Edge = { from: string; to: string; label: string };

/**
 * GET /api/graph/obligation/:id: the neighbourhood of one obligation, from the
 * regulator to the latest results of its rules. It also answers "if this
 * clause changes, what is affected?": every obligation from the same clause,
 * their rules, and the entities those rules were evaluated for.
 */
insightsRouter.get("/graph/obligation/:id", async (req, res) => {
  const orgId = currentUser(req).orgId;
  const ob = await prisma.obligation.findUnique({
    where: { id: String(req.params.id) },
    select: {
      clause: {
        select: {
          id: true,
          clauseNumber: true,
          page: true,
          documentVersion: { select: { id: true, versionNo: true, document: { select: { id: true, title: true, regulator: true } } } },
        },
      },
    },
  });
  if (!ob) {
    res.status(404).json({ error: "Obligation not found" });
    return;
  }
  const clause = ob.clause;
  const version = clause.documentVersion;
  const doc = version.document;

  const siblings = await prisma.obligation.findMany({
    where: { clauseId: clause.id, nextVersion: null },
    select: {
      id: true,
      obligationKey: true,
      version: true,
      status: true,
      action: true,
      entityCategories: { select: { entityCategory: { select: { id: true, name: true } } } },
      rules: { where: { isActive: true }, select: { id: true, ruleKey: true, ruleVersion: true } },
    },
  });
  const ruleIds = siblings.flatMap((s) => s.rules.map((r) => r.id));
  const evaluations = ruleIds.length
    ? await prisma.evaluation.findMany({
        where: { ruleId: { in: ruleIds }, isSimulation: false, profile: { orgId } },
        orderBy: { evaluatedAt: "desc" },
        select: { id: true, ruleId: true, result: true, profile: { select: { id: true, name: true } } },
      })
    : [];

  const nodes: Node[] = [
    { id: `reg:${doc.regulator}`, kind: "regulator", label: doc.regulator },
    { id: `doc:${doc.id}`, kind: "document", label: doc.title, href: `/documents/${doc.id}` },
    { id: `ver:${version.id}`, kind: "version", label: `Version ${version.versionNo}`, href: `/documents/${doc.id}?version=${version.versionNo}` },
    { id: `cl:${clause.id}`, kind: "clause", label: `Clause ${clause.clauseNumber}`, detail: `page ${clause.page}`, href: `/documents/${doc.id}?version=${version.versionNo}` },
  ];
  const edges: Edge[] = [
    { from: `reg:${doc.regulator}`, to: `doc:${doc.id}`, label: "issued" },
    { from: `doc:${doc.id}`, to: `ver:${version.id}`, label: "has version" },
    { from: `ver:${version.id}`, to: `cl:${clause.id}`, label: "contains" },
  ];
  const seen = new Set(nodes.map((n) => n.id));
  const addNode = (n: Node) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  };

  for (const s of siblings) {
    addNode({ id: `ob:${s.id}`, kind: "obligation", label: `${s.obligationKey} v${s.version}`, detail: `${s.status} · ${s.action}`, href: `/obligations/${s.id}` });
    edges.push({ from: `cl:${clause.id}`, to: `ob:${s.id}`, label: "states" });
    for (const c of s.entityCategories) {
      addNode({ id: `cat:${c.entityCategory.id}`, kind: "category", label: c.entityCategory.name });
      edges.push({ from: `ob:${s.id}`, to: `cat:${c.entityCategory.id}`, label: "applies to" });
    }
    for (const r of s.rules) {
      addNode({ id: `rule:${r.id}`, kind: "rule", label: `${r.ruleKey} v${r.ruleVersion}`, href: `/rules?key=${encodeURIComponent(r.ruleKey)}` });
      edges.push({ from: `ob:${s.id}`, to: `rule:${r.id}`, label: "compiled to" });
      const latestPerProfile = new Map<string, (typeof evaluations)[number]>();
      for (const e of evaluations.filter((x) => x.ruleId === r.id)) if (!latestPerProfile.has(e.profile.id)) latestPerProfile.set(e.profile.id, e);
      for (const e of latestPerProfile.values()) {
        addNode({ id: `res:${e.id}`, kind: "result", label: e.result, detail: e.profile.name, href: `/evaluations/${e.id}` });
        edges.push({ from: `rule:${r.id}`, to: `res:${e.id}`, label: "evaluated" });
      }
    }
  }

  const impact = {
    obligations: siblings.length,
    rules: ruleIds.length,
    entities: new Set(evaluations.map((e) => e.profile.id)).size,
  } satisfies Prisma.JsonObject;
  res.json({ nodes, edges, impact });
});
