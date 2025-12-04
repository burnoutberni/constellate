-- AlterTable
ALTER TABLE "Event" ADD COLUMN "recurrencePattern" TEXT,
ADD COLUMN "recurrenceEndDate" TIMESTAMP(3);
