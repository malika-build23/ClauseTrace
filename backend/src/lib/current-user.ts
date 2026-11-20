import { prisma } from "../db.js";

/**
 * TEMPORARY until Block E (auth): uploads are attributed to the seeded admin.
 * Block E replaces this with the logged-in user and requireRole('reviewer').
 */
export async function currentUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("No admin user found; run the seed script");
  return admin.id;
}
