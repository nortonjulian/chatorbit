/*
  Warnings:

  - A unique constraint covering the columns `[chatRoomId,userId]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Participant_userId_chatRoomId_key";

-- AlterTable
ALTER TABLE "public"."ChatRoom" ADD COLUMN     "ownerId" INTEGER;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "translatedContent" TEXT,
ADD COLUMN     "translatedTo" TEXT,
ALTER COLUMN "contentCiphertext" SET DEFAULT '';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "strictE2EE" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "public"."PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "public"."PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "ChatRoom_ownerId_idx" ON "public"."ChatRoom"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_chatRoomId_userId_key" ON "public"."Participant"("chatRoomId", "userId");

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatRoom" ADD CONSTRAINT "ChatRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
