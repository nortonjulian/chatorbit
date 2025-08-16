-- CreateEnum
CREATE TYPE "public"."ContentScope" AS ENUM ('COMMANDS', 'MENTIONS', 'ALL');

-- DropIndex
DROP INDEX "public"."Participant_chatRoomId_role_idx";

-- CreateTable
CREATE TABLE "public"."Bot" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "serviceUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotInstall" (
    "id" SERIAL NOT NULL,
    "botId" INTEGER NOT NULL,
    "chatRoomId" INTEGER NOT NULL,
    "contentScope" "public"."ContentScope" NOT NULL DEFAULT 'COMMANDS',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotEventLog" (
    "id" SERIAL NOT NULL,
    "installId" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bot_ownerId_name_key" ON "public"."Bot"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BotInstall_botId_chatRoomId_key" ON "public"."BotInstall"("botId", "chatRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "BotEventLog_eventId_key" ON "public"."BotEventLog"("eventId");

-- CreateIndex
CREATE INDEX "room_updated_id" ON "public"."ChatRoom"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "msg_room_id" ON "public"."Message"("chatRoomId", "id");

-- CreateIndex
CREATE INDEX "part_room" ON "public"."Participant"("chatRoomId");

-- CreateIndex
CREATE INDEX "status_emoji" ON "public"."StatusReaction"("statusId", "emoji");

-- AddForeignKey
ALTER TABLE "public"."Bot" ADD CONSTRAINT "Bot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Bot" ADD CONSTRAINT "Bot_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotInstall" ADD CONSTRAINT "BotInstall_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotInstall" ADD CONSTRAINT "BotInstall_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "public"."ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotEventLog" ADD CONSTRAINT "BotEventLog_installId_fkey" FOREIGN KEY ("installId") REFERENCES "public"."BotInstall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."Message_chatRoomId_createdAt_idx" RENAME TO "msg_room_time";
