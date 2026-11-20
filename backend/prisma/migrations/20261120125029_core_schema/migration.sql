-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'reviewer', 'viewer');

-- CreateEnum
CREATE TYPE "ParsingStatus" AS ENUM ('pending', 'parsing', 'parsed', 'needs_manual_split', 'failed');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('must', 'must_not', 'may', 'should');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('proposed', 'approved', 'edited', 'rejected');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('approve', 'edit', 'reject');

-- CreateEnum
CREATE TYPE "ReviewPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('threshold', 'deadline', 'required_field');

-- CreateEnum
CREATE TYPE "EvaluationResult" AS ENUM ('PASS', 'FAIL', 'UPCOMING_DEADLINE', 'INSUFFICIENT_DATA');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('added', 'modified', 'removed');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('pending', 'confirmed', 'dismissed');

-- CreateEnum
CREATE TYPE "ImpactReviewStatus" AS ENUM ('pending', 'confirmed', 'draft_created', 'dismissed');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('flagged', 'confirmed', 'resolved', 'not_a_conflict');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "regulator" TEXT NOT NULL DEFAULT 'IFSCA',
    "publish_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_data" BYTEA NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsing_status" "ParsingStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clauses" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "clause_number" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "parent_clause_id" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligations" (
    "id" TEXT NOT NULL,
    "obligation_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" TEXT,
    "clause_id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "modality" "Modality" NOT NULL,
    "action" TEXT NOT NULL,
    "condition" TEXT,
    "threshold_json" JSONB,
    "deadline" DATE,
    "evidence" TEXT,
    "machine_checkable" BOOLEAN NOT NULL DEFAULT false,
    "ambiguity_flag" BOOLEAN NOT NULL DEFAULT false,
    "ambiguity_reason" TEXT,
    "reference_only" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "review_priority" "ReviewPriority",
    "status" "ObligationStatus" NOT NULL DEFAULT 'proposed',
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_reviews" (
    "id" TEXT NOT NULL,
    "obligation_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "before_json" JSONB NOT NULL,
    "after_json" JSONB,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obligation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "entity_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligation_entity_categories" (
    "obligation_id" TEXT NOT NULL,
    "entity_category_id" TEXT NOT NULL,

    CONSTRAINT "obligation_entity_categories_pkey" PRIMARY KEY ("obligation_id","entity_category_id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "rule_key" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "obligation_id" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "definition_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "data_json" JSONB NOT NULL,
    "is_simulation" BOOLEAN NOT NULL DEFAULT false,
    "base_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "profile_id" TEXT NOT NULL,
    "input_ref" JSONB NOT NULL,
    "evaluation_date" DATE NOT NULL,
    "result" "EvaluationResult" NOT NULL,
    "details_json" JSONB NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_simulation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_events" (
    "id" TEXT NOT NULL,
    "old_version_id" TEXT NOT NULL,
    "new_version_id" TEXT NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "clause_ref" TEXT NOT NULL,
    "old_text" TEXT,
    "new_text" TEXT,
    "summary" TEXT,
    "status" "ChangeStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_items" (
    "id" TEXT NOT NULL,
    "change_event_id" TEXT NOT NULL,
    "obligation_id" TEXT,
    "rule_id" TEXT,
    "review_status" "ImpactReviewStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_flags" (
    "id" TEXT NOT NULL,
    "obligation_a_id" TEXT NOT NULL,
    "obligation_b_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'flagged',
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflict_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_config" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "weights_json" JSONB NOT NULL,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "event_type" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_no_key" ON "document_versions"("document_id", "version_no");

-- CreateIndex
CREATE INDEX "clauses_document_version_id_position_idx" ON "clauses"("document_version_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "obligations_previous_version_id_key" ON "obligations"("previous_version_id");

-- CreateIndex
CREATE INDEX "obligations_status_idx" ON "obligations"("status");

-- CreateIndex
CREATE INDEX "obligations_clause_id_idx" ON "obligations"("clause_id");

-- CreateIndex
CREATE UNIQUE INDEX "obligations_obligation_key_version_key" ON "obligations"("obligation_key", "version");

-- CreateIndex
CREATE INDEX "obligation_reviews_obligation_id_idx" ON "obligation_reviews"("obligation_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_categories_name_key" ON "entity_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "rules_rule_key_rule_version_key" ON "rules"("rule_key", "rule_version");

-- CreateIndex
CREATE INDEX "evaluations_profile_id_is_simulation_idx" ON "evaluations"("profile_id", "is_simulation");

-- CreateIndex
CREATE UNIQUE INDEX "conflict_flags_obligation_a_id_obligation_b_id_key" ON "conflict_flags"("obligation_a_id", "obligation_b_id");

-- CreateIndex
CREATE INDEX "audit_log_object_type_object_id_idx" ON "audit_log"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clauses" ADD CONSTRAINT "clauses_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clauses" ADD CONSTRAINT "clauses_parent_clause_id_fkey" FOREIGN KEY ("parent_clause_id") REFERENCES "clauses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_clause_id_fkey" FOREIGN KEY ("clause_id") REFERENCES "clauses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_reviews" ADD CONSTRAINT "obligation_reviews_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_reviews" ADD CONSTRAINT "obligation_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_entity_categories" ADD CONSTRAINT "obligation_entity_categories_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "obligations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligation_entity_categories" ADD CONSTRAINT "obligation_entity_categories_entity_category_id_fkey" FOREIGN KEY ("entity_category_id") REFERENCES "entity_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_profiles" ADD CONSTRAINT "entity_profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_profiles" ADD CONSTRAINT "entity_profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "entity_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "entity_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_old_version_id_fkey" FOREIGN KEY ("old_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_events" ADD CONSTRAINT "change_events_new_version_id_fkey" FOREIGN KEY ("new_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_items" ADD CONSTRAINT "impact_items_change_event_id_fkey" FOREIGN KEY ("change_event_id") REFERENCES "change_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_items" ADD CONSTRAINT "impact_items_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "obligations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_items" ADD CONSTRAINT "impact_items_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_obligation_a_id_fkey" FOREIGN KEY ("obligation_a_id") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_obligation_b_id_fkey" FOREIGN KEY ("obligation_b_id") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_flags" ADD CONSTRAINT "conflict_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_config" ADD CONSTRAINT "risk_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_config" ADD CONSTRAINT "risk_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit log is append-only: block UPDATE and DELETE at the database level,
-- so no API bug or ad hoc query can rewrite history.
CREATE OR REPLACE FUNCTION audit_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
