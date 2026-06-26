-- CreateTable message_read_logs
CREATE TABLE "message_read_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(3) NOT NULL,
    "read_method" VARCHAR(20),
    "read_ip" VARCHAR(45),
    "read_user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_read_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_read_logs_message_id_user_id_read_at_key" ON "message_read_logs"("message_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "message_read_logs_message_id_idx" ON "message_read_logs"("message_id");

-- CreateIndex
CREATE INDEX "message_read_logs_user_id_idx" ON "message_read_logs"("user_id");

-- CreateIndex
CREATE INDEX "message_read_logs_read_at_idx" ON "message_read_logs"("read_at");

-- CreateIndex
CREATE INDEX "message_read_logs_message_id_read_at_idx" ON "message_read_logs"("message_id", "read_at");

-- AddForeignKey
ALTER TABLE "message_read_logs" ADD CONSTRAINT "message_read_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_logs" ADD CONSTRAINT "message_read_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
