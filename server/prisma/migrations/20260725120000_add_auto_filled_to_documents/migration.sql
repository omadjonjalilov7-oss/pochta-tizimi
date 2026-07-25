-- Shablon tanlanmagan hujjatlar avtomat "ichki" shablonga solinishini belgilaydi
ALTER TABLE "documents" ADD COLUMN "auto_filled" BOOLEAN NOT NULL DEFAULT false;
