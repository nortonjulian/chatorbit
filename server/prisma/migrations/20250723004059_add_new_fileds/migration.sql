-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowExplicitContent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOriginalWithTranslation" BOOLEAN NOT NULL DEFAULT false;
