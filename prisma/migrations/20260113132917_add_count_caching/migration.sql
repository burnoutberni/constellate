-- AlterTable
ALTER TABLE "User" ADD COLUMN     "eventsCount" INTEGER,
ADD COLUMN     "followersCount" INTEGER,
ADD COLUMN     "followersListCached" JSONB,
ADD COLUMN     "followersListSync" TIMESTAMP(3),
ADD COLUMN     "followingCount" INTEGER,
ADD COLUMN     "lastCountsSync" TIMESTAMP(3);
