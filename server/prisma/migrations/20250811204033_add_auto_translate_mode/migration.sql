-- CreateEnum
CREATE TYPE "public"."AutoTranslateMode" AS ENUM ('off', 'tagged', 'all');

-- AlterTable
ALTER TABLE "public"."ChatRoom" ADD COLUMN     "autoTranslateMode" "public"."AutoTranslateMode" NOT NULL DEFAULT 'off';
