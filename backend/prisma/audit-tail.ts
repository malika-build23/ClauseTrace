/** Print the most recent audit_log entries: npm run db:audit [-- 50] */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const limit = Number(process.argv[2] ?? 20);

async function main() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { createdAt: true, eventType: true, objectType: true, objectId: true, payloadJson: true, actor: { select: { email: true } } },
  });
  for (const r of rows.reverse()) {
    const payload = JSON.stringify(r.payloadJson);
    console.log(
      r.createdAt.toISOString(),
      r.eventType.padEnd(22),
      `${r.objectType}:${r.objectId.slice(0, 8)}`,
      r.actor?.email ?? "system",
      payload.length > 100 ? `${payload.slice(0, 97)}...` : payload,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
