-- Link público e imagen de portada para eventos
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "shareSlug" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "coverImageKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Event_shareSlug_key" ON "Event"("shareSlug");
CREATE INDEX IF NOT EXISTS "Event_shareSlug_idx" ON "Event"("shareSlug");
