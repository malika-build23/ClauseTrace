/**
 * Export validated AI extraction results to data/llm-cache/extraction-cache.json
 * so demos and fresh databases do not depend on live LLM calls.
 * The seed script loads this file. Entries contain only public circular text
 * results (no secrets, no entity data).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = path.resolve(import.meta.dirname, "../../data/llm-cache/extraction-cache.json");

async function main() {
  const rows = await prisma.extractionCache.findMany({ orderBy: { key: "asc" } });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    `${JSON.stringify(
      rows.map((r) => ({ key: r.key, promptVersion: r.promptVersion, model: r.model, result: r.resultJson })),
      null,
      1,
    )}\n`,
  );
  console.log(`Exported ${rows.length} cached clause results to ${path.relative(process.cwd(), OUT)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
