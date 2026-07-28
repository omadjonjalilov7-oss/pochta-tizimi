-- Kiruvchi korrespondensiyani ro'yxatga olish maydonlari
ALTER TABLE "documents"
  ADD COLUMN "delivery_type" VARCHAR(32),
  ADD COLUMN "incoming_doc_kind" VARCHAR(64),
  ADD COLUMN "doc_name" VARCHAR(500),
  ADD COLUMN "higher_order" VARCHAR(500),
  ADD COLUMN "predmet" VARCHAR(500),
  ADD COLUMN "incoming_number" VARCHAR(64),
  ADD COLUMN "outgoing_number" VARCHAR(64),
  ADD COLUMN "incoming_date" TIMESTAMPTZ(3),
  ADD COLUMN "outgoing_date" TIMESTAMPTZ(3),
  ADD COLUMN "signatory" VARCHAR(255),
  ADD COLUMN "executor" VARCHAR(255),
  ADD COLUMN "contact_phone" VARCHAR(64),
  ADD COLUMN "direct_routing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "urgent" BOOLEAN NOT NULL DEFAULT false;
