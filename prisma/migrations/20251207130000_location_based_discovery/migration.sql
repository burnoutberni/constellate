-- Add geolocation fields for location-based discovery (WP-014)
ALTER TABLE "Event" ADD COLUMN "locationLatitude" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "locationLongitude" DOUBLE PRECISION;

CREATE INDEX "Event_locationLatitude_locationLongitude_idx"
    ON "Event"("locationLatitude", "locationLongitude");
