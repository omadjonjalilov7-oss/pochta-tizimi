-- Ro'yxatga olish jurnallari — daftar jurnallari kabi (kiruvchi, buyruqlar, shartnomalar ...)
CREATE TABLE "journals" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(32),
    "kind" VARCHAR(32) NOT NULL DEFAULT 'general',
    "seq" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "journals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "journals_kind_idx" ON "journals"("kind");
CREATE INDEX "journals_seq_idx" ON "journals"("seq");

-- Hujjatga ro'yxatga olish jurnali (kategoriya) bog'lash
ALTER TABLE "documents" ADD COLUMN "journal_id" UUID;

ALTER TABLE "documents" ADD CONSTRAINT "documents_journal_id_fkey"
    FOREIGN KEY ("journal_id") REFERENCES "journals"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
