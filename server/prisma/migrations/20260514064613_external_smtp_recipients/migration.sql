-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "external_cc_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "external_to_emails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "external_read_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "track_token" VARCHAR(128) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "read_ip" VARCHAR(64),
    "read_user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_read_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_read_receipts_track_token_key" ON "external_read_receipts"("track_token");

-- CreateIndex
CREATE INDEX "external_read_receipts_message_id_idx" ON "external_read_receipts"("message_id");

-- AddForeignKey
ALTER TABLE "external_read_receipts" ADD CONSTRAINT "external_read_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
