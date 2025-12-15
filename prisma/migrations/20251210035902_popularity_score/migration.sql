-- Add popularityScore column to Event table
-- This denormalized field stores (attendance * 2 + likes) to enable efficient sorting
-- without loading all events into memory
ALTER TABLE "Event" ADD COLUMN "popularityScore" INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient sorting by popularity
CREATE INDEX "Event_popularityScore_idx" ON "Event"("popularityScore");

-- Calculate initial popularity scores for existing events
-- Formula: attendance * 2 + likes
UPDATE "Event" e
SET "popularityScore" = (
    COALESCE((SELECT COUNT(*) * 2 FROM "EventAttendance" WHERE "eventId" = e.id), 0) +
    COALESCE((SELECT COUNT(*) FROM "EventLike" WHERE "eventId" = e.id), 0)
);



