-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "filename" VARCHAR(512) NOT NULL,
    "stored_path" VARCHAR(512) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_from_user_id_to_user_id_sent_at_idx" ON "chat_messages"("from_user_id", "to_user_id", "sent_at");

-- CreateIndex
CREATE INDEX "chat_messages_to_user_id_read_at_idx" ON "chat_messages"("to_user_id", "read_at");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
