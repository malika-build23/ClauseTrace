import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { currentUser, requireAuth, signToken, TOKEN_TTL_SECONDS } from "../lib/auth.js";

// Slows down password guessing: 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
});

// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

const RegisterBody = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Valid email is required").max(200),
  password: z.string().min(12, "Password must be at least 12 characters").max(200),
  organisationName: z.string().trim().min(2).max(100).optional(),
});

export const authRouter = Router();

authRouter.post("/register", loginLimiter, async (req, res) => {
  const body = RegisterBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid registration details" });
    return;
  }
  const { name, email, password, organisationName } = body.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  // Resolve organisation: use existing named org, or default org, or create one
  let org: { id: string };
  if (organisationName) {
    const foundOrg = await prisma.organisation.findFirst({
      where: { name: { equals: organisationName, mode: "insensitive" } },
      select: { id: true },
    });
    if (foundOrg) {
      org = foundOrg;
    } else {
      org = await prisma.organisation.create({
        data: { name: organisationName },
        select: { id: true },
      });
    }
  } else {
    const defaultOrg = await prisma.organisation.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (defaultOrg) {
      org = defaultOrg;
    } else {
      org = await prisma.organisation.create({
        data: { name: "Default Compliance Org" },
        select: { id: true },
      });
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      orgId: org.id,
      name,
      email,
      passwordHash,
      role: "viewer", // Self-registered accounts are read-only; an admin promotes trusted people on the Users page
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await writeAudit(prisma, {
    actorId: user.id,
    eventType: "auth.register",
    objectType: "user",
    objectId: user.id,
    payload: { email: user.email, role: user.role },
  });

  res.status(201).json({
    token: signToken(user),
    expiresIn: TOKEN_TTL_SECONDS,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    message: "Account created successfully",
  });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const body = LoginBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const { email, password } = body.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, isActive: true },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.isActive) {
    await writeAudit(prisma, {
      actorId: null,
      eventType: "auth.login_failed",
      objectType: "user",
      objectId: user?.id ?? "unknown",
      payload: { email, reason: !user ? "unknown email" : !ok ? "wrong password" : "deactivated" },
    });
    // Same message for every case: do not reveal whether the account exists.
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit(prisma, { actorId: user.id, eventType: "auth.login", objectType: "user", objectId: user.id });
  res.json({
    token: signToken(user),
    expiresIn: TOKEN_TTL_SECONDS,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const current = currentUser(req);
  const user = await prisma.user.findUnique({
    where: { id: current.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      orgId: true,
      createdAt: true,
      lastLoginAt: true,
      organisation: { select: { id: true, name: true } },
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    organisation: user.organisation,
  });
});

const UpdateProfileBody = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
  currentPassword: z.string().min(1, "Current password is required").optional(),
  newPassword: z.string().min(12, "New password must be at least 12 characters").max(200).optional(),
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const body = UpdateProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message ?? "Invalid profile update" });
    return;
  }
  const current = currentUser(req);
  const user = await prisma.user.findUnique({
    where: { id: current.id },
    select: { id: true, passwordHash: true, name: true, email: true, role: true },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updateData: { name?: string; passwordHash?: string } = {};

  if (body.data.name) {
    updateData.name = body.data.name;
  }

  if (body.data.newPassword) {
    if (!body.data.currentPassword) {
      res.status(400).json({ error: "Current password is required to set a new password" });
      return;
    }
    const match = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
    if (!match) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    updateData.passwordHash = await bcrypt.hash(body.data.newPassword, 12);
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No changes provided to update" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      orgId: true,
      createdAt: true,
      lastLoginAt: true,
      organisation: { select: { id: true, name: true } },
    },
  });

  await writeAudit(prisma, {
    actorId: user.id,
    eventType: "user.profile_updated",
    objectType: "user",
    objectId: user.id,
    payload: {
      nameChanged: Boolean(body.data.name),
      passwordChanged: Boolean(body.data.newPassword),
    },
  });

  res.json({
    user: updated,
    message: "Profile updated successfully",
  });
});
