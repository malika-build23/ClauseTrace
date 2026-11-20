-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- AlterTable
ALTER TABLE "obligations" ADD COLUMN     "extraction_run_id" TEXT;

-- CreateTable
CREATE TABLE "extraction_runs" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'queued',
    "total_clauses" INTEGER NOT NULL DEFAULT 0,
    "processed_clauses" INTEGER NOT NULL DEFAULT 0,
    "skipped_clauses" INTEGER NOT NULL DEFAULT 0,
    "cached_clauses" INTEGER NOT NULL DEFAULT 0,
    "obligations_created" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "rejections_json" JSONB NOT NULL DEFAULT '[]',
    "models" TEXT,
    "prompt_version" TEXT,
    "error" TEXT,
    "created_by" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "extraction_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_cache" (
    "key" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_cache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "extraction_runs_document_version_id_started_at_idx" ON "extraction_runs"("document_version_id", "started_at");

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "extraction_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
