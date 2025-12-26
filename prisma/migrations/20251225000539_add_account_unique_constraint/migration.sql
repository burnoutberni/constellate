-- AlterTable
ALTER TABLE "Account" ADD CONSTRAINT "Account_providerId_accountId_key" UNIQUE ("providerId", "accountId");