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

export const authRouter = Router();

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

authRouter.get("/me", requireAuth, (req, res) => {
  const { id, name, email, role } = currentUser(req);
  res.json({ id, name, email, role });
});
