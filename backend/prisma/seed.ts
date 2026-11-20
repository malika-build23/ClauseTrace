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
// Metric names match the illustrative obligation schema example.
const profiles = [
  {
    name: "Alpha Fund Managers (fictional) - expected PASS",
    data: { example_metric: 1_500_000, example_metric_unit: "USD", reporting_date: "2026-03-31", compliance_officer_appointed: true },
  },
  {
    name: "Beta Capital (fictional) - expected FAIL",
    data: { example_metric: 400_000, example_metric_unit: "USD", reporting_date: "2026-03-31", compliance_officer_appointed: false },
  },
  {
    name: "Gamma Investments (fictional) - expected UPCOMING_DEADLINE",
    data: { example_metric: 1_200_000, example_metric_unit: "USD", reporting_date: null, compliance_officer_appointed: true },
  },
  {
    name: "Delta Advisors (fictional) - expected INSUFFICIENT_DATA",
    data: { example_metric_unit: "USD" },
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
