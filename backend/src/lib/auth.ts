import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

export const TOKEN_TTL_SECONDS = 8 * 60 * 60; // one working day
const ISSUER = "clausetrace";

/** Higher number = more rights. admin can do everything a reviewer can, and so on. */
const ROLE_LEVEL: Record<Role, number> = { viewer: 1, reviewer: 2, admin: 3 };

export function hasRole(actual: Role, required: Role): boolean {
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required];
}

export type AuthUser = { id: string; name: string; email: string; role: Role; orgId: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return value;
}

/** Fail fast at startup instead of on the first login. */
export function assertAuthConfigured(): void {
  secret();
}

export function signToken(user: { id: string; role: Role }, secretOverride?: string): string {
  return jwt.sign({ role: user.role }, secretOverride ?? secret(), {
    algorithm: "HS256",
    subject: user.id,
    issuer: ISSUER,
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

/** Returns the user id, or null for any invalid, expired or tampered token. */
export function verifyToken(token: string, secretOverride?: string): string | null {
  try {
    const payload = jwt.verify(token, secretOverride ?? secret(), { algorithms: ["HS256"], issuer: ISSUER });
    return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

/**
 * Require a valid token. The user is re-read from the database on every
 * request, so role changes and deactivation take effect immediately rather
 * than when the token expires.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, orgId: true, isActive: true },
  });
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Account not found or deactivated" });
    return;
  }
  const { isActive: _active, ...authUser } = user;
  req.user = authUser;
  next();
}

/** Use after requireAuth. */
export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    if (!hasRole(req.user.role, role)) {
      res.status(403).json({ error: `This action needs the ${role} role (you are ${req.user.role})` });
      return;
    }
    next();
  };
}

/** The signed-in user (route must be behind requireAuth). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error("currentUser() used on a route without requireAuth");
  return req.user;
}
