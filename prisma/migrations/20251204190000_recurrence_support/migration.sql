-- CreateEnum
CREATE TYPE "RecurrencePattern" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Event"
    ADD COLUMN "recurrencePattern" "RecurrencePattern",
    ADD COLUMN "recurrenceEndDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Event_recurrenceEndDate_idx" ON "Event"("recurrenceEndDate");
