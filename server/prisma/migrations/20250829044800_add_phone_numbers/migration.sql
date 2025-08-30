-- CreateEnum
CREATE TYPE "public"."NumberStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'HOLD', 'RELEASING');

-- CreateEnum
CREATE TYPE "public"."PortStatus" AS ENUM ('NONE', 'PORT_IN_PENDING', 'PORTED_IN', 'PORT_OUT_PENDING', 'PORTED_OUT');

-- AlterTable
ALTER TABLE "public"."ProvisionLink" ALTER COLUMN "createdById" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."PhoneNumber" (
    "id" SERIAL NOT NULL,
    "e164" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "areaCode" TEXT,
    "vanity" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."NumberStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedUserId" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "keepLocked" BOOLEAN NOT NULL DEFAULT false,
    "holdUntil" TIMESTAMP(3),
    "releaseAfter" TIMESTAMP(3),
    "portStatus" "public"."PortStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NumberReservation" (
    "id" SERIAL NOT NULL,
    "phoneNumberId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumberReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumber_e164_key" ON "public"."PhoneNumber"("e164");

-- CreateIndex
CREATE INDEX "PhoneNumber_status_idx" ON "public"."PhoneNumber"("status");

-- CreateIndex
CREATE INDEX "PhoneNumber_assignedUserId_idx" ON "public"."PhoneNumber"("assignedUserId");

-- CreateIndex
CREATE INDEX "PhoneNumber_provider_areaCode_status_idx" ON "public"."PhoneNumber"("provider", "areaCode", "status");

-- CreateIndex
CREATE INDEX "NumberReservation_expiresAt_idx" ON "public"."NumberReservation"("expiresAt");

-- AddForeignKey
ALTER TABLE "public"."PhoneNumber" ADD CONSTRAINT "PhoneNumber_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NumberReservation" ADD CONSTRAINT "NumberReservation_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "public"."PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NumberReservation" ADD CONSTRAINT "NumberReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
