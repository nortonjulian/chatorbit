-- AlterTable
ALTER TABLE "public"."Message" ALTER COLUMN "rawContent" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Message_chatRoomId_createdAt_idx" ON "public"."Message"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "public"."Message"("senderId", "createdAt");
