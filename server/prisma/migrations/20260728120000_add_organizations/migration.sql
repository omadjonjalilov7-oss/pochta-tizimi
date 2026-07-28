-- Tashkilotlar (yuboruvchi/oluvchi) — kiruvchi/tashqi hujjatlar uchun
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "inn" VARCHAR(32) NOT NULL,
    "address" VARCHAR(500),
    "phone" VARCHAR(64),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_inn_key" ON "organizations"("inn");
CREATE INDEX "organizations_name_idx" ON "organizations"("name");

-- Hujjatga yuboruvchi tashkilot bog'lash
ALTER TABLE "documents" ADD COLUMN "sender_org_id" UUID;

ALTER TABLE "documents" ADD CONSTRAINT "documents_sender_org_id_fkey"
    FOREIGN KEY ("sender_org_id") REFERENCES "organizations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
