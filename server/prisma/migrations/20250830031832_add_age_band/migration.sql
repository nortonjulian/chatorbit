-- CreateEnum
CREATE TYPE "public"."AgeBand" AS ENUM ('TEEN_13_17', 'ADULT_18_24', 'ADULT_25_34', 'ADULT_35_49', 'ADULT_50_PLUS');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "ageAttestedAt" TIMESTAMP(3),
ADD COLUMN     "ageBand" "public"."AgeBand",
ADD COLUMN     "randomChatAllowedBands" JSONB,
ADD COLUMN     "wantsAgeFilter" BOOLEAN NOT NULL DEFAULT true;
