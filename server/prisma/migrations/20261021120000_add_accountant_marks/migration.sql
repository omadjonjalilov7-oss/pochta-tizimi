-- Yangi "buxgalter" (buxgalteriya) roli — kanselyariyaning barcha imkoniyatlari.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'buxgalter';

-- Buxgalter "to'landi" belgisi. FAQAT shu foydalanuvchiga tegishli — hujjatning
-- umumiy holatiga va boshqa foydalanuvchilarga ta'sir qilmaydi.
CREATE TABLE "accountant_marks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accountant_marks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accountant_marks_user_id_document_id_key" ON "accountant_marks"("user_id", "document_id");
CREATE INDEX "accountant_marks_user_id_idx" ON "accountant_marks"("user_id");
CREATE INDEX "accountant_marks_document_id_idx" ON "accountant_marks"("document_id");

ALTER TABLE "accountant_marks" ADD CONSTRAINT "accountant_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accountant_marks" ADD CONSTRAINT "accountant_marks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
