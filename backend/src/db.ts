import { PrismaClient } from "@prisma/client";

// One client per process. Render runs a long-lived Node server, so the
// client's connection pool is reused across requests.
export const prisma = new PrismaClient();
