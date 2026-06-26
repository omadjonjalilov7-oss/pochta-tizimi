-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('internal', 'incoming', 'outgoing');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'in_review', 'in_progress', 'done', 'rejected', 'overdue');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('creator', 'approver', 'executor', 'observer');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('pending', 'approved', 'rejected', 'done');

-- CreateEnum
CREATE TYPE "EdoTaskStatus" AS ENUM ('pending', 'in_progress', 'done', 'overdue');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "can_sign_external" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manager_id" UUID;

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "number" VARCHAR(64) NOT NULL,
    "number_category" VARCHAR(16) NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "DocumentType" NOT NULL,
    "template_id" UUID,
    "subject" VARCHAR(500) NOT NULL,
    "short_info" VARCHAR(1000),
    "body" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "external_recipient" VARCHAR(255),
    "created_by_id" UUID NOT NULL,
    "current_holder_id" UUID,
    "deadline" TIMESTAMPTZ(3),
    "signature_chain_position" INTEGER NOT NULL DEFAULT 0,
    "is_signed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_participants" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ParticipantRole" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'pending',
    "deadline" TIMESTAMPTZ(3),
    "acted_at" TIMESTAMPTZ(3),
    "reject_reason" TEXT,

    CONSTRAINT "document_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolutions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_targets" (
    "id" UUID NOT NULL,
    "resolution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "deadline" TIMESTAMPTZ(3),
    "status" "EdoTaskStatus" NOT NULL DEFAULT 'pending',
    "done_at" TIMESTAMPTZ(3),
    "done_note" TEXT,

    CONSTRAINT "resolution_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_attachments" (
    "id" UUID NOT NULL,
    "document_id" UUID,
    "uploaded_by_id" UUID NOT NULL,
    "filename" VARCHAR(512) NOT NULL,
    "stored_path" VARCHAR(1024) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signatures" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "signer_id" UUID NOT NULL,
    "pkcs7_data" BYTEA NOT NULL,
    "cert_serial" VARCHAR(128) NOT NULL,
    "cert_subject" VARCHAR(512) NOT NULL,
    "cert_issuer" VARCHAR(512),
    "cert_valid_from" TIMESTAMPTZ(3),
    "cert_valid_to" TIMESTAMPTZ(3),
    "signature_hash" VARCHAR(128) NOT NULL,
    "signed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "verify_error" TEXT,

    CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_audit_log" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "body_template" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "category" VARCHAR(16) NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_number_key" ON "documents"("number");

-- CreateIndex
CREATE INDEX "documents_created_by_id_idx" ON "documents"("created_by_id");

-- CreateIndex
CREATE INDEX "documents_current_holder_id_idx" ON "documents"("current_holder_id");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_year_number_category_idx" ON "documents"("year", "number_category");

-- CreateIndex
CREATE INDEX "document_participants_user_id_status_idx" ON "document_participants"("user_id", "status");

-- CreateIndex
CREATE INDEX "document_participants_document_id_order_idx" ON "document_participants"("document_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "document_participants_document_id_user_id_role_key" ON "document_participants"("document_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "resolutions_document_id_idx" ON "resolutions"("document_id");

-- CreateIndex
CREATE INDEX "resolution_targets_user_id_status_idx" ON "resolution_targets"("user_id", "status");

-- CreateIndex
CREATE INDEX "resolution_targets_resolution_id_idx" ON "resolution_targets"("resolution_id");

-- CreateIndex
CREATE INDEX "document_comments_document_id_idx" ON "document_comments"("document_id");

-- CreateIndex
CREATE INDEX "document_attachments_document_id_idx" ON "document_attachments"("document_id");

-- CreateIndex
CREATE INDEX "document_signatures_document_id_idx" ON "document_signatures"("document_id");

-- CreateIndex
CREATE INDEX "document_audit_log_document_id_idx" ON "document_audit_log"("document_id");

-- CreateIndex
CREATE INDEX "document_audit_log_action_idx" ON "document_audit_log"("action");

-- CreateIndex
CREATE INDEX "document_audit_log_created_at_idx" ON "document_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "document_templates_category_idx" ON "document_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "document_counters_year_category_key" ON "document_counters"("year", "category");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_holder_id_fkey" FOREIGN KEY ("current_holder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_participants" ADD CONSTRAINT "document_participants_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_participants" ADD CONSTRAINT "document_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_targets" ADD CONSTRAINT "resolution_targets_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "resolutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_targets" ADD CONSTRAINT "resolution_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
