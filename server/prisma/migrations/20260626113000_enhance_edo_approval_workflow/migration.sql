-- AlterTable document_participants - add approval notes and method
ALTER TABLE "document_participants"
ADD COLUMN "approval_notes" TEXT,
ADD COLUMN "approval_method" VARCHAR(20);

-- AlterTable documents - add print control
ALTER TABLE "documents" ADD COLUMN "is_printable" BOOLEAN NOT NULL DEFAULT false;

-- Create index for print status queries
CREATE INDEX "documents_status_is_printable_idx" ON "documents"("status", "is_printable");
