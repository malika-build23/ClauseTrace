/**
 * Seed: demo organisation, three role users, one entity category and four
 * fictional entity profiles. Idempotent: safe to run more than once.
 *
 * Passwords come from env (SEED_ADMIN_PASSWORD, SEED_REVIEWER_PASSWORD,
 * SEED_VIEWER_PASSWORD) and are never stored in the repo.
 *
 * All profile values are ILLUSTRATIVE, not real IFSCA figures.
 */
import { PrismaClient, type Role } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_NAME = "Demo Compliance Org (fictional)";
const CATEGORY = "Fund Management Entity";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 12) {
    throw new Error(`${name} must be set to a password of at least 12 characters`);
  }
  return value;
}

const users: { name: string; email: string; role: Role; passwordEnv: string }[] = [
  { name: "Demo Admin", email: "admin@clausetrace.demo", role: "admin", passwordEnv: "SEED_ADMIN_PASSWORD" },
  { name: "Demo Reviewer", email: "reviewer@clausetrace.demo", role: "reviewer", passwordEnv: "SEED_REVIEWER_PASSWORD" },
  { name: "Demo Viewer", email: "viewer@clausetrace.demo", role: "viewer", passwordEnv: "SEED_VIEWER_PASSWORD" },
];

// Each profile is designed to produce one evaluation outcome once rules exist.
// Field names match the metrics extracted from the public IFSCA Angel Funds
// circular (corpus, angel_investors, ...). Every value is made up for the demo.
// "*_completed_on: null" means "not done yet" for deadline rules.
const angelScheme = {
  corpus: 1_500_000,
  corpus_unit: "USD",
  angel_investors: 150,
  angel_investors_unit: "investors",
  commitment_amount: 50_000,
  commitment_amount_unit: "USD",
  investment_amount: 1_000_000,
  investment_amount_unit: "USD",
  lock_in_period: 2,
  lock_in_period_unit: "years",
  compliance_officer_appointed: true,
};

const profiles = [
  {
    name: "Alpha Angel Fund (fictional) - expected PASS",
    data: { ...angelScheme },
  },
  {
    name: "Beta Angel Fund (fictional) - expected FAIL",
    data: {
      ...angelScheme,
      corpus: 800_000, // below USD 1,000,000
      angel_investors: 240, // above 200
      commitment_amount: 25_000, // below USD 40,000
      investment_amount: 2_000_000, // above USD 1,500,000
      lock_in_period: 0.5, // below 1 year
      compliance_officer_appointed: false,
    },
  },
  {
    name: "Gamma Angel Fund (fictional) - expected UPCOMING_DEADLINE",
    // Thresholds met; filings not done yet, so deadline rules within their window show as upcoming.
    data: { ...angelScheme, ppm_filing_completed_on: null, annual_report_filed_on: null },
  },
  {
    name: "Delta Angel Fund (fictional) - expected INSUFFICIENT_DATA",
    // Corpus in another currency (no conversion is made) and most fields missing.
    data: { corpus: 120_000_000, corpus_unit: "INR" },
  },
];

async function main() {
  const org =
    (await prisma.organisation.findFirst({ where: { name: ORG_NAME } })) ??
    (await prisma.organisation.create({ data: { name: ORG_NAME } }));

  for (const u of users) {
    const passwordHash = await bcrypt.hash(requiredEnv(u.passwordEnv), 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, orgId: org.id },
      create: { name: u.name, email: u.email, role: u.role, passwordHash, orgId: org.id },
    });
  }

  const category = await prisma.entityCategory.upsert({
    where: { name: CATEGORY },
    update: {},
    create: { name: CATEGORY },
  });

  // Profiles from an earlier seed version: rename them, or remove them if the new one already exists.
  const legacy: Record<string, string> = {
    "Alpha Fund Managers (fictional) - expected PASS": profiles[0].name,
    "Beta Capital (fictional) - expected FAIL": profiles[1].name,
    "Gamma Investments (fictional) - expected UPCOMING_DEADLINE": profiles[2].name,
    "Delta Advisors (fictional) - expected INSUFFICIENT_DATA": profiles[3].name,
  };
  for (const [oldName, newName] of Object.entries(legacy)) {
    const old = await prisma.entityProfile.findFirst({ where: { orgId: org.id, name: oldName }, include: { _count: { select: { evaluations: true } } } });
    if (!old) continue;
    const replacement = await prisma.entityProfile.findFirst({ where: { orgId: org.id, name: newName } });
    if (!replacement) await prisma.entityProfile.update({ where: { id: old.id }, data: { name: newName } });
    else if (old._count.evaluations === 0) await prisma.entityProfile.delete({ where: { id: old.id } });
  }

  for (const p of profiles) {
    const existing = await prisma.entityProfile.findFirst({ where: { orgId: org.id, name: p.name } });
    if (existing) {
      await prisma.entityProfile.update({ where: { id: existing.id }, data: { dataJson: p.data } });
    } else {
      await prisma.entityProfile.create({
        data: { orgId: org.id, name: p.name, categoryId: category.id, dataJson: p.data },
      });
    }
  }

  // Validated AI extraction results for the demo circulars (see prisma/cache-export.ts),
  // so a fresh database can run extraction without calling the LLM.
  const cacheFile = path.resolve(import.meta.dirname, "../../data/llm-cache/extraction-cache.json");
  if (fs.existsSync(cacheFile)) {
    const entries = JSON.parse(fs.readFileSync(cacheFile, "utf8")) as { key: string; promptVersion: string; model: string; result: object }[];
    const { count } = await prisma.extractionCache.createMany({
      data: entries.map((e) => ({ key: e.key, promptVersion: e.promptVersion, model: e.model, resultJson: e.result })),
      skipDuplicates: true,
    });
    console.log(`LLM cache: ${count} new of ${entries.length} entries`);
  }

  const counts = {
    organisations: await prisma.organisation.count(),
    users: await prisma.user.count(),
    entityCategories: await prisma.entityCategory.count(),
    entityProfiles: await prisma.entityProfile.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
