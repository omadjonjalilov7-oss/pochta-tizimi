-- AlterTable documents - add overdue approval tracking
ALTER TABLE "documents"
ADD COLUMN "is_overdue_approval_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "overdue_approved_by_id" UUID,
ADD COLUMN "overdue_approved_at" TIMESTAMPTZ(3);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_overdue_approved_by_id_fkey"
FOREIGN KEY ("overdue_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for overdue documents query
CREATE INDEX "documents_is_overdue_approval_required_idx" ON "documents"("is_overdue_approval_required", "status");
