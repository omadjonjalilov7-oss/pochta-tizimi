-- Ommaviy QR kod uchun tasodifiy token: login/parolsiz hujjat holatini ko'rish
ALTER TABLE "documents" ADD COLUMN "public_token" VARCHAR(40);

-- Mavjud hujjatlarga token biriktirish (backfill)
UPDATE "documents"
SET "public_token" = substr(md5(random()::text || clock_timestamp()::text || "id"::text), 1, 24)
WHERE "public_token" IS NULL;

CREATE UNIQUE INDEX "documents_public_token_key" ON "documents"("public_token");
