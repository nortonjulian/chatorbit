/*
  Warnings:

  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - Made the column `preferredLanguage` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "User_phoneNumber_key";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "randomChatRoomId" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
ALTER COLUMN "preferredLanguage" SET NOT NULL,
ALTER COLUMN "preferredLanguage" SET DEFAULT 'en',
ALTER COLUMN "showOriginalWithTranslation" SET DEFAULT true;

-- CreateTable
CREATE TABLE "RandomChatRoom" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RandomChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RandomChatParticipants" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RandomChatParticipants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RandomChatParticipants_B_index" ON "_RandomChatParticipants"("B");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_randomChatRoomId_fkey" FOREIGN KEY ("randomChatRoomId") REFERENCES "RandomChatRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RandomChatParticipants" ADD CONSTRAINT "_RandomChatParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "RandomChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RandomChatParticipants" ADD CONSTRAINT "_RandomChatParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
