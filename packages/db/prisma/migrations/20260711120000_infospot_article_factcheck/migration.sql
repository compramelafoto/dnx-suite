-- AlterTable
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "sourceName" TEXT;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "factCheckedAt" TIMESTAMP(3);
ALTER TABLE "InfoSpotArticle" ADD COLUMN IF NOT EXISTS "factCheckedByUserId" INTEGER;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InfoSpotArticle"
    ADD CONSTRAINT "InfoSpotArticle_factCheckedByUserId_fkey"
    FOREIGN KEY ("factCheckedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InfoSpotArticle_factCheckedByUserId_idx"
  ON "InfoSpotArticle"("factCheckedByUserId");
