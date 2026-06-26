-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "external_from_email" VARCHAR(255),
ADD COLUMN     "external_from_name" VARCHAR(255),
ADD COLUMN     "external_imap_uid" INTEGER,
ADD COLUMN     "external_message_id" VARCHAR(512),
ALTER COLUMN "from_user_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "messages_external_message_id_idx" ON "messages"("external_message_id");
