-- CreateEnum
CREATE TYPE "public"."StatusAudience" AS ENUM ('CONTACTS', 'MUTUALS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."StatusAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'GIF', 'STICKER', 'FILE');

-- CreateTable
CREATE TABLE "public"."Status" (
    "id" SERIAL NOT NULL,
    "authorId" INTEGER NOT NULL,
    "captionCiphertext" TEXT,
    "encryptedKeys" JSONB,
    "translatedFrom" TEXT,
    "translations" JSONB,
    "isExplicit" BOOLEAN NOT NULL DEFAULT false,
    "audience" "public"."StatusAudience" NOT NULL DEFAULT 'MUTUALS',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusAsset" (
    "id" SERIAL NOT NULL,
    "statusId" INTEGER NOT NULL,
    "kind" "public"."StatusAssetKind" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusKey" (
    "statusId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "encryptedKey" TEXT NOT NULL,

    CONSTRAINT "StatusKey_pkey" PRIMARY KEY ("statusId","userId")
);

-- CreateTable
CREATE TABLE "public"."StatusView" (
    "id" SERIAL NOT NULL,
    "statusId" INTEGER NOT NULL,
    "viewerId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StatusReaction" (
    "statusId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "StatusReaction_pkey" PRIMARY KEY ("statusId","userId","emoji")
);

-- CreateIndex
CREATE INDEX "Status_authorId_expiresAt_idx" ON "public"."Status"("authorId", "expiresAt");

-- CreateIndex
CREATE INDEX "StatusAsset_statusId_idx" ON "public"."StatusAsset"("statusId");

-- CreateIndex
CREATE INDEX "StatusView_viewerId_idx" ON "public"."StatusView"("viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "StatusView_statusId_viewerId_key" ON "public"."StatusView"("statusId", "viewerId");

-- AddForeignKey
ALTER TABLE "public"."Status" ADD CONSTRAINT "Status_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusAsset" ADD CONSTRAINT "StatusAsset_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusKey" ADD CONSTRAINT "StatusKey_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusKey" ADD CONSTRAINT "StatusKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusView" ADD CONSTRAINT "StatusView_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusView" ADD CONSTRAINT "StatusView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusReaction" ADD CONSTRAINT "StatusReaction_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StatusReaction" ADD CONSTRAINT "StatusReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
