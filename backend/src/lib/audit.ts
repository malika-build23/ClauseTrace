import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  actorId: string | null; // null for system actions
  eventType: string; // e.g. "document.uploaded"
  objectType: string; // e.g. "document_version"
  objectId: string;
  payload?: Prisma.InputJsonValue;
};

/** Append one audit_log row. The table rejects UPDATE/DELETE at the DB level. */
export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      eventType: entry.eventType,
      objectType: entry.objectType,
      objectId: entry.objectId,
      payloadJson: entry.payload ?? {},
    },
  });
}
