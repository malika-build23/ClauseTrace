import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser } from "../lib/auth.js";

// Mounted behind requireAuth + requireRole("admin").
export const usersRouter = Router();

const Role = z.enum(["admin", "reviewer", "viewer"]);
const Password = z.string().min(12, "Password must be at least 12 characters").max(200);

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

usersRouter.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    where: { orgId: currentUser(req).orgId },
    orderBy: { createdAt: "asc" },
    select: userSelect,
  });
  res.json(users);
});

const CreateUser = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  role: Role,
  password: Password,
});

usersRouter.post("/", async (req, res) => {
  const body = CreateUser.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid user" });
    return;
  }
  const admin = currentUser(req);
  try {
    const user = await prisma.user.create({
      data: {
        orgId: admin.orgId,
        name: body.data.name,
        email: body.data.email,
        role: body.data.role,
        passwordHash: await bcrypt.hash(body.data.password, 12),
      },
      select: userSelect,
    });
    await writeAudit(prisma, {
      actorId: admin.id,
      eventType: "user.created",
      objectType: "user",
      objectId: user.id,
      payload: { email: user.email, role: user.role },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw err;
  }
});

const UpdateUser = z
  .object({ role: Role.optional(), isActive: z.boolean().optional(), password: Password.optional() })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

usersRouter.patch("/:id", async (req, res) => {
  const body = UpdateUser.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid update" });
    return;
  }
  const admin = currentUser(req);
  const id = String(req.params.id);
  const target = await prisma.user.findFirst({ where: { id, orgId: admin.orgId }, select: { ...userSelect } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // An admin must not lock themselves (and possibly everyone) out.
  if (id === admin.id && ((body.data.role && body.data.role !== "admin") || body.data.isActive === false)) {
    res.status(400).json({ error: "You cannot remove your own admin role or deactivate yourself" });
    return;
  }

  const { password, ...changes } = body.data;
  const user = await prisma.user.update({
    where: { id },
    data: { ...changes, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    select: userSelect,
  });
  await writeAudit(prisma, {
    actorId: admin.id,
    eventType: "user.updated",
    objectType: "user",
    objectId: id,
    payload: {
      before: { role: target.role, isActive: target.isActive },
      after: { role: user.role, isActive: user.isActive },
      passwordReset: Boolean(password),
    },
  });
  res.json(user);
});
