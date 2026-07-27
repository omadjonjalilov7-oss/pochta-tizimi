-- Chat xabarlarini tahrirlash va o'chirish uchun ustunlar
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" TIMESTAMPTZ(3);
ALTER TABLE "chat_messages" ADD COLUMN "deleted_for_from" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_messages" ADD COLUMN "deleted_for_to" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_messages" ADD COLUMN "deleted_for_all" BOOLEAN NOT NULL DEFAULT false;
