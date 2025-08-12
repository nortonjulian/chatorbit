-- CreateEnum
CREATE TYPE "public"."RoomRole" AS ENUM ('MEMBER', 'MODERATOR', 'ADMIN');

-- AlterTable
ALTER TABLE "public"."Participant" ADD COLUMN     "role" "public"."RoomRole" NOT NULL DEFAULT 'MEMBER';

-- CreateIndex
CREATE INDEX "Participant_chatRoomId_role_idx" ON "public"."Participant"("chatRoomId", "role");
