-- CreateTable
CREATE TABLE "CalendarSubscription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSubscription_token_key" ON "CalendarSubscription"("token");

-- CreateIndex
CREATE INDEX "CalendarSubscription_userId_idx" ON "CalendarSubscription"("userId");

-- CreateIndex
CREATE INDEX "CalendarSubscription_token_idx" ON "CalendarSubscription"("token");

-- AddForeignKey
ALTER TABLE "CalendarSubscription" ADD CONSTRAINT "CalendarSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
