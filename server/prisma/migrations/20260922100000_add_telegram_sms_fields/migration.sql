-- Telegram bot va SMS bildirishnomalari uchun foydalanuvchi maydonlari
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" VARCHAR(32);
ALTER TABLE "users" ADD COLUMN "telegram_link_code" VARCHAR(24);
ALTER TABLE "users" ADD COLUMN "notify_telegram" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notify_sms" BOOLEAN NOT NULL DEFAULT true;
