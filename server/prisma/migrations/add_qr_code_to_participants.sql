-- AddColumn qrCode to document_participants
ALTER TABLE "document_participants" ADD COLUMN "qr_code" VARCHAR(512);
CREATE UNIQUE INDEX "document_participants_qr_code_key" ON "document_participants"("qr_code");
