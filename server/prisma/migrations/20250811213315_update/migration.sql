-- CreateEnum
CREATE TYPE "public"."AutoResponderMode" AS ENUM ('off', 'dm', 'mention', 'all');

-- CreateEnum
CREATE TYPE "public"."AIAssistantMode" AS ENUM ('off', 'mention', 'always');

-- AlterTable
ALTER TABLE "public"."ChatRoom" ADD COLUMN     "aiAssistantMode" "public"."AIAssistantMode" NOT NULL DEFAULT 'off',
ADD COLUMN     "allowForiaBot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "isAutoReply" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Participant" ADD COLUMN     "allowAIBot" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "autoResponderActiveUntil" TIMESTAMP(3),
ADD COLUMN     "autoResponderCooldownSec" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "autoResponderMode" "public"."AutoResponderMode" NOT NULL DEFAULT 'dm',
ADD COLUMN     "autoResponderSignature" TEXT;
