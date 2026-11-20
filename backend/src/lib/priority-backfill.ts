import { prisma } from "../db.js";
import { reviewPriority } from "./scoring.js";

/** Give obligations created before review priority existed a priority (one update per level). */
export async function backfillReviewPriority(): Promise<number> {
  const missing = await prisma.obligation.findMany({ where: { reviewPriority: null } });
  const byLevel: Record<"high" | "medium" | "low", string[]> = { high: [], medium: [], low: [] };
  for (const o of missing) byLevel[reviewPriority(o).level].push(o.id);
  for (const [level, ids] of Object.entries(byLevel)) {
    if (ids.length) await prisma.obligation.updateMany({ where: { id: { in: ids } }, data: { reviewPriority: level as "high" | "medium" | "low" } });
  }
  return missing.length;
}
