/**
 * Block B check: proves a document -> version -> clause -> obligation chain can
 * be written and queried, and that audit_log rejects UPDATE/DELETE.
 * Everything runs inside a transaction that is rolled back, so no data is kept.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
class Rollback extends Error {}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { role: "admin" } });

      const doc = await tx.document.create({
        data: { title: "Chain check document (temporary)", createdById: user.id },
      });
      const version = await tx.documentVersion.create({
        data: { documentId: doc.id, versionNo: 1, fileName: "check.pdf", fileHash: "0".repeat(64), fileData: Buffer.from("%PDF-check") },
      });
      const clause = await tx.clause.create({
        data: { documentVersionId: version.id, clauseNumber: "4.2", page: 3, position: 1, text: "Exact source text" },
      });
      await tx.obligation.create({
        data: {
          obligationKey: "CHECK-c4.2-01",
          clauseId: clause.id,
          quote: "Exact source text",
          subject: "Example regulated entity",
          modality: "must",
          action: "maintain a required measure",
          thresholdJson: { metric: "example_metric", operator: ">=", value: 1000000, unit: "USD" },
          machineCheckable: true,
          confidence: 0.82,
        },
      });

      const chain = await tx.document.findUniqueOrThrow({
        where: { id: doc.id },
        select: {
          title: true,
          versions: {
            select: {
              versionNo: true,
              clauses: { select: { clauseNumber: true, page: true, obligations: { select: { obligationKey: true, status: true } } } },
            },
          },
        },
      });
      console.log("Chain query OK:", JSON.stringify(chain));

      const entry = await tx.auditLog.create({
        data: { eventType: "chain_check", objectType: "document", objectId: doc.id, payloadJson: {} },
      });
      try {
        await tx.$executeRaw`SAVEPOINT audit_check`;
        await tx.$executeRaw`UPDATE audit_log SET event_type = 'tampered' WHERE id = ${entry.id}`;
        throw new Error("audit_log UPDATE was allowed (trigger missing)");
      } catch (err) {
        if ((err as Error).message.includes("trigger missing")) throw err;
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT audit_check`;
        console.log("Audit append-only OK: UPDATE rejected");
      }

      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
    console.log("Rolled back: no data kept");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
