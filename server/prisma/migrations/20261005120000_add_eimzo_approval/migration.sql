-- EDO: elektron kalit (E-IMZO) bilan tasdiqlash
-- 1) Foydalanuvchi profilidagi "elektron kalit bilan tasdiqlaydi" belgisi.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "can_approve_with_key" BOOLEAN NOT NULL DEFAULT false;

-- 2) Imzo tekshiruvi metadata'si: tekshiruv usuli va TSA vaqt tamg'asi.
ALTER TABLE "document_signatures"
  ADD COLUMN IF NOT EXISTS "verify_method" VARCHAR(32);

ALTER TABLE "document_signatures"
  ADD COLUMN IF NOT EXISTS "tsa_time" TIMESTAMPTZ(3);
