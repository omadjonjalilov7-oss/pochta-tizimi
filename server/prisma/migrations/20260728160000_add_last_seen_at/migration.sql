-- Oxirgi faollik vaqti: foydalanuvchi pochta/edo/chat'dan istalgan biriga
-- oxirgi marta kirgan vaqtini kuzatish uchun.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ(3);
