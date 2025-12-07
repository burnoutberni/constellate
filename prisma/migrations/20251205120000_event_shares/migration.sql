-- AlterTable
ALTER TABLE "Event"
    ADD COLUMN "sharedEventId" TEXT;

-- CreateIndex
CREATE INDEX "Event_sharedEventId_idx" ON "Event"("sharedEventId");

-- Note: Unique constraint on [userId, sharedEventId] intentionally omitted
-- See schema.prisma comments for explanation

-- AddForeignKey
ALTER TABLE "Event"
    ADD CONSTRAINT "Event_sharedEventId_fkey" FOREIGN KEY ("sharedEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
