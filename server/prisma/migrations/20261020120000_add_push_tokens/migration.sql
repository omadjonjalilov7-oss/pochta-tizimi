-- Mobil ilova push-bildirishnomalari (FCM)

-- Foydalanuvchi push bildirishnomani yoqqan/ o'chirganini belgilaydi
ALTER TABLE "users" ADD COLUMN "notify_push" BOOLEAN NOT NULL DEFAULT true;

-- Qurilma token'lari (bitta foydalanuvchida bir nechta qurilma bo'lishi mumkin)
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" VARCHAR(16) NOT NULL DEFAULT 'android',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
