-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedBySender" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoDeleteSeconds" INTEGER,
ADD COLUMN     "showReadReceipts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "_ReadMessages" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ReadMessages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ReadMessages_B_index" ON "_ReadMessages"("B");

-- AddForeignKey
ALTER TABLE "_ReadMessages" ADD CONSTRAINT "_ReadMessages_A_fkey" FOREIGN KEY ("A") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReadMessages" ADD CONSTRAINT "_ReadMessages_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
