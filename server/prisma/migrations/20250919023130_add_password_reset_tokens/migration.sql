/*
  Warnings:

  - You are about to drop the column `createdAt` on the `PasswordResetToken` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `PasswordResetToken` table. All the data in the column will be lost.
  - Added the required column `tokenHash` to the `PasswordResetToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."PasswordResetToken_token_key";

-- DropIndex
DROP INDEX "public"."PasswordResetToken_userId_idx";

-- AlterTable
ALTER TABLE "public"."PasswordResetToken" DROP COLUMN "createdAt",
DROP COLUMN "token",
ADD COLUMN     "tokenHash" VARCHAR(64) NOT NULL;

-- CreateTable
CREATE TABLE "public"."Upload" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "driver" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SmsThread" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "contactPhone" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SmsMessage" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "fromNumber" VARCHAR(32) NOT NULL,
    "toNumber" VARCHAR(32) NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Upload_ownerId_idx" ON "public"."Upload"("ownerId");

-- CreateIndex
CREATE INDEX "Upload_sha256_idx" ON "public"."Upload"("sha256");

-- CreateIndex
CREATE INDEX "SmsThread_userId_idx" ON "public"."SmsThread"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsThread_userId_contactPhone_key" ON "public"."SmsThread"("userId", "contactPhone");

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "public"."PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_usedAt_idx" ON "public"."PasswordResetToken"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "public"."PasswordResetToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."Upload" ADD CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SmsThread" ADD CONSTRAINT "SmsThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SmsMessage" ADD CONSTRAINT "SmsMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."SmsThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
