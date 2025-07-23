-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "translatedContent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLanguage" TEXT;
