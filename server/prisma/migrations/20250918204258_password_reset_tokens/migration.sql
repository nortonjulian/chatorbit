-- AlterTable
ALTER TABLE "public"."PasswordResetToken" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "usedAt" TIMESTAMP(3);
