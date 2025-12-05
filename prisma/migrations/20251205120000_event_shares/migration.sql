-- AlterTable
ALTER TABLE "Event"
    ADD COLUMN "sharedEventId" TEXT;

-- CreateIndex
CREATE INDEX "Event_sharedEventId_idx" ON "Event"("sharedEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_userId_sharedEventId_key" ON "Event"("userId", "sharedEventId");

-- AddForeignKey
ALTER TABLE "Event"
    ADD CONSTRAINT "Event_sharedEventId_fkey" FOREIGN KEY ("sharedEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
