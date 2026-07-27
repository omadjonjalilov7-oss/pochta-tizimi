-- Guruh chat: guruhlar, a'zolar, xabarlar va fayllar

CREATE TABLE "chat_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "avatar_path" VARCHAR(512),
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "chat_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_read_at" TIMESTAMPTZ(3),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_group_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_group_messages" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_for_all" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "chat_group_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_group_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "filename" VARCHAR(512) NOT NULL,
    "stored_path" VARCHAR(512) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    CONSTRAINT "chat_group_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_group_members_group_id_user_id_key" ON "chat_group_members"("group_id", "user_id");
CREATE INDEX "chat_group_members_user_id_idx" ON "chat_group_members"("user_id");
CREATE INDEX "chat_group_messages_group_id_sent_at_idx" ON "chat_group_messages"("group_id", "sent_at");

ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_group_messages" ADD CONSTRAINT "chat_group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_group_messages" ADD CONSTRAINT "chat_group_messages_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_group_attachments" ADD CONSTRAINT "chat_group_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_group_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
