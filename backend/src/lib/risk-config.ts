import { z } from "zod";
import { prisma } from "../db.js";
import { DEFAULT_RISK_WEIGHTS, type RiskWeights } from "./scoring.js";

export const RiskWeightsSchema = z
  .object({
    fail: z.number().min(0).max(100),
    overdue: z.number().min(0).max(100),
    upcoming: z.number().min(0).max(100),
    upcomingPerDayInside: z.number().min(0).max(10),
    insufficient: z.number().min(0).max(100),
    pendingChange: z.number().min(0).max(100),
    highThreshold: z.number().min(0).max(1000),
    mediumThreshold: z.number().min(0).max(1000),
  })
  .refine((w) => w.mediumThreshold <= w.highThreshold, "The medium threshold must not be above the high threshold");

/** Latest weights saved by a reviewer for the organisation, or the defaults. */
export async function loadRiskWeights(orgId: string): Promise<RiskWeights> {
  const latest = await prisma.riskConfig.findFirst({ where: { orgId }, orderBy: { updatedAt: "desc" } });
  const parsed = latest ? RiskWeightsSchema.safeParse(latest.weightsJson) : null;
  return parsed?.success ? parsed.data : DEFAULT_RISK_WEIGHTS;
}
