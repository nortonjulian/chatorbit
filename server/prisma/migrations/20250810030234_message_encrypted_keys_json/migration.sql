/*
  Warnings:

  - You are about to drop the column `encryptedKeyForRecipient` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `encryptedKeyForSender` on the `Message` table. All the data in the column will be lost.
  - Added the required column `encryptedKeys` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "encryptedKeyForRecipient",
DROP COLUMN "encryptedKeyForSender",
ADD COLUMN     "encryptedKeys" JSONB NOT NULL;
