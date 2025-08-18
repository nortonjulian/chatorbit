-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "messageTone" TEXT DEFAULT 'default.mp3',
ADD COLUMN     "ringtone" TEXT DEFAULT 'classic.mp3';
