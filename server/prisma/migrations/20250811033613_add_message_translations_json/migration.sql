/*
  Warnings:

  - You are about to drop the column `encryptedKeys` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `translatedContent` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `translatedTo` on the `Message` table. All the data in the column will be lost.
  - Made the column `rawContent` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Message_chatRoomId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Message_senderId_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "encryptedKeys",
DROP COLUMN "translatedContent",
DROP COLUMN "translatedTo",
ALTER COLUMN "rawContent" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."MessageKey" (
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "encryptedKey" TEXT NOT NULL,

    CONSTRAINT "MessageKey_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateIndex
CREATE INDEX "MessageKey_userId_idx" ON "public"."MessageKey"("userId");

-- AddForeignKey
ALTER TABLE "public"."MessageKey" ADD CONSTRAINT "MessageKey_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageKey" ADD CONSTRAINT "MessageKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
