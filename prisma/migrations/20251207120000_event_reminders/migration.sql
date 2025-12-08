-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minutesBeforeStart" INTEGER NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "failureReason" TEXT,
    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventReminder_eventId_userId_key" ON "EventReminder"("eventId", "userId");
CREATE INDEX "EventReminder_status_remindAt_idx" ON "EventReminder"("status", "remindAt");

-- AddForeignKey
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReminder" ADD CONSTRAINT "EventReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
