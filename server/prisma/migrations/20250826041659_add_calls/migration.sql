/*
  Warnings:

  - The values [off,mention,always] on the enum `AIAssistantMode` will be removed. If these variants are still used in the database, this will fail.
  - The values [off,dm,mention,all] on the enum `AutoResponderMode` will be removed. If these variants are still used in the database, this will fail.
  - The values [off,tagged,all] on the enum `AutoTranslateMode` will be removed. If these variants are still used in the database, this will fail.
  - Changed the type of `messageId` on the `MessageSessionKey` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recipientUserId` on the `MessageSessionKey` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `ProvisionLink` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `createdById` on the `ProvisionLink` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."CallMode" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "public"."CallStatus" AS ENUM ('INITIATED', 'RINGING', 'ANSWERED', 'REJECTED', 'MISSED', 'CANCELLED', 'ENDED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."AIAssistantMode_new" AS ENUM ('OFF', 'MENTION', 'ALWAYS');
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "aiAssistantMode" DROP DEFAULT;
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "aiAssistantMode" TYPE "public"."AIAssistantMode_new" USING ("aiAssistantMode"::text::"public"."AIAssistantMode_new");
ALTER TYPE "public"."AIAssistantMode" RENAME TO "AIAssistantMode_old";
ALTER TYPE "public"."AIAssistantMode_new" RENAME TO "AIAssistantMode";
DROP TYPE "public"."AIAssistantMode_old";
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "aiAssistantMode" SET DEFAULT 'OFF';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."AutoResponderMode_new" AS ENUM ('OFF', 'DM', 'MENTION', 'ALL');
ALTER TABLE "public"."User" ALTER COLUMN "autoResponderMode" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "autoResponderMode" TYPE "public"."AutoResponderMode_new" USING ("autoResponderMode"::text::"public"."AutoResponderMode_new");
ALTER TYPE "public"."AutoResponderMode" RENAME TO "AutoResponderMode_old";
ALTER TYPE "public"."AutoResponderMode_new" RENAME TO "AutoResponderMode";
DROP TYPE "public"."AutoResponderMode_old";
ALTER TABLE "public"."User" ALTER COLUMN "autoResponderMode" SET DEFAULT 'DM';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."AutoTranslateMode_new" AS ENUM ('OFF', 'TAGGED', 'ALL');
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "autoTranslateMode" DROP DEFAULT;
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "autoTranslateMode" TYPE "public"."AutoTranslateMode_new" USING ("autoTranslateMode"::text::"public"."AutoTranslateMode_new");
ALTER TYPE "public"."AutoTranslateMode" RENAME TO "AutoTranslateMode_old";
ALTER TYPE "public"."AutoTranslateMode_new" RENAME TO "AutoTranslateMode";
DROP TYPE "public"."AutoTranslateMode_old";
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "autoTranslateMode" SET DEFAULT 'OFF';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."ChatRoomInvite" DROP CONSTRAINT "ChatRoomInvite_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_chatRoomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Participant" DROP CONSTRAINT "Participant_chatRoomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Participant" DROP CONSTRAINT "Participant_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_messageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_reporterId_fkey";

-- AlterTable
ALTER TABLE "public"."ChatRoom" ALTER COLUMN "autoTranslateMode" SET DEFAULT 'OFF',
ALTER COLUMN "aiAssistantMode" SET DEFAULT 'OFF';

-- AlterTable
ALTER TABLE "public"."MessageSessionKey" DROP COLUMN "messageId",
ADD COLUMN     "messageId" INTEGER NOT NULL,
DROP COLUMN "recipientUserId",
ADD COLUMN     "recipientUserId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProvisionLink" DROP COLUMN "userId",
ADD COLUMN     "userId" INTEGER NOT NULL,
DROP COLUMN "createdById",
ADD COLUMN     "createdById" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "autoResponderMode" SET DEFAULT 'DM';

-- CreateTable
CREATE TABLE "public"."Call" (
    "id" TEXT NOT NULL,
    "callerId" INTEGER NOT NULL,
    "calleeId" INTEGER NOT NULL,
    "chatId" INTEGER,
    "mode" "public"."CallMode" NOT NULL,
    "status" "public"."CallStatus" NOT NULL DEFAULT 'INITIATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_callerId_idx" ON "public"."Call"("callerId");

-- CreateIndex
CREATE INDEX "Call_calleeId_idx" ON "public"."Call"("calleeId");

-- CreateIndex
CREATE INDEX "Call_createdAt_idx" ON "public"."Call"("createdAt");

-- CreateIndex
CREATE INDEX "BotEventLog_installId_idx" ON "public"."BotEventLog"("installId");

-- CreateIndex
CREATE INDEX "MessageSessionKey_messageId_idx" ON "public"."MessageSessionKey"("messageId");

-- CreateIndex
CREATE INDEX "MessageSessionKey_recipientUserId_idx" ON "public"."MessageSessionKey"("recipientUserId");

-- CreateIndex
CREATE INDEX "MessageSessionKey_recipientDeviceId_idx" ON "public"."MessageSessionKey"("recipientDeviceId");

-- CreateIndex
CREATE INDEX "ProvisionLink_userId_idx" ON "public"."ProvisionLink"("userId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_chatRoomId_idx" ON "public"."ScheduledMessage"("chatRoomId");

-- CreateIndex
CREATE INDEX "ScheduledMessage_senderId_idx" ON "public"."ScheduledMessage"("senderId");

-- AddForeignKey
ALTER TABLE "public"."ProvisionLink" ADD CONSTRAINT "ProvisionLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProvisionLink" ADD CONSTRAINT "ProvisionLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Participant" ADD CONSTRAINT "Participant_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatRoomInvite" ADD CONSTRAINT "ChatRoomInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageSessionKey" ADD CONSTRAINT "MessageSessionKey_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageSessionKey" ADD CONSTRAINT "MessageSessionKey_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageSessionKey" ADD CONSTRAINT "MessageSessionKey_recipientDeviceId_fkey" FOREIGN KEY ("recipientDeviceId") REFERENCES "public"."Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Call" ADD CONSTRAINT "Call_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Call" ADD CONSTRAINT "Call_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
