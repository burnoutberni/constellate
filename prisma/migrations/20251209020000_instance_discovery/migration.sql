-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "domain" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "software" TEXT,
    "version" TEXT,
    "title" TEXT,
    "description" TEXT,
    "iconUrl" TEXT,
    "contact" TEXT,
    "userCount" INTEGER,
    "eventCount" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastFetchedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instance_domain_key" ON "Instance"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_baseUrl_key" ON "Instance"("baseUrl");

-- CreateIndex
CREATE INDEX "Instance_domain_idx" ON "Instance"("domain");

-- CreateIndex
CREATE INDEX "Instance_isBlocked_idx" ON "Instance"("isBlocked");

-- CreateIndex
CREATE INDEX "Instance_lastActivityAt_idx" ON "Instance"("lastActivityAt");
