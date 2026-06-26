-- Tasdiqlash PIN-kodi (4 xona) — bcrypt hash sifatida saqlanadi
ALTER TABLE "users" ADD COLUMN "approval_pin_hash" VARCHAR(255);
