-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('spam', 'harassment', 'inappropriate', 'other');

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "category" TYPE "ReportCategory" USING "category"::"ReportCategory";
ALTER TABLE "Report" ALTER COLUMN "category" SET DEFAULT 'other';

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppealType" AS ENUM ('ACCOUNT_SUSPENSION', 'CONTENT_REMOVAL');

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AppealType" NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "adminNotes" TEXT,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appeal_userId_idx" ON "Appeal"("userId");
CREATE INDEX "Appeal_status_idx" ON "Appeal"("status");

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
