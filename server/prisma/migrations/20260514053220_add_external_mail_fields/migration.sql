-- AlterTable
ALTER TABLE "users" ADD COLUMN     "external_mail_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "external_mail_last_sync_at" TIMESTAMPTZ(3),
ADD COLUMN     "external_mail_last_uid" INTEGER,
ADD COLUMN     "external_mail_login" VARCHAR(255),
ADD COLUMN     "external_mail_password_enc" TEXT;
