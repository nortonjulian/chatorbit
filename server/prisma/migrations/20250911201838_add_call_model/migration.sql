/*
  Warnings:

  - The primary key for the `Call` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `acceptedAt` on the `Call` table. All the data in the column will be lost.
  - You are about to drop the column `chatId` on the `Call` table. All the data in the column will be lost.
  - The `id` column on the `Call` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
ALTER TYPE "public"."StatusAudience" ADD VALUE 'EVERYONE';

-- DropIndex
DROP INDEX "public"."Call_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."Call" DROP CONSTRAINT "Call_pkey",
DROP COLUMN "acceptedAt",
DROP COLUMN "chatId",
ADD COLUMN     "answerSdp" TEXT,
ADD COLUMN     "offerSdp" TEXT,
ADD COLUMN     "roomId" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3),
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'RINGING',
ADD CONSTRAINT "Call_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "public"."Follow" (
    "id" SERIAL NOT NULL,
    "followerId" INTEGER NOT NULL,
    "followingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "public"."Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "public"."Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "Call_roomId_idx" ON "public"."Call"("roomId");

-- AddForeignKey
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
