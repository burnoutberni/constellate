-- Add timezone preference to users
ALTER TABLE "User"
    ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- Track source timezone for events
ALTER TABLE "Event"
    ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
