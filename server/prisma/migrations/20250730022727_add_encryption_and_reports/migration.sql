/*
  Warnings:

  - You are about to drop the column `content` on the `Message` table. All the data in the column will be lost.
  - Added the required column `contentCiphertext` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedKeyForRecipient` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedKeyForSender` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "content",
ADD COLUMN     "contentCiphertext" TEXT NOT NULL,
ADD COLUMN     "encryptedKeyForRecipient" TEXT NOT NULL,
ADD COLUMN     "encryptedKeyForSender" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privateKey" TEXT,
ADD COLUMN     "publicKey" TEXT;

-- CreateTable
CREATE TABLE "Report" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "reporterId" INTEGER NOT NULL,
    "decryptedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
