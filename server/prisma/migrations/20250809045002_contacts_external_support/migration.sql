/*
  Warnings:

  - You are about to alter the column `phoneNumber` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(32)`.
  - A unique constraint covering the columns `[ownerId,externalPhone]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Contact" DROP CONSTRAINT "Contact_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Contact" DROP CONSTRAINT "Contact_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Contact" ADD COLUMN     "externalName" TEXT,
ADD COLUMN     "externalPhone" VARCHAR(32),
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "phoneNumber" SET DATA TYPE VARCHAR(32);

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "public"."Contact"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "public"."Contact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_externalPhone_key" ON "public"."Contact"("ownerId", "externalPhone");

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
