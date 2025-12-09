-- CreateEnum for FailedDeliveryStatus
CREATE TYPE "FailedDeliveryStatus" AS ENUM ('PENDING', 'RETRYING', 'FAILED', 'DISCARDED');

-- CreateTable for FailedDelivery
CREATE TABLE "FailedDelivery" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "activity" JSONB NOT NULL,
    "inboxUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastError" TEXT,
    "lastErrorCode" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "status" "FailedDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "FailedDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedDelivery_status_nextRetryAt_idx" ON "FailedDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "FailedDelivery_userId_idx" ON "FailedDelivery"("userId");

-- CreateIndex
CREATE INDEX "FailedDelivery_inboxUrl_idx" ON "FailedDelivery"("inboxUrl");

-- CreateIndex
CREATE INDEX "FailedDelivery_createdAt_idx" ON "FailedDelivery"("createdAt");
