-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('FREE', 'PREMIUM');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "plan" "public"."Plan" NOT NULL DEFAULT 'FREE';
