import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser, requireRole } from "../lib/auth.js";

export const profilesRouter = Router();

// Flat key/value data only: numbers, text, booleans, null.
const ProfileData = z
  .record(z.string().regex(/^[a-z][a-z0-9_.]{0,79}$/, "keys: lowercase letters, digits, _ and ."), z.union([z.number(), z.string().max(500), z.boolean(), z.null()]))
  .refine((d) => Object.keys(d).length <= 200, "At most 200 fields");

const select = {
  id: true,
  name: true,
  dataJson: true,
  isSimulation: true,
  baseProfileId: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
} as const;

// ?includeSimulation=true to also list what-if copies
profilesRouter.get("/", async (req, res) => {
  const profiles = await prisma.entityProfile.findMany({
    where: { orgId: currentUser(req).orgId, ...(req.query.includeSimulation === "true" ? {} : { isSimulation: false }) },
    orderBy: [{ isSimulation: "asc" }, { name: "asc" }],
    select,
  });
  res.json(profiles);
});

profilesRouter.get("/categories", async (_req, res) => {
  res.json(await prisma.entityCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }));
});

profilesRouter.get("/:id", async (req, res) => {
  const profile = await prisma.entityProfile.findFirst({ where: { id: String(req.params.id), orgId: currentUser(req).orgId }, select });
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

const CreateProfile = z.object({
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid(),
  data: ProfileData,
});

profilesRouter.post("/", requireRole("reviewer"), async (req, res) => {
  const body = CreateProfile.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid profile" });
    return;
  }
  const user = currentUser(req);
  const category = await prisma.entityCategory.findUnique({ where: { id: body.data.categoryId } });
  if (!category) {
    res.status(400).json({ error: "Unknown entity category" });
    return;
  }
  const profile = await prisma.entityProfile.create({
    data: { orgId: user.orgId, name: body.data.name, categoryId: category.id, dataJson: body.data.data },
    select,
  });
  await writeAudit(prisma, { actorId: user.id, eventType: "profile.created", objectType: "entity_profile", objectId: profile.id, payload: { name: profile.name, data: body.data.data } });
  res.status(201).json(profile);
});

const UpdateProfile = z
  .object({ name: z.string().trim().min(1).max(200).optional(), categoryId: z.string().uuid().optional(), data: ProfileData.optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

profilesRouter.patch("/:id", requireRole("reviewer"), async (req, res) => {
  const body = UpdateProfile.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid update" });
    return;
  }
  const user = currentUser(req);
  const before = await prisma.entityProfile.findFirst({ where: { id: String(req.params.id), orgId: user.orgId }, select });
  if (!before) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const profile = await prisma.entityProfile.update({
    where: { id: before.id },
    data: {
      ...(body.data.name ? { name: body.data.name } : {}),
      ...(body.data.categoryId ? { categoryId: body.data.categoryId } : {}),
      ...(body.data.data ? { dataJson: body.data.data } : {}),
    },
    select,
  });
  // Evaluations keep their own copy of the inputs used, so history stays explainable after edits.
  await writeAudit(prisma, {
    actorId: user.id,
    eventType: "profile.updated",
    objectType: "entity_profile",
    objectId: profile.id,
    payload: { before: { name: before.name, data: before.dataJson }, after: { name: profile.name, data: profile.dataJson } },
  });
  res.json(profile);
});

// What-if simulator (Block K): copy a profile as a simulation. Simulation
// profiles and their results are excluded from the dashboard and from
// compliance records, and are always labelled SIMULATION in the UI.
profilesRouter.post("/:id/simulate", requireRole("reviewer"), async (req, res) => {
  const user = currentUser(req);
  const base = await prisma.entityProfile.findFirst({ where: { id: String(req.params.id), orgId: user.orgId } });
  if (!base) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  if (base.isSimulation) {
    res.status(400).json({ error: "Copy the original profile, not a simulation" });
    return;
  }
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const copy = await prisma.entityProfile.create({
    data: {
      orgId: user.orgId,
      name: `What-if: ${base.name} (${stamp} UTC)`,
      categoryId: base.categoryId,
      dataJson: base.dataJson ?? {},
      isSimulation: true,
      baseProfileId: base.id,
    },
    select,
  });
  await writeAudit(prisma, { actorId: user.id, eventType: "simulation.created", objectType: "entity_profile", objectId: copy.id, payload: { baseProfileId: base.id } });
  res.status(201).json(copy);
});

profilesRouter.delete("/:id", requireRole("reviewer"), async (req, res) => {
  const user = currentUser(req);
  const profile = await prisma.entityProfile.findFirst({ where: { id: String(req.params.id), orgId: user.orgId } });
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  if (!profile.isSimulation) {
    res.status(400).json({ error: "Only simulation copies can be deleted; compliance profiles are kept for the record" });
    return;
  }
  await prisma.$transaction([prisma.evaluation.deleteMany({ where: { profileId: profile.id } }), prisma.entityProfile.delete({ where: { id: profile.id } })]);
  await writeAudit(prisma, { actorId: user.id, eventType: "simulation.deleted", objectType: "entity_profile", objectId: profile.id, payload: { name: profile.name } });
  res.status(204).end();
});
