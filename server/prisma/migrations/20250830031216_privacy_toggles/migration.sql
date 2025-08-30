-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "notifyOnCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyBlurEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyHoldToReveal" BOOLEAN NOT NULL DEFAULT false;
