-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE', 'UNLISTED');

-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC';
