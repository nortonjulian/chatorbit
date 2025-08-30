/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "a11yCaptionBg" TEXT NOT NULL DEFAULT 'dark',
ADD COLUMN     "a11yCaptionFont" TEXT NOT NULL DEFAULT 'lg',
ADD COLUMN     "a11yFlashOnCall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "a11yLiveCaptions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "a11yVibrate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "a11yVisualAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "a11yVoiceNoteSTT" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "public"."Transcript" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "callId" TEXT,
    "messageId" INTEGER,
    "language" TEXT,
    "segments" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."STTUsage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "STTUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transcript_userId_createdAt_idx" ON "public"."Transcript"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transcript_callId_idx" ON "public"."Transcript"("callId");

-- CreateIndex
CREATE INDEX "Transcript_messageId_idx" ON "public"."Transcript"("messageId");

-- CreateIndex
CREATE INDEX "STTUsage_monthKey_idx" ON "public"."STTUsage"("monthKey");

-- CreateIndex
CREATE INDEX "STTUsage_userId_updatedAt_idx" ON "public"."STTUsage"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "STTUsage_userId_monthKey_key" ON "public"."STTUsage"("userId", "monthKey");

-- CreateIndex
CREATE INDEX "ScheduledMessage_scheduledAt_idx" ON "public"."ScheduledMessage"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "public"."User"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "public"."Transcript" ADD CONSTRAINT "Transcript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."STTUsage" ADD CONSTRAINT "STTUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
