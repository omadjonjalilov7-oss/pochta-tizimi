-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('to', 'cc');

-- AlterTable
ALTER TABLE "message_recipients" ADD COLUMN     "kind" "RecipientKind" NOT NULL DEFAULT 'to';
